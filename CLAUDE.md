# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RaspiPot is a web-based Raspberry Pi management dashboard providing real-time telemetry, process management, service control, network configuration, cloud storage integration, and an extensible plugin system. Optimized for Raspberry Pi 2B with adaptive performance intervals.

## Development Commands

### Running the Application
```bash
npm run dev          # Start both server and client in dev mode (runs concurrently)
npm run server:dev    # Start server only (node server/index.js)
npm run client:dev    # Start client only (cd client && npm run dev)
```

### Building and Production
```bash
npm run build        # Build frontend for production
npm start            # Build client and start server (production mode)
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Format all code with Prettier
npm run format:check # Check formatting without changes
```

### Module System Notes
- **Root package**: CommonJS (`"type": "commonjs"`)
- **Client package**: ESM (`"type": "module"`)
- This affects how imports work in each part of the codebase

## Architecture

### Directory Structure
```
raspi-pot/
├── client/           # SvelteKit frontend (ESM)
│   ├── src/routes/   # SvelteKit file-based routing
│   └── build/        # Static build output (served by Express)
├── server/           # Express.js backend (CommonJS)
│   ├── index.js       # Main server entry point
│   ├── plugin-manager.js
│   └── base-plugin.js  # Plugin base class
├── plugins/           # Dynamic plugin loading directory
└── docs/            # Plugin development guides
```

### Plugin System (Core Extensibility)

The plugin system is the primary way to extend RaspiPot functionality:

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

## Code Style (ESLint Enforced)

- **Indentation:** 2 spaces
- **Quotes:** Single quotes
- **Linebreaks:** Unix (LF)
- **Unused vars:** Allowed if prefixed with `_`
- **Semicolons:** Required

See `eslint.config.js` for full rules.

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
