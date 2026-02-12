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
      cd client && npm install && cd ..
      ```
    - _Note_: `npm install` in the root will compile `node-pty`. This might take a few minutes.

3.  **Configure Environment**
    - Create a `.env` file in the `raspipot` root:
      ```bash
      JWT_SECRET=your_super_secret_key_here
      ADMIN_PASSWORD=your_secure_password
      ```

4.  **Build the Frontend**
    - Build the SvelteKit app for production:
      ```bash
      npm run build
      ```
    - This compiles the SvelteKit app into static files in `client/build`.

5.  **Run the Server**
    - Start the application:
      ```bash
      npm start
      ```
    - The app will be available at `http://<raspberrypi-ip>:3000`.

6.  **Run as a Service (Optional but Recommended)**
    - Use `pm2` to keep the app running:
      ```bash
      sudo npm install -g pm2
      pm2 start npm --name "raspipot" -- start
      pm2 save
      pm2 startup
      ```
