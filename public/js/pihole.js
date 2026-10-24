/* Pi-hole v6 management UI for RaspiPot */
(function () {
  'use strict';

  const BLOCKED_STATUSES = [
    'GRAVITY',
    'GRAVITY_CNAME',
    'REGEX',
    'REGEX_CNAME',
    'DENYLIST',
    'DENYLIST_CNAME',
    'EXTERNAL_BLOCKED_IP',
    'EXTERNAL_BLOCKED_NULL',
    'EXTERNAL_BLOCKED_NXRA',
  ];

  const $ = id => document.getElementById(id);

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(number) {
    const n = Number(number);
    return Number.isFinite(n) ? n.toLocaleString() : '-';
  }

  function toast(message, type) {
    let host = $('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.style.cssText =
        'position:fixed;top:1rem;right:1rem;z-index:2000;display:flex;flex-direction:column;gap:0.5rem;';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    const color = type === 'error' ? 'var(--danger)' : 'var(--success)';
    el.style.cssText =
      'background: var(--bg-card); border:1px solid ' +
      color +
      '; color: var(--text-main); padding:0.75rem 1rem; border-radius:0.5rem; box-shadow:0 4px 15px rgba(0,0,0,0.3); max-width:340px; font-size:0.9rem;';
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  async function api(path, options) {
    const opts = Object.assign({}, options);
    opts.headers = Object.assign(
      { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      opts.headers || {}
    );
    if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    const res = await fetch('/api/pihole' + path, opts);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }
    if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status);
    return data;
  }

  function action(actionName) {
    return api('/action', { method: 'POST', body: { action: actionName } });
  }

  // --- Tabs -----------------------------------------------------------------

  let currentTab = 'dashboard';

  function showTab(name) {
    currentTab = name;
    document.querySelectorAll('#tabs .tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === name);
    });
    document.querySelectorAll('.panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'panel-' + name);
    });
    if (name === 'dashboard') startDashboard();
    else stopDashboardLive();
    if (name === 'queries') loadQueries(true);
    if (name === 'lists') loadDomains();
    if (name === 'adlists') loadAdlists();
    if (name === 'groups') loadGroups();
    if (name === 'config') loadConfig();
    if (name === 'logs') loadLogs();
    if (name === 'admin') loadAdmin();
  }

  $('tabs').addEventListener('click', event => {
    const tab = event.target.closest('.tab');
    if (tab) showTab(tab.dataset.tab);
  });

  // --- Status & blocking ----------------------------------------------------

  async function loadStatus() {
    try {
      const status = await api('/status');
      if (status.reachable) {
        const v = status.version || {};
        $('piholeVersion').innerHTML =
          '<span class="material-icons text-success" style="font-size: 1rem;">check_circle</span> ' +
          'Core ' +
          esc(v.core && v.core.local ? v.core.local.version : 'v6') +
          ' &middot; FTL ' +
          esc(v.ftl && v.ftl.local ? v.ftl.local.version : '?') +
          ' &middot; Web ' +
          esc(v.web && v.web.local ? v.web.local.version : '?') +
          ' &middot; <span class="mono">' +
          esc(status.url || '') +
          '</span>';
      } else {
        const code = status.code ? ` [${status.code}]` : '';
        const hint = status.hint
          ? '<div class="muted" style="margin-top: 0.35rem;">' + esc(status.hint) + '</div>'
          : '';
        $('piholeVersion').innerHTML =
          '<span class="material-icons text-danger" style="font-size: 1rem;">error</span> Pi-hole unreachable' +
          esc(code) +
          ': ' +
          esc(status.error || 'no details returned') +
          hint;
      }
      window.piholeAdminProxyPort = status.adminProxy && status.adminProxy.port;
    } catch (e) {
      $('piholeVersion').innerHTML =
        '<span class="material-icons text-danger" style="font-size: 1rem;">error</span> ' +
        esc(e.message);
    }
  }

  let blocking = true;

  function renderBlocking() {
    const sw = $('blockingSwitch');
    sw.classList.toggle('on', blocking);
    sw.setAttribute('aria-checked', String(blocking));
    $('blockingLabel').textContent = blocking ? 'Blocking' : 'Disabled';
    $('blockingLabel').className = blocking ? 'muted text-success' : 'muted text-danger';
  }

  async function loadBlocking() {
    try {
      const data = await api('/blocking');
      blocking = !!data.blocking;
      renderBlocking();
    } catch (e) {
      toast('Blocking state: ' + e.message, 'error');
    }
  }

  async function toggleBlocking() {
    const want = !blocking;
    const timer = Number($('blockTimer').value) || 0;
    const body = { blocking: want };
    if (!want && timer > 0) body.timer = timer;
    try {
      const data = await api('/blocking', { method: 'POST', body });
      blocking = !!data.blocking;
      renderBlocking();
      toast(blocking ? 'Blocking enabled' : 'Blocking disabled');
    } catch (e) {
      toast('Failed: ' + e.message, 'error');
    }
  }

  $('blockingSwitch').addEventListener('click', toggleBlocking);
  $('blockingSwitch').addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleBlocking();
    }
  });

  // --- Dashboard ------------------------------------------------------------

  let dashboardWatching = false;

  function startDashboard() {
    loadDashboard();
    if (!dashboardWatching) {
      dashboardWatching = true;
      socket.emit('pihole:watch', 10000);
    }
  }

  function stopDashboardLive() {
    if (dashboardWatching) {
      dashboardWatching = false;
      socket.emit('pihole:unwatch');
    }
  }

  socket.on('pihole:summary', summary => renderKpis(summary));

  function renderKpis(summary) {
    if (!summary || !summary.queries) return;
    const q = summary.queries;
    $('kpiTotal').textContent = fmt(q.total);
    $('kpiBlocked').textContent = fmt(q.blocked);
    const percent = Number(q.percent_blocked) || 0;
    $('kpiPercent').textContent = percent.toFixed(1);
    $('kpiPercentBar').style.width = Math.min(100, percent) + '%';

    const gravity = summary.gravity || {};
    $('kpiGravity').textContent = fmt(gravity.domains_being_blocked);
    $('kpiGravityUpdated').textContent = gravity.last_update
      ? new Date(gravity.last_update * 1000).toLocaleString()
      : '-';

    const clients = summary.clients || {};
    $('kpiClients').textContent = fmt(clients.active);
    $('kpiClientsTotal').textContent = fmt(clients.total);
  }

  async function loadDashboard() {
    try {
      const [summary, history] = await Promise.all([
        api('/summary'),
        api('/history').catch(() => null),
      ]);
      renderKpis(summary);
      if (history) drawHistory(history);
    } catch (e) {
      toast('Dashboard: ' + e.message, 'error');
    }
    loadTop();
  }

  function normalizeHistory(history) {
    const raw = history && history.history ? history.history : history;
    const points = [];
    if (Array.isArray(raw)) {
      raw.forEach(item => {
        if (Array.isArray(item)) {
          points.push({ t: Number(item[0]), total: Number(item[1]) || 0, blocked: 0, cached: 0 });
        } else if (item && typeof item === 'object') {
          points.push({
            t: Number(item.timestamp),
            total: Number(item.total) || 0,
            blocked: Number(item.blocked) || 0,
            cached: Number(item.cached) || 0,
          });
        }
      });
    } else if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(key => {
        const value = raw[key];
        if (Array.isArray(value)) {
          points.push({
            t: Number(key),
            total: Number(value[0]) || 0,
            blocked: Number(value[1]) || 0,
            cached: 0,
          });
        } else {
          points.push({
            t: Number(key),
            total: Number(value && value.total) || Number(value) || 0,
            blocked: Number(value && value.blocked) || 0,
            cached: Number(value && value.cached) || 0,
          });
        }
      });
    }
    return points.filter(p => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  }

  function drawHistory(history) {
    const canvas = $('historyChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 600;
    const height = 160;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const points = normalizeHistory(history);
    if (!points.length) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.fillText('No history data available', 12, height / 2);
      return;
    }

    const max = Math.max.apply(null, points.map(p => p.total).concat([1]));
    const barWidth = Math.max(1, width / points.length - 1);

    points.forEach((point, index) => {
      const x = (index / points.length) * width;
      const totalHeight = (point.total / max) * (height - 20);
      const blockedHeight = point.blocked ? (point.blocked / max) * (height - 20) : 0;
      const cachedHeight = point.cached ? (point.cached / max) * (height - 20) : 0;

      ctx.fillStyle = '#2b6cee';
      ctx.fillRect(x, height - totalHeight, barWidth, totalHeight);
      if (cachedHeight) {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(x, height - cachedHeight, barWidth, cachedHeight);
      }
      if (blockedHeight) {
        ctx.fillStyle = '#ef476f';
        ctx.fillRect(x, height - blockedHeight, barWidth, blockedHeight);
      }
    });
  }

  function renderRankList(container, items, keyName, valueKey, valueLabel) {
    if (!items || !items.length) {
      container.innerHTML = '<div class="muted">No data</div>';
      return;
    }
    container.innerHTML = items
      .map(item => {
        const label = item[keyName];
        const value = item[valueKey];
        return (
          '<div class="list-row"><span class="mono" style="overflow:hidden;text-overflow:ellipsis;">' +
          esc(label) +
          '</span><span class="muted">' +
          fmt(value) +
          ' ' +
          (valueLabel || '') +
          '</span></div>'
        );
      })
      .join('');
  }

  async function loadTop() {
    try {
      const [domains, blockedDomains, clients, upstreams] = await Promise.all([
        api('/stats/top_domains?count=10'),
        api('/stats/top_domains?blocked=true&count=10'),
        api('/stats/top_clients?count=10'),
        api('/stats/upstreams'),
      ]);
      renderRankList($('topDomains'), domains.domains, 'domain', 'count', 'queries');
      renderRankList($('topBlocked'), blockedDomains.domains, 'domain', 'count', 'queries');
      renderRankList($('topClients'), clients.clients, 'name', 'count', 'queries');
      if (upstreams && upstreams.upstreams) {
        const list = Object.keys(upstreams.upstreams).map(name => ({
          name: name,
          count: upstreams.upstreams[name].count,
          response: upstreams.upstreams[name].response,
        }));
        list.sort((a, b) => b.count - a.count);
        renderRankList($('upstreams'), list, 'name', 'count', 'queries');
      } else {
        renderRankList($('upstreams'), [], 'name', 'count', '');
      }
    } catch (e) {
      toast('Top lists: ' + e.message, 'error');
    }
  }

  // --- Query log ------------------------------------------------------------

  let queryStart = 0;
  const queryLength = 25;
  let queryTotal = 0;
  let queryLive = false;
  let queryTimer = null;

  function queryParams() {
    const params = { length: queryLength, start: queryStart };
    const search = $('qSearch').value.trim();
    const status = $('qStatus').value;
    const type = $('qType').value;
    const client = $('qClient').value.trim();
    if (search) params.domain = search;
    if (status) params.status = status;
    if (type) params.type = type;
    if (client) params.client_ip = client;
    return params;
  }

  async function loadQueries(reset) {
    if (reset) queryStart = 0;
    const params = queryParams();
    const query = Object.keys(params)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
      .join('&');
    try {
      const data = await api('/queries?' + query);
      queryTotal = Number(data.recordsFiltered || data.recordsTotal || 0);
      renderQueries(data.queries || []);
    } catch (e) {
      $('queryRows').innerHTML =
        '<tr><td colspan="6" class="muted">' + esc(e.message) + '</td></tr>';
      toast('Query log: ' + e.message, 'error');
    }
  }

  function renderQueries(queries) {
    const rows = $('queryRows');
    if (!queries.length) {
      rows.innerHTML = '<tr><td colspan="6" class="muted">No queries match the filter</td></tr>';
    } else {
      rows.innerHTML = queries
        .map(q => {
          const isBlocked = BLOCKED_STATUSES.indexOf(q.status) !== -1;
          const client = q.client ? q.client.ip || q.client.name || '' : '';
          const clientName = q.client && q.client.name ? '(' + q.client.name + ')' : '';
          const time = q.time ? new Date(q.time * 1000).toLocaleTimeString() : '';
          const reply = q.reply
            ? q.reply.type + (q.reply.time ? ' ' + Number(q.reply.time).toFixed(1) + 'ms' : '')
            : '';
          return (
            '<tr>' +
            '<td class="mono muted">' +
            esc(time) +
            '</td>' +
            '<td class="mono">' +
            esc(q.type) +
            '</td>' +
            '<td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;">' +
            esc(q.domain) +
            '</td>' +
            '<td class="mono muted">' +
            esc(client) +
            ' ' +
            esc(clientName) +
            '</td>' +
            '<td><span class="badge ' +
            (isBlocked ? 'blocked' : 'ok') +
            '">' +
            esc(q.status) +
            '</span></td>' +
            '<td class="mono muted">' +
            esc(reply) +
            '</td>' +
            '</tr>'
          );
        })
        .join('');
    }
    const from = queryTotal === 0 ? 0 : queryStart + 1;
    $('qInfo').textContent =
      from + '-' + Math.min(queryStart + queryLength, queryTotal) + ' of ' + fmt(queryTotal);
    $('qPrev').disabled = queryStart === 0;
    $('qNext').disabled = queryStart + queryLength >= queryTotal;
  }

  $('qApply').addEventListener('click', () => loadQueries(true));
  $('qPrev').addEventListener('click', () => {
    queryStart = Math.max(0, queryStart - queryLength);
    loadQueries(false);
  });
  $('qNext').addEventListener('click', () => {
    queryStart += queryLength;
    loadQueries(false);
  });
  $('qSearch').addEventListener('keydown', event => {
    if (event.key === 'Enter') loadQueries(true);
  });
  $('qLive').addEventListener('click', () => {
    queryLive = !queryLive;
    $('qLive').textContent = 'Live: ' + (queryLive ? 'On' : 'Off');
    $('qLive').className = queryLive ? 'btn' : 'btn ghost';
    if (queryTimer) clearInterval(queryTimer);
    if (queryLive) {
      loadQueries(true);
      queryTimer = setInterval(() => loadQueries(true), 4000);
    }
  });

  // --- Allow / deny lists ---------------------------------------------------

  async function loadDomains() {
    const list = $('listScope').value;
    const kind = $('listKind').value;
    const rows = $('domainRows');
    try {
      const data = await api('/domains?list=' + list + '&kind=' + kind);
      const domains = data.domains || [];
      if (!domains.length) {
        rows.innerHTML = '<tr><td colspan="4" class="muted">List is empty</td></tr>';
        return;
      }
      rows.innerHTML = domains
        .map(d => {
          const comment = d.comment || '';
          const enabled = d.enabled !== false;
          return (
            '<tr>' +
            '<td class="mono">' +
            esc(d.domain) +
            '</td>' +
            '<td class="muted">' +
            esc(comment) +
            '</td>' +
            '<td><span class="badge ' +
            (enabled ? 'ok' : 'neutral') +
            '">' +
            (enabled ? 'enabled' : 'disabled') +
            '</span></td>' +
            '<td style="text-align:right;"><button class="btn danger" data-domain="' +
            esc(d.domain) +
            '">Delete</button></td>' +
            '</tr>'
          );
        })
        .join('');
      rows.querySelectorAll('button[data-domain]').forEach(button => {
        button.addEventListener('click', () => deleteDomain(button.dataset.domain));
      });
    } catch (e) {
      rows.innerHTML = '<tr><td colspan="4" class="muted">' + esc(e.message) + '</td></tr>';
    }
  }

  async function addDomain() {
    const list = $('listScope').value;
    const kind = $('listKind').value;
    const domain = $('newDomain').value.trim();
    const comment = $('newDomainComment').value.trim();
    if (!domain) return toast('Enter a domain', 'error');
    try {
      await api('/domains', {
        method: 'POST',
        body: { list: list, kind: kind, domain: domain, comment: comment },
      });
      $('newDomain').value = '';
      $('newDomainComment').value = '';
      toast('Added to ' + list + ' list');
      loadDomains();
    } catch (e) {
      toast('Add failed: ' + e.message, 'error');
    }
  }

  async function deleteDomain(domain) {
    const list = $('listScope').value;
    const kind = $('listKind').value;
    if (!confirm('Delete ' + domain + ' from the ' + list + ' (' + kind + ') list?')) return;
    try {
      await api('/domains/' + list + '/' + kind + '/' + encodeURIComponent(domain), {
        method: 'DELETE',
      });
      toast('Deleted ' + domain);
      loadDomains();
    } catch (e) {
      toast('Delete failed: ' + e.message, 'error');
    }
  }

  $('addDomain').addEventListener('click', addDomain);
  $('listScope').addEventListener('change', loadDomains);
  $('listKind').addEventListener('change', loadDomains);

  // --- Adlists --------------------------------------------------------------

  async function loadAdlists() {
    const rows = $('adlistRows');
    try {
      const data = await api('/lists');
      const lists = data.lists || [];
      if (!lists.length) {
        rows.innerHTML = '<tr><td colspan="5" class="muted">No adlists configured</td></tr>';
        return;
      }
      rows.innerHTML = lists
        .map(l => {
          const enabled = l.enabled !== false;
          const status =
            l.status === undefined || l.status === null
              ? enabled
                ? 'ok'
                : 'neutral'
              : l.status > 0
                ? 'blocked'
                : 'ok';
          return (
            '<tr>' +
            '<td class="mono" style="max-width:340px;overflow:hidden;text-overflow:ellipsis;">' +
            esc(l.address) +
            '</td>' +
            '<td class="muted">' +
            esc(l.comment || '') +
            '</td>' +
            '<td><span class="badge ' +
            status +
            '">' +
            (enabled ? 'enabled' : 'disabled') +
            '</span></td>' +
            '<td class="mono">' +
            fmt(l.number) +
            '</td>' +
            '<td style="text-align:right;"><button class="btn danger" data-address="' +
            esc(l.address) +
            '">Delete</button></td>' +
            '</tr>'
          );
        })
        .join('');
      rows.querySelectorAll('button[data-address]').forEach(button => {
        button.addEventListener('click', () => deleteAdlist(button.dataset.address));
      });
    } catch (e) {
      rows.innerHTML = '<tr><td colspan="5" class="muted">' + esc(e.message) + '</td></tr>';
    }
  }

  async function addAdlist() {
    const address = $('newList').value.trim();
    const comment = $('newListComment').value.trim();
    if (!address) return toast('Enter a list URL', 'error');
    try {
      await api('/lists', { method: 'POST', body: { address: address, comment: comment } });
      $('newList').value = '';
      $('newListComment').value = '';
      toast('Adlist added - run Update gravity to apply');
      loadAdlists();
    } catch (e) {
      toast('Add failed: ' + e.message, 'error');
    }
  }

  async function deleteAdlist(address) {
    if (!confirm('Delete adlist ' + address + '?')) return;
    try {
      await api('/lists', { method: 'DELETE', body: { address: address } });
      toast('Adlist deleted');
      loadAdlists();
    } catch (e) {
      toast('Delete failed: ' + e.message, 'error');
    }
  }

  $('addList').addEventListener('click', addAdlist);

  // --- Groups ---------------------------------------------------------------

  async function loadGroups() {
    const rows = $('groupRows');
    try {
      const data = await api('/groups');
      const groups = data.groups || [];
      if (!groups.length) {
        rows.innerHTML = '<tr><td colspan="4" class="muted">No groups</td></tr>';
        return;
      }
      rows.innerHTML = groups
        .map(g => {
          const enabled = g.enabled !== false;
          const isDefault = g.name === 'Default';
          return (
            '<tr>' +
            '<td>' +
            esc(g.name) +
            '</td>' +
            '<td class="muted">' +
            esc(g.comment || '') +
            '</td>' +
            '<td><span class="badge ' +
            (enabled ? 'ok' : 'neutral') +
            '">' +
            (enabled ? 'enabled' : 'disabled') +
            '</span></td>' +
            '<td style="text-align:right;">' +
            (isDefault
              ? '<span class="muted">-</span>'
              : '<button class="btn danger" data-group="' + esc(g.name) + '">Delete</button>') +
            '</td>' +
            '</tr>'
          );
        })
        .join('');
      rows.querySelectorAll('button[data-group]').forEach(button => {
        button.addEventListener('click', () => deleteGroup(button.dataset.group));
      });
    } catch (e) {
      rows.innerHTML = '<tr><td colspan="4" class="muted">' + esc(e.message) + '</td></tr>';
    }
  }

  async function addGroup() {
    const name = $('newGroup').value.trim();
    const comment = $('newGroupComment').value.trim();
    if (!name) return toast('Enter a group name', 'error');
    try {
      await api('/groups', { method: 'POST', body: { name: name, comment: comment } });
      $('newGroup').value = '';
      $('newGroupComment').value = '';
      toast('Group added');
      loadGroups();
    } catch (e) {
      toast('Add failed: ' + e.message, 'error');
    }
  }

  async function deleteGroup(name) {
    if (!confirm('Delete group ' + name + '?')) return;
    try {
      await api('/groups/' + encodeURIComponent(name), { method: 'DELETE' });
      toast('Group deleted');
      loadGroups();
    } catch (e) {
      toast('Delete failed: ' + e.message, 'error');
    }
  }

  $('addGroup').addEventListener('click', addGroup);

  // --- Config ---------------------------------------------------------------

  async function loadConfig() {
    try {
      const results = await Promise.all([
        api('/config?path=dns.upstreams').catch(() => null),
        api('/config?path=dns.interface').catch(() => null),
        api('/config?path=dns.domain').catch(() => null),
      ]);
      if (Array.isArray(results[0])) $('cfgUpstreams').value = results[0].join('\n');
      $('cfgInterface').value = results[1] || '';
      $('cfgDomain').value = results[2] || '';
    } catch (e) {
      toast('Config: ' + e.message, 'error');
    }
  }

  async function patchConfig(path, value) {
    await api('/config', { method: 'PATCH', body: { path: path, value: value } });
    toast('Saved ' + path);
  }

  $('saveUpstreams').addEventListener('click', async () => {
    const value = $('cfgUpstreams')
      .value.split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    try {
      await patchConfig('dns.upstreams', value);
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
  });
  $('saveInterface').addEventListener('click', async () => {
    try {
      await patchConfig('dns.interface', $('cfgInterface').value.trim());
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
  });
  $('saveDomain').addEventListener('click', async () => {
    try {
      await patchConfig('dns.domain', $('cfgDomain').value.trim());
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
  });

  $('rawLoad').addEventListener('click', async () => {
    const path = $('rawPath').value.trim();
    if (!path) return toast('Enter a config path', 'error');
    try {
      const value = await api('/config?path=' + encodeURIComponent(path));
      $('rawValue').value = JSON.stringify(value, null, 2);
    } catch (e) {
      toast('Load failed: ' + e.message, 'error');
    }
  });
  $('rawSave').addEventListener('click', async () => {
    const path = $('rawPath').value.trim();
    if (!path) return toast('Enter a config path', 'error');
    let value;
    try {
      value = JSON.parse($('rawValue').value);
    } catch (e) {
      return toast('Value must be valid JSON', 'error');
    }
    try {
      await patchConfig(path, value);
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
  });

  // --- Tools ----------------------------------------------------------------

  function bindAction(id, actionName, confirmMessage) {
    $(id).addEventListener('click', async () => {
      if (confirmMessage && !confirm(confirmMessage)) return;
      try {
        await action(actionName);
        toast('Action sent: ' + actionName);
      } catch (e) {
        toast('Action failed: ' + e.message, 'error');
      }
    });
  }

  bindAction('actionGravity', 'gravity', 'Re-download all adlists and rebuild gravity?');
  bindAction('actionRestartDns', 'restartdns');
  bindAction('actionFlushLogs', 'flush/logs');
  bindAction('actionFlushArp', 'flush/arp');
  bindAction('actionRestart', 'restart', 'Reboot the Raspberry Pi now?');
  bindAction('actionShutdown', 'shutdown', 'Shut down the Raspberry Pi now?');

  $('downloadBackup').addEventListener('click', () => {
    window.open('/api/pihole/teleporter?token=' + encodeURIComponent(token), '_blank');
  });

  // --- Logs -----------------------------------------------------------------

  let logFollow = false;
  let logTimer = null;

  function formatLog(data) {
    const log = data && data.log ? data.log : data;
    if (!Array.isArray(log)) return typeof log === 'string' ? log : JSON.stringify(log, null, 2);
    return log
      .map(entry => {
        if (typeof entry === 'string') return entry;
        const time = entry.timestamp
          ? new Date(entry.timestamp * 1000).toLocaleTimeString() + ' '
          : '';
        return time + (entry.message || JSON.stringify(entry));
      })
      .join('\n');
  }

  async function loadLogs() {
    const type = $('logType').value;
    const view = $('logView');
    try {
      const data = await api('/logs/' + type);
      view.textContent = formatLog(data) || '(empty)';
      view.scrollTop = view.scrollHeight;
    } catch (e) {
      view.textContent = 'Failed to load logs: ' + e.message;
    }
  }

  $('logRefresh').addEventListener('click', loadLogs);
  $('logType').addEventListener('change', loadLogs);
  $('logFollow').addEventListener('click', () => {
    logFollow = !logFollow;
    $('logFollow').textContent = 'Follow: ' + (logFollow ? 'On' : 'Off');
    $('logFollow').className = logFollow ? 'btn' : 'btn ghost';
    if (logTimer) clearInterval(logTimer);
    if (logFollow) logTimer = setInterval(loadLogs, 3000);
  });

  // --- Official admin iframe ------------------------------------------------

  function loadAdmin() {
    const port = window.piholeAdminProxyPort || 8081;
    const url = window.location.protocol + '//' + window.location.hostname + ':' + port + '/admin/';
    const frame = $('adminFrame');
    if (frame.getAttribute('src') !== url) frame.setAttribute('src', url);
    $('adminOpen').setAttribute('href', url);
  }

  $('adminReload').addEventListener('click', () => {
    const frame = $('adminFrame');
    frame.setAttribute('src', frame.getAttribute('src'));
  });

  // --- Ticker (uptime) ------------------------------------------------------

  // --- Boot -----------------------------------------------------------------

  loadStatus();
  loadBlocking();
  startDashboard();
  socket.on('connect', () => {
    if (currentTab === 'dashboard') startDashboard();
  });
})();
