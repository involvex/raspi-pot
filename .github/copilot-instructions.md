# RaspiPot Copilot Instructions

## Project Overview

RaspiPot is a full-stack Raspberry Pi management dashboard with real-time telemetry, process management, cloud storage integration, and an extensible plugin system. It uses **Svelte 5** on the frontend, **Node.js/Express** on the backend, and **Socket.io** for real-time bidirectional communication.

## Build, Test & Lint Commands

### Development
- **Run full dev stack (server + client):** `npm run dev`
  - Server runs on Node.js, client on Vite dev server
- **Run server only:** `npm run server:dev` (uses `node server/index.js`)
- **Run client only:** `cd client && npm run dev`

### Build & Production
- **Build frontend:** `npm run build` (also runs as pre-step in `npm start`)
- **Full production build + start:** `npm start` (builds client, then runs server)

### Code Quality
- **Lint all code:** `npm run lint`
- **Auto-fix lint issues:** `npm run lint:fix` (runs before build)
- **Format all code:** `npm run format`
- **Check formatting without changes:** `npm run format:check`

### Notes
- **No test command yet** - placeholder in package.json
- ESLint uses flat config (`eslint.config.js`) with 2-space indents, single quotes, Unix linebreaks
- Prettier is configured for formatting
- Root runs CommonJS; client is ESM (different `type` fields in respective package.json files)

## High-Level Architecture

### Frontend (Client)
- **Framework:** Svelte 5 + SvelteKit
- **Build tool:** Vite
- **Located:** `client/src` with routes mirroring main features
- **Route structure:** Each feature has dedicated folder:
  - `+layout.svelte` - Main layout component
  - `+page.svelte` - Route handler
  - Feature-specific subdirectories (e.g., `cloud-storage/`, `plugins/`, `services/`, `terminal/`, `processes/`, etc.)
- **Real-time:** Socket.io client for live telemetry, process updates, and terminal I/O
- **Build output:** `client/build/` (static files served by Express)

### Backend (Server)
- **Framework:** Express.js on Node.js
- **Located:** `server/index.js` (main entry point)
- **Communication:**
  - REST API for auth, file uploads, file downloads
  - Socket.io for real-time events (telemetry, terminal, process updates)
- **Key libraries:**
  - `systeminformation` - CPU, memory, disk, temperature monitoring
  - `node-pty` - Terminal emulation (pty spawning)
  - `googleapis` - Google Drive integration
  - `megajs` - Mega.nz integration
  - `jsonwebtoken` - JWT auth

### Plugin System
- **Core files:** `server/plugin-manager.js`, `server/base-plugin.js`
- **Plugin directory:** `plugins/` (loaded dynamically on startup)
- **Manifest:** Each plugin has `plugin.json` with name, version, hooks, permissions
- **Plugin hooks:** `onTelemetryData()`, `onSocketConnection()`, `onSocketDisconnection()`, `onHttpRequest()`
- **Lifecycle:** Plugins loaded → enabled/disabled via API → persisted in `plugins.json`
- **Cloud Storage plugin** is enabled by default at startup
- **Extensibility:** Plugins can add routes, process events, integrate external services

### Data Flow
1. Server collects system metrics via `systeminformation`
2. Socket.io broadcasts telemetry to all connected clients
3. Plugins can hook into telemetry updates and modify/enrich data
4. Terminal I/O and process management happen via pty and Socket.io events
5. Cloud storage operations go through plugin abstraction layer

## Key Conventions & Patterns

### Code Style
- **Indentation:** 2 spaces (ESLint enforced)
- **Quotes:** Single quotes (ESLint enforced)
- **Linebreaks:** Unix (LF, ESLint enforced)
- **Variables:** Unused vars allowed if prefixed with `_`
- **Semicolons:** Always required (ESLint enforced)

### Environment Setup
- Create `.env` in root with:
  ```
  JWT_SECRET=your_secret_key
  ADMIN_PASSWORD=your_password
  PORT=3000
  ```
- Fallback values exist if env vars missing (defaults: `ADMIN_PASSWORD=raspberry`, `JWT_SECRET=fallback_secret`)

### Authentication
- JWT-based for API and Socket connections
- Password is compared against `ADMIN_PASSWORD` env var
- Token includes user identity

### Plugin Development
- Extend `BasePlugin` class from `server/base-plugin.js`
- Override hook methods as needed (e.g., `onTelemetryData()`)
- Define manifest with required fields: `name`, `version`, `main` (entry file)
- Use `this.log()` and `this.error()` for logging
- Plugins must be in `plugins/{plugin-name}/` directory with manifest at `plugins/{plugin-name}/plugin.json`

### File Upload/Download
- Multer configured for file operations
- Upload destination determined by `path` query param or user home directory
- Downloads served via Express static/streaming

### Socket.io Events
- Real-time telemetry, terminal I/O, and plugin communication use Socket.io
- Plugin lifecycle events emit through Socket.io to frontend

## Dependency & Deployment Notes

- **node-pty** requires build tools on target system (Python 3, make, g++ for Raspberry Pi)
- **Front-end packaging:** Uses workspace setup (root and client are separate npm packages)
- **Deployment:** See `DEPLOY.md` for Raspberry Pi-specific installation steps
- **Performance considerations:** Optimized for Raspberry Pi 2B+ (telemetry refresh rates configurable in settings)

## Documentation Resources

- **Plugin System:** `docs/PLUGIN_SYSTEM.md` (architecture, lifecycle, hooks, permissions)
- **Plugin Development:** `docs/PLUGIN_DEVELOPMENT.md` (detailed dev guide with examples)
- **Cloud Storage:** `docs/CLOUD_STORAGE.md`
- **Performance:** `docs/PERFORMANCE.md`
- **Deployment:** `DEPLOY.md`
