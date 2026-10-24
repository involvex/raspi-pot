# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RaspiPot is a web-based Raspberry Pi management dashboard providing real-time telemetry, process management, service control, network configuration, cloud storage integration, and an extensible plugin system. Optimized for Raspberry Pi 2B with adaptive performance intervals.

## Development Commands

### Running the Application

```bash
npm run dev          # Start the server (node server/index.js)
npm start            # Same as dev
npm run serve        # pm2 start server/index.js --name raspipot
npm run logs         # pm2 logs raspipot
```

There is **no client build**: the UI is plain static HTML/CSS/JS in `public/`,
served directly by Express.

### Verification

```bash
npm run verify        # Full gate: syntax + ESLint + Prettier + tests + HTTP smoke test
npm test              # Offline structural tests (node --test test/verify.test.js)
npm run smoke         # Boot the server on a throw-away port and probe the API
npm run check         # Parse every JS/JSON file
npm run lint          # ESLint (correctness rules only)
npm run lint:fix      # ESLint with --fix
npm run format        # Reformat everything with Prettier (owns all formatting)
npm run format:check  # Verify formatting without changing anything
```

Prefer `npm run verify` before claiming work is done: it never touches the
running pm2 process or the Pi-hole admin proxy port.

### Module System Notes

- The project is CommonJS (`"type": "commonjs"`) - use `require`.
- Formatting is owned by Prettier (`.prettierrc`); ESLint only enforces
  correctness. Run `npm run format` rather than hand-formatting - the two used
  to conflict over quotes, trailing commas and `async (…) =>` spacing.

## Architecture

### Directory Structure

```
raspi-pot/
├── public/            # Static UI (HTML + CSS + JS) served by Express
│   ├── js/app.js      # Shared shell: auth, socket, navigation
│   ├── js/pihole.js   # Pi-hole v6 management UI
│   └── vendor/        # Vendored xterm.js (ignored by lint + format)
├── server/            # Express backend (CommonJS)
│   ├── index.js       # Main server entry point (API, sockets, PTY, telemetry)
│   ├── pihole.js      # Pi-hole v6 REST client (session auth)
│   └── pihole-proxy.js # Reverse proxy for the official Pi-hole admin UI
├── scripts/           # Verification tooling (check-syntax, lint, smoke, verify)
├── test/              # node:test suites
└── archive/           # Retired code (old SvelteKit client, plugin system)
```

### Plugin System (currently archived)

> **Status:** the plugin runtime is **not wired into `server/index.js`** today.
> `plugin-manager.js`, `base-plugin.js` and the bundled plugins live in
> `archive/` and are excluded from lint/format. The notes below describe that
> retired design - do not assume it runs.

The plugin system used to be the primary way to extend RaspiPot functionality:

**Key Files:**

- `server/plugin-manager.js` - Manages plugin lifecycle, loading, and hook execution
- `server/base-plugin.js` - Base class all plugins extend
- `plugins.json` - Persists enabled/disabled plugin state

**Plugin Structure:**

```
plugins/[plugin-name]/
├── plugin.json    # Manifest: name, version, main, author, description
└── index.js       # Extends BasePlugin, implements hooks
```

**Available Hooks:**

- `onTelemetryData(data)` - Modify/extend telemetry stats before broadcast
- `onSocketConnection(socket)` - Handle new socket connections
- `onSocketDisconnection(socket)` - Handle disconnections
- `onHttpRequest(req, res, next)` - Add custom HTTP routes

**Plugin Lifecycle:**

1. Plugin manager loads all plugins from `plugins/` on startup
2. Plugins from `plugins.json` are auto-enabled
3. Plugins can be enabled/disabled via REST API `/api/plugins`
4. Hook methods called on relevant events across all enabled plugins

**Example Plugin:** `plugins/cloud-storage/`

- Implements Google Drive and Mega.nz integration
- Extends HTTP routes under `/api/cloud-storage/`
- Uses OAuth2 tokens with encrypted credential storage

