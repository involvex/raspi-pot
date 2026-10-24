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
const dns = require('dns');
const net = require('net');
const { URL } = require('url');

const DEFAULT_TIMEOUT = 10000;
const DNS_TTL = 30000;

// Connection-level failures worth retrying against another resolved address.
const RETRYABLE = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'EAI_AGAIN',
]);

const HINTS = {
  ECONNREFUSED:
    'Nothing is listening on that address/port. Pi-hole v6 moves its web server to :8080 when lighttpd still owns :80, and FTL usually binds IPv4 only - prefer http://127.0.0.1 over http://localhost.',
  ENOTFOUND:
    'The hostname does not resolve. Check PIHOLE_URL and the DNS settings of this machine.',
  EAI_AGAIN: 'DNS resolution timed out. Check the resolver on this machine.',
  EHOSTUNREACH: 'The host is not reachable from this machine (routing or firewall).',
  ENETUNREACH: 'No route to the Pi-hole network from this machine.',
  ETIMEDOUT: 'The connection timed out - a firewall is probably dropping the traffic.',
  ECONNRESET: 'The connection was reset by the peer before Pi-hole answered.',
  DEPTH_ZERO_SELF_SIGNED_CERT:
    'Pi-hole uses a self-signed certificate - set PIHOLE_VERIFY_TLS=false to accept it.',
  SELF_SIGNED_CERT_IN_CHAIN:
    'Pi-hole uses a self-signed certificate - set PIHOLE_VERIFY_TLS=false to accept it.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:
    'The TLS chain cannot be verified - set PIHOLE_VERIFY_TLS=false for a self-signed Pi-hole.',
  CERT_HAS_EXPIRED: 'The Pi-hole TLS certificate has expired.',
};

/**
 * Turn anything thrown into a non-empty message plus an error code.
 *
 * `http.request` can surface `Error("unknown error")` when libuv has an errno
 * it cannot name, and a rejection may carry no Error at all. Both used to reach
 * the UI as the useless text "unknown error", so normalise aggressively here.
 */
function normalizeError(err) {
  const cause = err && err.cause ? err.cause : null;
  const code = (err && err.code) || (cause && cause.code) || null;

  let message = err && typeof err.message === 'string' ? err.message.trim() : '';

  if (!message) {
    if (typeof err === 'string') message = err.trim();
    else if (code) message = `Network error (${code})`;
    else if (err && err.name) message = `${err.name} (no message)`;
    else message = 'Unknown error';
  }

  if (message === 'unknown error' || message === 'Unknown error') {
    if (code) message = `Network error (${code})`;
    else if (err && err.status) message = `Pi-hole API error (HTTP ${err.status})`;
  }

  return { message, code };
}

