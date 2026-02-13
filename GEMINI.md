# GEMINI.md

## Project Overview

**RaspiPot** is a high-fidelity system dashboard and control center specifically designed for Raspberry Pi. It provides real-time telemetry, process management, service control, and a plugin-based architecture for extensibility.

- **Frontend:** Svelte 5 with Vite, using a static adapter for production serving.
- **Backend:** Node.js (Express) with Socket.io for zero-latency telemetry and terminal access via `node-pty`.
- **Key Libraries:** `systeminformation` (telemetry), `node-pty` (terminal), `nmcli` (network management), `jsonwebtoken` (auth).

## Directory Structure

- `client/`: Svelte 5 frontend application.
- `server/`: Backend logic, including the plugin manager and main server entry point.
- `plugins/`: Extensible plugin modules (e.g., `cloud-storage`, `system-monitor`).
- `docs/`: Detailed documentation on subsystems (Cloud Storage, Plugin System, etc.).
- `scripts/`: Maintenance and utility scripts.

## Building and Running

The project uses a root `package.json` with npm workspaces.

- **Development:**
  - `npm run dev`: Starts both the backend and frontend dev servers concurrently.
- **Production:**
  - `npm run build`: Builds the client for production.
  - `npm start`: Builds the client and starts the production Node.js server.
- **Linting & Formatting:**
  - `npm run lint`: Runs ESLint across the project.
  - `npm run lint:fix`: Fixes linting issues automatically.
  - `npm run format`: Formats code using Prettier.

## Development Conventions

- **Plugin Architecture:** Plugins should inherit from `BasePlugin` and implement hooks (e.g., `onTelemetryData`, `onSocketConnection`) to extend functionality.
- **State Management:** The client uses Svelte 5's runes and stores for shared state (auth, socket, tasks).
- **Real-time Data:** Most telemetry and interactive features (terminal, process list) are handled via Socket.io events.
- **Security:** API and Socket connections require JWT authentication. Admin password is managed via `.env`.

## Key Files

- `server/index.js`: Main server entry point and socket event handlers.
- `server/plugin-manager.js`: Logic for loading, enabling, and managing plugins.
- `client/src/routes/+page.svelte`: Dashboard main landing page.
- `plugins.json`: Configuration for enabled/disabled plugins.