### Real-Time Communication Architecture

**Socket.io Events Pattern:**

- Server uses Socket.io for real-time telemetry, terminal I/O, and plugin events
- Client connects with JWT token via `socket.handshake.auth.token`
- All telemetry broadcast to connected clients via `io.emit('telemetry:stats', data)`
- Plugins can modify telemetry data through `onTelemetryData()` hook before broadcast

**Adaptive Telemetry (Pi 2B Optimization):**

- Fast telemetry (CPU, memory, temp): 3-10s adaptive interval based on CPU load
- Slow telemetry (disk, network): Fixed 60s interval
- Expensive memory/temp calls cached for 10s
- CPU > 80%: interval slows to 10s; CPU < 20%: interval speeds to 3s

### Authentication Flow

```
Client → POST /api/login with password
Server → Returns JWT token (24h expiry)
Client → Includes token in Authorization header OR query param
Server → Middleware validates token via authenticateToken()
```

**Note:** Downloads support token via query param for direct browser access.

### Frontend-Backend Communication

**REST API (for auth, uploads, downloads):**

- `/api/login` - Get JWT token
- `/api/files/download` - Download files (requires auth)
- `/api/files/upload` - Upload files (requires auth, multer)
- `/api/plugins/*` - Plugin management endpoints
- `/api/cloud-storage/*` - Cloud storage (delegated to plugin)

**Socket.io (real-time, terminal, processes):**

- `telemetry:stats` - System metrics broadcast
- `terminal:*` - PTY terminal I/O
- `processes:*` - Process list and control
- `services:*` - Systemd service management
- `network:*` - WiFi scanning and connection
- `files:*` - File manager operations

### Environment Configuration

Create `.env` in root:

```env
JWT_SECRET=your_secret_here
ADMIN_PASSWORD=raspberry
PORT=3000
```

Fallback values exist if missing, but production should always define these.

## Code Style

Formatting is owned by **Prettier** (`.prettierrc`): 2 spaces, single quotes,
LF, `printWidth: 100`, `arrowParens: "avoid"`.

**ESLint** (`eslint.config.js`) enforces correctness only - `eslint:recommended`
plus `no-console`:

- **Undefined references:** `no-undef` against the node + browser globals.
- **Unused vars:** warned, allowed when prefixed with `_`.
- **Empty blocks / unsound control flow:** `no-empty`, `no-case-declarations`,
  `no-fallthrough`, `getter-return`, `no-useless-assignment`.

Third-party bundles (`public/vendor/**`) and `archive/**` are ignored by both,
so vendor code is never reformatted or linted.

## Important Implementation Patterns

### Plugin HTTP Routes

Plugins can extend the API by implementing `onHttpRequest(req, res, next)`:

```javascript
onHttpRequest(req, res, next) {
  if (req.path.startsWith('/api/my-plugin')) {
    // Handle plugin routes
    return;
  }
  next(); // Pass to next handler
}
```

### Terminal PTY Integration

Terminal uses `node-pty` for persistent shell processes:

- Each socket connection gets its own pty process
- Process killed on socket disconnect
- Supports resize events for proper terminal rendering

### File Upload/Download

- **Upload:** Multer handles multipart/form-data, destination from `path` query or home dir
- **Download:** Express `res.download()` with dotfiles allowed for hidden files

## Dependencies for Raspberry Pi

**node-pty** requires native build tools on target system:

- Python 3
- make
- g++

On Raspberry Pi: `sudo apt install python3 build-essential`

## Additional Documentation

- `docs/PLUGIN_SYSTEM.md` - Plugin architecture details
- `docs/PLUGIN_DEVELOPMENT.md` - Plugin development guide
- `docs/CLOUD_STORAGE.md` - Cloud storage integration
- `docs/PERFORMANCE.md` - Performance optimization notes
- `DEPLOY.md` - Raspberry Pi deployment steps