/** Message + code + a human hint for the dashboard and the doctor script. */
function describeError(err) {
  const { message, code } = normalizeError(err);
  let hint = code && HINTS[code] ? HINTS[code] : null;

  if (!hint && err && err.status === 401) {
    hint =
      'Pi-hole rejected the password. Run "pihole setpassword" (or create an app password under Settings > API) and put it in PIHOLE_APP_PASSWORD.';
  } else if (!hint && err && err.status === 403) {
    hint = 'Pi-hole refused the session (CSRF). Restart RaspiPot to open a fresh session.';
  } else if (!hint && err && err.status === 429) {
    hint =
      'Pi-hole is rate-limiting logins or the session limit is reached. Wait a minute and retry.';
  } else if (!hint && err && err.status === 404) {
    hint =
      'The URL answered, but not with the Pi-hole API. Check that PIHOLE_URL points at the Pi-hole web root (usually http://127.0.0.1 or http://127.0.0.1:8080).';
  }

  return { message, code, status: err && err.status ? err.status : null, hint };
}

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
    const baseUrl = options.baseUrl || process.env.PIHOLE_URL || 'http://127.0.0.1';
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
    this._dnsCache = new Map();
  }

  /** Password is read lazily so runtime env changes / dotenv order don't matter. */
  get password() {
    return this._password !== undefined
      ? this._password
      : process.env.PIHOLE_APP_PASSWORD || process.env.PIHOLE_PASSWORD || '';
  }

  /**
   * Raw single request. Resolves `{ status, data, contentType }`; only
   * transport failures reject (HTTP error codes are returned as data).
   *
   * Hostnames are resolved up front and every address is tried in turn. This
   * matters on modern Node: `localhost` often resolves to `::1` first while
   * Pi-hole's FTL webserver only binds IPv4, which made a perfectly healthy
   * Pi-hole look unreachable over the loopback interface.
   */
  async _raw(method, apiPath, body) {
    let url;
    try {
      url = new URL(this.baseUrl + apiPath);
    } catch (e) {
      throw new PiholeError(`Invalid Pi-hole URL: ${this.baseUrl}${apiPath}`, 500);
    }

    const isHttps = url.protocol === 'https:';
    const port = Number(url.port) || (isHttps ? 443 : 80);
    const payload = body === undefined || body === null ? null : JSON.stringify(body);

    const headers = { Accept: 'application/json', Host: url.host };
    if (this.sid) headers['X-FTL-SID'] = this.sid;
    if (this.csrf && method !== 'GET' && method !== 'HEAD') headers['X-FTL-CSRF'] = this.csrf;
    if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const targets = await this._targets(url.hostname);
    const attempts = [];

    for (const target of targets) {
      try {
        return await this._send({ method, url, target, port, headers, payload });
      } catch (err) {
        const info = normalizeError(err);
        const retryable =
          err instanceof PiholeError ? err.code === 'ETIMEDOUT' : RETRYABLE.has(info.code);
        if (!retryable) throw err;
        attempts.push({ address: target.address, family: target.family, ...info });
      }
    }

    const tried = targets.map(target => `${formatAddress(target.address)}:${port}`).join(', ');
    const last = attempts[attempts.length - 1] || { message: 'no address answered', code: null };
    const error = new PiholeError(
      `Cannot reach Pi-hole at ${this.baseUrl} (tried ${tried}): ${last.message}`,
      502,
      { attempts }
    );
    error.code = last.code;
    error.attempts = attempts;
    throw error;
  }

  /** Resolve the configured host to candidate addresses, IPv4 first. */
  async _targets(hostname) {
    const host = stripBrackets(hostname);
    const literal = net.isIP(host);
    if (literal) return [{ address: host, family: literal }];

    const cached = this._dnsCache.get(host);
    if (cached && cached.expires > Date.now()) return cached.list;

    let list;
    try {
      list = await dns.promises.lookup(host, { all: true });
    } catch (err) {
      const info = normalizeError(err);
      const error = new PiholeError(`Cannot resolve ${host}: ${info.message}`, 502, info);
      error.code = info.code || 'ENOTFOUND';
      throw error;
    }

    // FTL's webserver normally binds IPv4 only, so try A records before AAAA.
    const ordered = [
      ...list.filter(entry => entry.family === 4),
      ...list.filter(entry => entry.family === 6),
    ];
    const result = ordered.length ? ordered : [{ address: host, family: 0 }];

    this._dnsCache.set(host, { expires: Date.now() + DNS_TTL, list: result });
    return result;
  }

  /** One request against one concrete address. */
  _send({ method, url, target, port, headers, payload }) {
    return new Promise((resolve, reject) => {
      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;
      const literal = net.isIP(target.address) !== 0;

      const req = transport.request(
        {
          protocol: url.protocol,
          host: target.address,
          port,
          path: url.pathname + url.search,
          method,
          headers,
          rejectUnauthorized: isHttps ? this.verifyTls : undefined,
          servername: isHttps && !literal ? stripBrackets(url.hostname) : undefined,
          timeout: this.timeout,
        },
        res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => resolve(parseResponse(res, Buffer.concat(chunks))));
        }
      );

      req.on('timeout', () => {
        const error = new PiholeError(`Pi-hole request timed out after ${this.timeout} ms`, 504);
        error.code = 'ETIMEDOUT';
        req.destroy(error);
      });
      req.on('error', reject);

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
        const reason =
          detail ||
          (res.status === 200
            ? 'Pi-hole returned no session (is PIHOLE_URL the web root?)'
            : `Pi-hole login failed (HTTP ${res.status})`);
        throw new PiholeError(reason, res.status === 200 ? 401 : res.status, res.data);
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

function stripBrackets(hostname) {
  return hostname.replace(/^\[/, '').replace(/\]$/, '');
}

function formatAddress(address) {
  return net.isIP(address) === 6 ? `[${address}]` : address;
}

function parseResponse(res, buffer) {
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

  return { status: res.statusCode, data, contentType };
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

module.exports = { PiholeClient, PiholeError, pihole, describeError, normalizeError };
