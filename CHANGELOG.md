# Unreleased

### Features

- **pihole:** native Pi-hole v6 management UI - live dashboard with 24h chart, paginated query log, allow/deny lists (exact + regex), adlists, groups, blocking toggle with timers, DNS config editor, gravity/flush actions, log viewer and Teleporter backups
- **pihole:** embed the official Pi-hole admin UI via a dependency-free reverse proxy (`PIHOLE_ADMIN_PROXY_PORT`, default 8081)
- **pihole:** server-side session handling keeps the Pi-hole password out of the browser (`server/pihole.js`)
- **terminal:** add user/root shell switch, session restart, clearer connect/exit status and Pi-hole quick-command buttons
- **tooling:** `npm run verify` gate - syntax check, ESLint, Prettier check, offline tests and a live HTTP smoke test
- **tooling:** new `npm test` (node:test structural suite), `npm run smoke`, `npm run check` scripts
- **tooling:** `npm run doctor` diagnoses "Pi-hole unreachable" - config, DNS answers, per-address TCP probes on 80/8080, unauthenticated API check and a real login
- **docs:** Pi-hole v6 setup notes, `ecosystem.config.js` for pm2, expanded `.env.example`, troubleshooting table for unreachable Pi-hole

### Bug Fixes

- **pihole:** never report a bare "unknown error" - failures are normalised to a message plus errno, and `/api/pihole/status` now returns `code`/`status`/`hint` (e.g. `ECONNREFUSED` explains the `:8080` fallback, `401` points at `pihole setpassword`)
- **pihole:** resolve the configured host once and try **every** address, IPv4 first - Node resolves `localhost` to `::1` first while `pihole-FTL` binds IPv4, which made a healthy Pi-hole look unreachable
- **pihole:** a non-JSON answer (wrong URL) now reports the HTTP status instead of "authentication failed"
- **lint:** stop ESLint from linting third-party bundles (`public/vendor`) and archived code
- **lint:** resolve `no-empty`, `no-unused-vars` and `no-useless-assignment` findings in `server/index.js` and `public/js/pihole.js`
- **lint:** ESLint now only enforces correctness; Prettier owns all formatting, removing the config conflict over quotes, trailing commas and `async (…) =>` spacing
- **telemetry:** drop a redundant `systeminformation.networkInterfaces()` call on the network status path

### Chores

- **deps:** upgrade to ESLint 10 with an explicit `@eslint/js` + `globals`, and refresh express, socket.io, dotenv (17 -> 18), multer, systeminformation, fs-extra, megajs and prettier
- **deps:** keep `googleapis` at 128.x on purpose - 186.x requires Node >= 22 and is only used by the archived cloud-storage plugin
- **deps:** drop unused `@sveltejs/kit`/`@sveltejs/adapter-static` stubs and `concurrently` (the UI is plain static HTML, there is no client build)
- **deps:** add `.prettierignore` so `npm run format` no longer rewrites vendor bundles or the lockfile

# 1.0.0 (2026-02-13)

### Features

- **plugin:** add cloud storage plugin with settings management ([92e78e3](https://github.com/involvex/raspi-pot/commit/92e78e35f7bf0f241bc901269a5a647140d5a64c))
- **plugin:** enhance cloud storage plugin with settings persistence and improved API handling ([63b3bb1](https://github.com/involvex/raspi-pot/commit/63b3bb1576265533057db8a6f6af7f49729f7701))
