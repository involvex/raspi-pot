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
- **💻 Integrated Terminal:** Full SSH-like terminal access powered by `xterm.js` and `node-pty`.
- **⚙️ Settings & Security:**
  - Change dashboard passwords securely.
  - Adjust telemetry and process refresh rates for performance optimization.
  - Dark-mode optimized high-fidelity design using the **Space Grotesk** typography.

---

## 🛠 Tech Stack

- **Frontend:** [Svelte 5](https://svelte.dev/), [Vite](https://vitejs.dev/), [Material Icons](https://fonts.google.com/icons).
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
   # Install server dependencies
   npm install

   # Install client dependencies
   cd client && npm install
   cd ..
   ```

3. **Configure Environment:**
   Create a `.env` file in the root directory:

   ```env
   JWT_SECRET=your_secret_here
   ADMIN_PASSWORD=raspberry
   PORT=3000
   ```

4. **Build the Frontend:**

   ```bash
   cd client
   npm run build
   cd ..
   ```

5. **Start RaspiPot:**
   ```bash
   npm start
   ```

Now access the dashboard at `http://your-pi-ip:3000`.

---

## 🛡 Security

- JWT-based authentication for both API and Socket connections.
- Secure password updates stored in environment variables.
- Isolated shell execution via `node-pty`.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

_Built with ❤️ for the Raspberry Pi Community._
