# Deploying RaspiPot to Raspberry Pi

## Prerequisites

- Node.js (v18 or later recommended) installed on Raspberry Pi.
- Build tools (for `node-pty`): `sudo apt-get install -y python3 make g++`

## Steps

1.  **Transfer the Code**
    - Copy the `raspipot` folder to your Raspberry Pi.
    - Example: `scp -r raspipot user@raspberrypi:~/`

2.  **Install Dependencies**
    - On the Pi, navigate to the folder:
      ```bash
      cd raspipot
      npm install
      ```
    - _Note_: `npm install` in the root will compile `node-pty`. This might take a few minutes.

3.  **Configure Environment**
    - Create a `.env` file in the `raspipot` root:
      ```bash
      JWT_SECRET=your_super_secret_key_here
      ADMIN_PASSWORD=your_secure_password
      ```

4.  **Run the Server**
    - Start the application:
      ```bash
      npm start
      ```
    - The app will be available at `http://<raspberrypi-ip>:3000`.

5.  **Run as a Service (Recommended)**
    - Use `pm2` with the bundled ecosystem file so the Node backend (API +
      terminal + Pi-hole proxy) is supervised:
      ```bash
      sudo npm install -g pm2
      pm2 start ecosystem.config.js
      pm2 save
      pm2 startup
      ```

    > Do **not** use `pm2 serve ./public` — the static-only server has no
    > backend, so the terminal, API and Pi-hole integration stop working.

## Pi-hole Integration (v6+)

- Pi-hole v6 embeds its web server and REST API in `pihole-FTL`; no PHP or
  lighttpd is required.
- Set the password and point RaspiPot at it:
  ```bash
  sudo pihole setpassword
  ```
  ```env
  PIHOLE_URL=http://localhost          # or :8080 if lighttpd still owns port 80
  PIHOLE_APP_PASSWORD=<your password>  # or an app password from Settings -> API
  PIHOLE_ADMIN_PROXY_PORT=8081         # port that proxies the official admin UI
  ```
- Verify connectivity from the Pi: `curl http://localhost/api/info/version`.
- The backend should run as a user that can reach `localhost:80`. Actions like
  gravity updates that need root are available from the interactive Terminal
  (root shell) tab.
