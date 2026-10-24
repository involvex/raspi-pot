# GEMINI.md

## Project Overview

**RaspiPot** is a high-fidelity system dashboard and control center specifically designed for Raspberry Pi. It provides real-time telemetry, process management, service control, and a plugin-based architecture for extensibility.

- **Frontend:** static HTML/CSS/JS served by Express (no build step).
- **Backend:** Node.js (Express) with Socket.io for zero-latency telemetry and terminal access via `node-pty`.
- **Key Libraries:** `systeminformation` (telemetry), `node-pty` (terminal), `nmcli` (network management), `jsonwebtoken` (auth).

## Directory Structure

- `public/`: Static UI (HTML pages, `js/app.js`, `js/pihole.js`) plus vendored `xterm.js`.
- `server/`: Backend logic - `index.js` (entry point), `pihole.js` (Pi-hole v6 client), `pihole-proxy.js`.
- `scripts/`: Verification tooling (`check-syntax.js`, `lint.js`, `smoke-server.js`, `verify.js`).
- `test/`: `node:test` suites.
- `archive/`: Retired code (former SvelteKit client, plugin system and bundled plugins).

## Building and Running

There is no client build - the UI is plain static files under `public/`.

- **Development:**
  - `npm run dev`: Starts the backend (Express + Socket.io) on `PORT` (default 3000).
- **Production:**
  - `npm start`: Starts the production Node.js server.
  - `npm run serve`: Starts it under pm2 (`ecosystem.config.js`).
- **Verification:**
  - `npm run verify`: Full gate - syntax, ESLint, Prettier, tests and an HTTP smoke test.
  - `npm run lint`: ESLint (correctness rules only).
  - `npm run format`: Formats code using Prettier (owns all formatting).

## Development Conventions

- **Formatting:** Prettier (`.prettierrc`) owns style; ESLint only enforces correctness. Never hand-format - run `npm run format`.
- **Real-time Data:** Most telemetry and interactive features (terminal, process list) are handled via Socket.io events.
- **Security:** API and Socket connections require JWT authentication. Admin password is managed via `.env`.

## Key Files

- `server/index.js`: Main server entry point and socket event handlers.
- `server/pihole.js`: Pi-hole v6 REST client (session auth, CSRF, auto re-auth).
- `server/pihole-proxy.js`: Reverse proxy that embeds the official Pi-hole admin UI.
- `public/index.html`: Dashboard main landing page.
- `public/js/app.js`: Shared shell - auth, socket setup and navigation.
