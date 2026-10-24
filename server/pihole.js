'use strict';

/**
 * Pi-hole v6 API client.
 *
 * Talks to the REST API embedded in `pihole-FTL` (v6+). Authentication is
 * session based: we POST the password/app-password to `/api/auth`, keep the
 * returned session id (SID) and CSRF token, and replay them on every request.
 * A single re-authentication attempt is made when the API answers 401.
 *
 * No third-party dependencies - uses the Node core http/https modules so we
 * can control TLS verification without pulling in a global agent.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_TIMEOUT = 10000;

class PiholeError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'PiholeError';
    this.status = status || 502;
    this.detail = detail || null;
  }
}

class PiholeClient {
  constructor(options = {}) {
    const baseUrl = options.baseUrl || process.env.PIHOLE_URL || 'http://localhost';
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this._password = options.password;
    this.verifyTls =
      String(
        options.verifyTls !== undefined
          ? options.verifyTls
          : process.env.PIHOLE_VERIFY_TLS || 'true'
      ).toLowerCase() !== 'false';
    this.timeout = options.timeout || DEFAULT_TIMEOUT;

    this.sid = null;
    this.csrf = null;
    this._loginPromise = null;
  }

  /** Password is read lazily so runtime env changes / dotenv order don't matter. */
  get password() {
    return this._password !== undefined
      ? this._password
      : process.env.PIHOLE_APP_PASSWORD || process.env.PIHOLE_PASSWORD || '';
  }

  /** Raw single request. Resolves `{ status, data }`, never throws on HTTP errors. */
  _raw(method, apiPath, body) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        url = new URL(this.baseUrl + apiPath);
      } catch (e) {
        return reject(new PiholeError(`Invalid Pi-hole URL: ${this.baseUrl}${apiPath}`, 500));
      }

      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;
      const payload = body === undefined || body === null ? null : JSON.stringify(body);

      const headers = { Accept: 'application/json' };
      if (this.sid) headers['X-FTL-SID'] = this.sid;
      if (this.csrf && method !== 'GET' && method !== 'HEAD') headers['X-FTL-CSRF'] = this.csrf;
      if (payload !== null) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = transport.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers,
          rejectUnauthorized: isHttps ? this.verifyTls : undefined,
          timeout: this.timeout,
        },
        res => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const contentType = res.headers['content-type'] || '';
            let data = buffer;
            if (contentType.includes('application/json') || (!contentType && buffer.length)) {
              const text = buffer.toString('utf8');
              if (text) {
                try {
                  data = JSON.parse(text);
                } catch (e) {
                  data = text;
                }
              } else {
                data = null;
              }
            } else if (!buffer.length) {
              data = null;
            }
            resolve({ status: res.statusCode, data, contentType });
          });
        }
      );

      req.on('timeout', () => req.destroy(new PiholeError('Pi-hole request timed out', 504)));
      req.on('error', err => {
        if (err instanceof PiholeError) return reject(err);
        reject(new PiholeError(`Cannot reach Pi-hole at ${this.baseUrl}: ${err.message}`, 502));
      });

      if (payload !== null) req.write(payload);
      req.end();
    });
  }

  /** Log in (idempotent, de-duplicated while in flight). */
  _login() {
    if (this._loginPromise) return this._loginPromise;

    this._loginPromise = (async () => {
      const res = await this._raw('POST', '/api/auth', { password: this.password });
      const session = res.data && res.data.session;
      if (res.status !== 200 || !session || !session.sid) {
        const detail = res.data && res.data.error ? res.data.error.message : null;
        throw new PiholeError(
          detail || 'Pi-hole authentication failed',
          res.status === 200 ? 401 : res.status,
          res.data
        );
      }
      this.sid = session.sid;
      this.csrf = session.csrf;
      return session;
    })().finally(() => {
      this._loginPromise = null;
    });

    return this._loginPromise;
  }

  /** Authenticated request with one automatic re-auth retry on 401. */
  async _request(method, apiPath, body) {
    if (!this.sid) await this._login();

    let res = await this._raw(method, apiPath, body);

    if (res.status === 401 && this.password) {
      this.sid = null;
      this.csrf = null;
      await this._login();
      res = await this._raw(method, apiPath, body);
    }

    if (res.status >= 200 && res.status < 300) return res.data;

    const message =
      res.data && res.data.error && res.data.error.message
        ? res.data.error.message
        : `Pi-hole API error (HTTP ${res.status})`;
    throw new PiholeError(message, res.status, res.data);
  }

  /** Fetch a binary payload (used by Teleporter backup). */
  async _binary(apiPath) {
    if (!this.sid) await this._login();
    let res = await this._raw('GET', apiPath);
    if (res.status === 401 && this.password) {
      this.sid = null;
      this.csrf = null;
      await this._login();
      res = await this._raw('GET', apiPath);
    }
    if (res.status >= 200 && res.status < 300)
      return { data: res.data, contentType: res.contentType };
    throw new PiholeError(`Pi-hole download failed (HTTP ${res.status})`, res.status, res.data);
  }

  async logout() {
    if (!this.sid) return;
    try {
      await this._raw('DELETE', '/api/auth');
    } catch (e) {
      /* best effort */
    }
    this.sid = null;
    this.csrf = null;
  }

  // --- Info / health -------------------------------------------------------

  async getVersion() {
    return this._request('GET', '/api/info/version');
  }

  async getInfo(kind = 'system') {
    return this._request('GET', `/api/info/${kind}`);
  }

  async isReachable() {
    try {
      await this._request('GET', '/api/info/version');
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- Stats ---------------------------------------------------------------

  async getSummary() {
    return this._request('GET', '/api/stats/summary');
  }

  async getTopDomains(blocked = false, count = 10) {
    return this._request(
      'GET',
      `/api/stats/top_domains?blocked=${blocked ? 'true' : 'false'}&count=${count}`
    );
  }

  async getTopClients(blocked = false, count = 10) {
    return this._request(
      'GET',
      `/api/stats/top_clients?blocked=${blocked ? 'true' : 'false'}&count=${count}`
    );
  }

  async getUpstreams() {
    return this._request('GET', '/api/stats/upstreams');
  }

  async getRecentBlocked(count = 1) {
    return this._request('GET', `/api/stats/recent_blocked?count=${count}`);
  }

  async getHistory(params = {}) {
    return this._request('GET', `/api/history${toQuery(params)}`);
  }

  // --- Query log -----------------------------------------------------------

  async getQueries(params = {}) {
    return this._request('GET', `/api/queries${toQuery(params)}`);
  }

  // --- Blocking ------------------------------------------------------------

  async getBlocking() {
    return this._request('GET', '/api/dns/blocking');
  }

  async setBlocking(blocking, timer = null) {
    const body = { blocking: !!blocking };
    if (timer !== null && timer !== undefined) body.timer = Number(timer);
    return this._request('POST', '/api/dns/blocking', body);
  }

  // --- Allow / deny lists --------------------------------------------------

  async getDomains(list, kind) {
    return this._request('GET', `/api/domains/${list}/${kind}`);
  }

  async getAllDomains() {
    return this._request('GET', '/api/domains');
  }

  async addDomain(list, kind, domain, extra = {}) {
    return this._request('POST', `/api/domains/${list}/${kind}/${encodeURIComponent(domain)}`, {
      comment: extra.comment || null,
      groups: extra.groups || [0],
      enabled: extra.enabled !== false,
    });
  }

  async updateDomain(list, kind, domain, extra = {}) {
    return this._request(
      'PUT',
      `/api/domains/${list}/${kind}/${encodeURIComponent(domain)}`,
      extra
    );
  }

  async deleteDomain(list, kind, domain) {
    return this._request('DELETE', `/api/domains/${list}/${kind}/${encodeURIComponent(domain)}`);
  }

  // --- Adlists -------------------------------------------------------------

  async getLists() {
    return this._request('GET', '/api/lists');
  }

  async addList(address, extra = {}) {
    return this._request('POST', '/api/lists', {
      address,
      comment: extra.comment || null,
      groups: extra.groups || [0],
      enabled: extra.enabled !== false,
    });
  }

  async updateList(address, extra = {}) {
    return this._request('PUT', `/api/lists/${encodeURIComponent(address)}`, extra);
  }

  async deleteList(address) {
    return this._request('DELETE', `/api/lists/${encodeURIComponent(address)}`);
  }

  // --- Groups --------------------------------------------------------------

  async getGroups() {
    return this._request('GET', '/api/groups');
  }

  async addGroup(name, comment = null) {
    return this._request('POST', '/api/groups', { name, comment, enabled: true });
  }

  async deleteGroup(name) {
    return this._request('DELETE', `/api/groups/${encodeURIComponent(name)}`);
  }

  // --- Config (TOML tree exposed as dotted paths) --------------------------

  async getConfig(path) {
    return this._request('GET', `/api/config/${path}`);
  }

  async patchConfig(path, value) {
    return this._request('PATCH', `/api/config/${path}`, value);
  }

  // --- Actions -------------------------------------------------------------

  async runAction(action) {
    return this._request('POST', `/api/action/${action}`);
  }

  // --- Logs ----------------------------------------------------------------

  async getLogs(type = 'ftl', nextId = null) {
    const q = nextId !== null && nextId !== undefined ? `?nextID=${nextId}` : '';
    return this._request('GET', `/api/logs/${type}${q}`);
  }

  // --- Misc ----------------------------------------------------------------

  async getDhcpLeases() {
    return this._request('GET', '/api/dhcp/leases');
  }

  async getNetworkDevices() {
    return this._request('GET', '/api/network/devices');
  }

  async getTeleporter() {
    return this._binary('/api/teleporter');
  }
}

function toQuery(params) {
  const parts = [];
  Object.keys(params).forEach(key => {
    const value = params[key];
    if (value === undefined || value === null || value === '') return;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

const pihole = new PiholeClient();

module.exports = { PiholeClient, PiholeError, pihole };
