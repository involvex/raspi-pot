# 📡 RaspiPot

**A High-Fidelity Raspberry Pi System Dashboard & Control Center.**

RaspiPot is a modern, web-based management interface designed for Raspberry Pi enthusiasts and cluster admins. It provides real-time telemetry, process management, service control, and network configuration through a sleek, high-performance UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Svelte](https://img.shields.io/badge/frontend-Svelte%205-ff3e00.svg)
![Node](https://img.shields.io/badge/backend-Node.js-339933.svg)
![Raspberry Pi](https://img.shields.io/badge/hardware-Raspberry%20Pi-C51A4A.svg)

---

## ✨ Key Features

- **🚀 Real-Time Telemetry:** Monitor CPU load, RAM usage, SoC temperature, and disk space with zero-latency updates via Socket.io.
- **📊 Advanced Process Manager:** View, sort, and kill system processes. Sort by CPU, Memory, or PID with togglable ascending/descending order.
- **🌐 Network Manager:**
  - Real-time WiFi scanning with dynamic signal strength icons.
  - Connect to new networks via the UI.
  - Manage saved WiFi profiles.
  - Multi-interface IP display (Ethernet + WiFi) in a prominent status capsule.
- **☁️ Cloud Storage Integration:**
  - Connect to Google Drive and Mega.nz for seamless file management.
  - Upload, download, and delete files directly from the dashboard.
  - Secure OAuth2 authentication and encrypted credential storage.
- **🔌 Plugin System:**
  - Extensible architecture with dynamic plugin loading.
  - Install and manage plugins through the web interface.
  - Performance-optimized for Raspberry Pi 2B.
- **🛠 Service Control:** Start, stop, and restart `systemd` services directly from the browser.
- **🕳️ Pi-hole Management (v6):** Native dashboard built on Pi-hole's embedded REST API — live stats, paginated query log, allow/deny lists (exact + regex), adlists, groups, blocking toggle with timers, DNS configuration, gravity updates, log viewer, Teleporter backups, plus the official admin UI embedded via a local proxy.
- **💻 Integrated Terminal:** Full SSH-like terminal access powered by `xterm.js` and `node-pty`, with quick-command buttons, a user/root shell switch and reconnect.
- **⚙️ Settings & Security:**
  - Change dashboard passwords securely.
  - Adjust telemetry and process refresh rates for performance optimization.
  - Dark-mode optimized high-fidelity design using the **Space Grotesk** typography.

---

## 🛠 Tech Stack

- **Frontend:** static HTML/CSS/JS (Material Icons), no build step.
- **Backend:** [Node.js](https://nodejs.org/), [Express](https://expressjs.com/).
- **Communication:** [Socket.io](https://socket.io/) for real-time bi-directional events.
- **System Layer:** [systeminformation](https://systeminformation.io/), [node-pty](https://github.com/microsoft/node-pty), `nmcli` for networking.

---

## 🚀 Quick Start

### Prerequisites

- A Raspberry Pi running Raspberry Pi OS (Debian-based).
- Node.js (v18 or higher recommended).
- `NetworkManager` installed (`sudo apt install network-manager`).

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/raspipot.git
   cd raspipot
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file in the root directory:

   ```env
   JWT_SECRET=your_secret_here
   ADMIN_PASSWORD=raspberry
   PORT=3000

   # Pi-hole v6 (optional)
   PIHOLE_URL=http://127.0.0.1
   PIHOLE_APP_PASSWORD=your_pihole_password
   PIHOLE_ADMIN_PROXY_PORT=8081
   ```

4. **Start RaspiPot:**
   ```bash
   npm start
   ```

Now access the dashboard at `http://your-pi-ip:3000`.

### Development & verification

Formatting is owned by Prettier (`.prettierrc`); ESLint only enforces correctness
(undefined references, unused code, unsound control flow, ...). Keep the two in
sync by running Prettier rather than hand-formatting.

```bash
npm run verify        # the full gate: syntax + lint + format + tests + HTTP smoke test
npm test              # offline structural tests (node --test)
npm run smoke         # boots the server on a throw-away port and probes the API
npm run check         # parses every JS/JSON file
npm run lint          # ESLint, correctness rules only
npm run format        # reformat with Prettier (add format:check in CI)
npm run doctor        # diagnose a "Pi-hole unreachable" error end to end
```

`npm run verify` is the command to trust before committing — it never touches
the running pm2 process or the Pi-hole admin proxy port.

---

## 🕳️ Pi-hole Integration

Requires **Pi-hole v6+** (the web server and REST API are embedded in `pihole-FTL`;
the old PHP/lighttpd web UI is gone). RaspiPot talks to the API server-side and
keeps your Pi-hole password out of the browser.

1. Set the Pi-hole web/server password: `sudo pihole setpassword`
   (or use an app password from **Settings → API** if 2FA is enabled).
2. Point RaspiPot at it in `.env`:
   ```env
   PIHOLE_URL=http://127.0.0.1
   PIHOLE_APP_PASSWORD=your_pihole_password
   ```
3. Open the **Pi-hole** page in the sidebar.

The **Official Admin** tab embeds the stock Pi-hole interface through a small
reverse proxy on `PIHOLE_ADMIN_PROXY_PORT` (default `8081`), so the iframe is
same-origin and Pi-hole's own `/admin` + `/api` paths work untouched.

> If you kept `lighttpd` on port 80, Pi-hole v6 falls back to port `8080` —
> set `PIHOLE_URL=http://127.0.0.1:8080` accordingly.

### "Pi-hole unreachable" — diagnose it

The dashboard shows the exact cause plus a hint. For the full picture run on the
RaspiPot host:

```bash
npm run doctor
```

It prints the configured URL (password masked), the DNS answers, a TCP probe
against every address and port `80`/`8080`, an unauthenticated
`GET /api/info/version`, and a real login attempt. Common results:

| Symptom                                     | Cause                                        | Fix                                                                        |
| ------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| `ECONNREFUSED ::1:80`, `127.0.0.1:80` works | `localhost` resolved to IPv6, FTL binds IPv4 | use `PIHOLE_URL=http://127.0.0.1` (the client now tries IPv4 first anyway) |
| every port refused, `:8080` open            | lighttpd still owns port 80                  | `PIHOLE_URL=http://127.0.0.1:8080`                                         |
| HTTP 404 / HTML on `/api/info/version`      | wrong URL (old admin UI or a proxy)          | point at the web root                                                      |
| `Unauthorized` (401)                        | wrong or empty `PIHOLE_APP_PASSWORD`         | run `sudo pihole setpassword` and copy it into `.env`, then restart        |
| `429`                                       | too many logins/sessions                     | wait a minute, `pm2 restart raspipot`                                      |

Authentication is bound to the **client IP**: RaspiPot must reach Pi-hole from
the same address family it authenticates from (both `127.0.0.1` or both LAN).

---

## 🛡 Security

- JWT-based authentication for both API and Socket connections.
- Secure password updates stored in environment variables.
- Isolated shell execution via `node-pty`.
- The Pi-hole password is held server-side only; the browser never receives it.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

_Built with ❤️ for the Raspberry Pi Community._
