const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const pty = require('node-pty');
const os = require('os');
const { exec } = require('child_process');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const si = require('systeminformation');
const fs_extra = require('fs-extra');
const multer = require('multer');
require('dotenv').config();
const { pihole, describeError } = require('./pihole');
const { startPiholeProxy } = require('./pihole-proxy');

const app = express();
const server = http.createServer(app);

// Configure Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetPath = req.query.path || os.homedir();
    cb(null, targetPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'raspberry';

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Login Route
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: 'Invalid password' });
});

// Middleware to verify JWT for API routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// API Placeholder (Protected)
app.get('/api/health', authenticateToken, (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// File Download
app.get('/api/files/download', authenticateToken, (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).send('Path required');

  const absolutePath = path.resolve(filePath);
  res.download(absolutePath, path.basename(absolutePath), { dotfiles: 'allow' }, err => {
    if (err && !res.headersSent) {
      res.status(404).send('File not found');
    }
  });
});

// File Upload
app.post('/api/files/upload', authenticateToken, upload.single('file'), (req, res) => {
  res.json({ success: true, message: 'File uploaded' });
});

// --- Pi-hole v6 REST API bridge (JWT protected, session held server-side) ---
// Keeps the Pi-hole password/app-password out of the browser entirely.
const VALID_LISTS = ['allow', 'deny'];
const VALID_KINDS = ['exact', 'regex'];

const sendPiholeError = (res, err) => {
  const status = err && err.status >= 400 && err.status < 600 ? err.status : 502;
  const info = describeError(err);
  res.status(status).json({ error: info.message, code: info.code, hint: info.hint });
};

const piholeRoute = handler => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    sendPiholeError(res, err);
  }
};

app.get(
  '/api/pihole/status',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const adminProxy = {
      enabled: String(process.env.PIHOLE_ENABLE_PROXY || 'true').toLowerCase() !== 'false',
      port: Number(process.env.PIHOLE_ADMIN_PROXY_PORT || 8081),
    };
    try {
      const version = await pihole.getVersion();
      res.json({ reachable: true, url: pihole.baseUrl, version, adminProxy });
    } catch (err) {
      const info = describeError(err);
      res.json({
        reachable: false,
        url: pihole.baseUrl,
        error: info.message,
        code: info.code,
        status: info.status,
        hint: info.hint,
        adminProxy,
      });
    }
  })
);

app.get(
  '/api/pihole/version',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.getVersion()))
);
app.get(
  '/api/pihole/summary',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.getSummary()))
);
app.get(
  '/api/pihole/history',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.getHistory(req.query)))
);
app.get(
  '/api/pihole/queries',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.getQueries(req.query)))
);
app.get(
  '/api/pihole/stats/top_domains',
  authenticateToken,
  piholeRoute(async (req, res) =>
    res.json(
      await pihole.getTopDomains(req.query.blocked === 'true', Number(req.query.count) || 10)
    )
  )
);
app.get(
  '/api/pihole/stats/top_clients',
  authenticateToken,
  piholeRoute(async (req, res) =>
    res.json(
      await pihole.getTopClients(req.query.blocked === 'true', Number(req.query.count) || 10)
    )
  )
);
app.get(
  '/api/pihole/stats/upstreams',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.getUpstreams()))
);
app.get(
  '/api/pihole/stats/recent_blocked',
  authenticateToken,
  piholeRoute(async (req, res) =>
    res.json(await pihole.getRecentBlocked(Number(req.query.count) || 1))
  )
);

app.get(
  '/api/pihole/blocking',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.getBlocking()))
);
app.post(
  '/api/pihole/blocking',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const { blocking, timer } = req.body || {};
    res.json(await pihole.setBlocking(blocking !== false, timer === undefined ? null : timer));
  })
);

app.get(
  '/api/pihole/domains',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const { list, kind } = req.query;
    if (VALID_LISTS.includes(list) && VALID_KINDS.includes(kind)) {
      return res.json(await pihole.getDomains(list, kind));
    }
    res.json(await pihole.getAllDomains());
  })
);
app.post(
  '/api/pihole/domains',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const { list, kind, domain, comment, groups, enabled } = req.body || {};
    if (!VALID_LISTS.includes(list) || !VALID_KINDS.includes(kind) || !domain) {
      return res
        .status(400)
        .json({ error: 'list (allow|deny), kind (exact|regex) and domain are required' });
    }
    res.json(await pihole.addDomain(list, kind, domain, { comment, groups, enabled }));
  })
);
app.delete(
  '/api/pihole/domains/:list/:kind/:domain',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const { list, kind, domain } = req.params;
    if (!VALID_LISTS.includes(list) || !VALID_KINDS.includes(kind)) {
      return res.status(400).json({ error: 'Invalid list or kind' });
    }
    res.json(await pihole.deleteDomain(list, kind, domain));
  })
);

app.get(
  '/api/pihole/lists',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.getLists()))
);
app.post(
  '/api/pihole/lists',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const { address, comment, groups, enabled } = req.body || {};
    if (!address) return res.status(400).json({ error: 'address is required' });
    res.json(await pihole.addList(address, { comment, groups, enabled }));
  })
);
app.delete(
  '/api/pihole/lists',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const address = (req.body && req.body.address) || req.query.address;
    if (!address) return res.status(400).json({ error: 'address is required' });
    res.json(await pihole.deleteList(address));
  })
);

app.get(
  '/api/pihole/groups',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.getGroups()))
);
app.post(
  '/api/pihole/groups',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const { name, comment } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    res.json(await pihole.addGroup(name, comment));
  })
);
app.delete(
  '/api/pihole/groups/:name',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.deleteGroup(req.params.name)))
);

app.get(
  '/api/pihole/config',
  authenticateToken,
  piholeRoute(async (req, res) => {
    if (!req.query.path) return res.status(400).json({ error: 'path is required' });
    res.json(await pihole.getConfig(req.query.path));
  })
);
app.patch(
  '/api/pihole/config',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const { path: configPath, value } = req.body || {};
    if (!configPath) return res.status(400).json({ error: 'path is required' });
    res.json(await pihole.patchConfig(configPath, value));
  })
);

app.post(
  '/api/pihole/action',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const action = (req.body && req.body.action) || req.query.action;
    const allowed = [
      'gravity',
      'restartdns',
      'flush/logs',
      'flush/arp',
      'restart',
      'shutdown',
      'flush/messages',
      'flush/network',
    ];
    if (!allowed.includes(action))
      return res.status(400).json({ error: `Unsupported action: ${action}` });
    res.json(await pihole.runAction(action));
  })
);

app.get(
  '/api/pihole/logs/:type',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const allowed = ['dnsmasq', 'ftl', 'webserver'];
    if (!allowed.includes(req.params.type))
      return res.status(400).json({ error: 'Unknown log type' });
    res.json(await pihole.getLogs(req.params.type, req.query.nextID));
  })
);

app.get(
  '/api/pihole/dhcp/leases',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.getDhcpLeases()))
);
app.get(
  '/api/pihole/network/devices',
  authenticateToken,
  piholeRoute(async (req, res) => res.json(await pihole.getNetworkDevices()))
);

app.get(
  '/api/pihole/teleporter',
  authenticateToken,
  piholeRoute(async (req, res) => {
    const { data, contentType } = await pihole.getTeleporter();
    res.setHeader('Content-Type', contentType || 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="pi-hole-teleporter.zip"');
    res.send(data);
  })
);

// Serve static files from the lightweight public directory
app.use(express.static(path.join(__dirname, '../public')));

// Handle all other routes by serving index.html (SPA fallback)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Terminal Socket Logic
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// Socket Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.decoded = decoded;
    next();
  });
});

io.on('connection', socket => {
  console.log('Client connected:', socket.id);

  let ptyProcess = null;
  let ptyCols = 80;
  let ptyRows = 24;

  const startPty = mode => {
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (e) {
        /* ignore */
      }
      ptyProcess = null;
    }

    let file = shell;
    let args = [];
    if (process.platform !== 'win32') {
      if (mode === 'root') {
        file = 'sudo';
        args = ['-i'];
      } else {
        args = ['-l'];
      }
    }

    try {
      ptyProcess = pty.spawn(file, args, {
        name: 'xterm-color',
        cols: ptyCols,
        rows: ptyRows,
        cwd: process.env.HOME,
        env: process.env,
      });

      ptyProcess.onData(data => {
        socket.emit('terminal:output', data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        socket.emit('terminal:exit', { exitCode });
        ptyProcess = null;
      });
    } catch (e) {
      console.error('Failed to spawn pty:', e);
      socket.emit('terminal:output', `\r\n\x1b[31mFailed to start shell: ${e.message}\x1b[0m\r\n`);
    }
  };

  socket.on('terminal:start', ({ cols, rows, mode } = {}) => {
    ptyCols = cols || ptyCols;
    ptyRows = rows || ptyRows;
    if (ptyProcess) return;
    startPty(mode);
  });

  socket.on('terminal:restart', ({ cols, rows, mode } = {}) => {
    ptyCols = cols || ptyCols;
    ptyRows = rows || ptyRows;
    startPty(mode);
  });

  socket.on('terminal:input', data => {
    if (ptyProcess) ptyProcess.write(data);
  });

  socket.on('terminal:resize', ({ cols, rows }) => {
    if (ptyProcess) ptyProcess.resize(cols, rows);
  });

  // --- Process Management ---
  let processTimeout = null;

  socket.on('processes:watch', (interval = 10000) => {
    if (processTimeout) clearTimeout(processTimeout);

    const sendProcesses = async () => {
      try {
        const data = await si.processes();
        const topProcs = data.list
          .sort((a, b) => b.cpu - a.cpu)
          .slice(0, 15)
          .map(p => ({
            pid: p.pid,
            name: p.name,
            cpu: Math.round(p.cpu * 10) / 10,
            mem: Math.round(p.mem * 10) / 10,
            user: p.user,
          }));
        socket.emit('processes:data', topProcs);
      } catch (e) {
        console.error('Process fetch error:', e);
      }
      processTimeout = setTimeout(sendProcesses, interval);
    };

    sendProcesses();
  });

  socket.on('processes:unwatch', () => {
    if (processTimeout) {
      clearTimeout(processTimeout);
      processTimeout = null;
    }
  });

  socket.on('process:kill', pid => {
    exec(`kill -9 ${pid}`, err => {
      if (err)
        socket.emit('notification', { type: 'error', message: `Failed to kill process ${pid}` });
      else socket.emit('notification', { type: 'success', message: `Process ${pid} killed` });
    });
  });

  // --- System Power ---
  socket.on('system:power', action => {
    if (action === 'reboot') exec('sudo reboot');
    else if (action === 'shutdown') exec('sudo shutdown -h now');
  });

  // --- Service Management ---
  socket.on('services:get', async () => {
    try {
      exec(
        'systemctl list-units --type=service --state=running,stopped --no-pager --no-legend',
        (err, stdout) => {
          if (err)
            return socket.emit('notification', {
              type: 'error',
              message: 'Failed to fetch services',
            });

          const services = stdout
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              const parts = line.trim().split(/\s+/);
              return {
                name: parts[0],
                load: parts[1],
                active: parts[2],
                sub: parts[3],
                description: parts.slice(4).join(' '),
              };
            });
          socket.emit('services:data', services);
        }
      );
    } catch (e) {
      console.error('Services fetch error:', e);
    }
  });

  socket.on('services:control', ({ service, action }) => {
    if (!['start', 'stop', 'restart'].includes(action)) return;
    exec(`sudo systemctl ${action} ${service}`, err => {
      if (err)
        socket.emit('notification', { type: 'error', message: `Failed to ${action} ${service}` });
      else {
        socket.emit('notification', { type: 'success', message: `Service ${service} ${action}ed` });
        socket.emit('services:refresh');
      }
    });
  });

  // --- Network Management ---
  socket.on('network:get_status', async () => {
    try {
      const dns = await new Promise(resolve => {
        exec('nmcli -t -f IP4.DNS device show', (err, stdout) => {
          if (err) return resolve([]);
          const dnsList = stdout
            .split('\n')
            .filter(line => line.startsWith('IP4.DNS'))
            .map(line => line.split(':')[1]);
          resolve([...new Set(dnsList)]);
        });
      });

      // Detailed per-interface info using nmcli for deep status
      exec(
        'nmcli -t -f DEVICE,TYPE,STATE,CONNECTION,IP4.ADDRESS,IP4.GATEWAY device show',
        (err, stdout) => {
          if (err)
            return socket.emit('notification', {
              type: 'error',
              message: 'Failed to fetch deep network status',
            });

          const devices = [];
          const lines = stdout.split('\n');
          let currentDevice = {};

          lines.forEach(line => {
            if (!line.trim()) {
              if (currentDevice.device) devices.push(currentDevice);
              currentDevice = {};
              return;
            }
            const [key, value] = line.split(':');
            if (key === 'GENERAL.DEVICE') currentDevice.device = value;
            if (key === 'GENERAL.TYPE') currentDevice.type = value;
            if (key === 'GENERAL.STATE') currentDevice.state = value;
            if (key === 'GENERAL.CONNECTION') currentDevice.connection = value;
            if (key === 'IP4.ADDRESS[1]') currentDevice.ip = value;
            if (key === 'IP4.GATEWAY') currentDevice.gateway = value;
          });
          if (currentDevice.device) devices.push(currentDevice);

          socket.emit('network:status_data', { devices, dns });
        }
      );
    } catch (e) {
      console.error('Network status error:', e);
    }
  });

  socket.on('network:set_dns', dnsServers => {
    // dnsServers: array of strings ['8.8.8.8', '1.1.1.1']
    // Note: Setting DNS globally via nmcli on Raspbian usually requires modifying the connection
    // For simplicity, we'll try to set it for the active connection
    exec('nmcli -t -f NAME connection show --active | head -n 1', (err, stdout) => {
      if (err || !stdout.trim())
        return socket.emit('notification', {
          type: 'error',
          message: 'No active connection found to set DNS',
        });

      const connName = stdout.trim();
      const dnsStr = dnsServers.join(' ');
      exec(
        `sudo nmcli connection modify "${connName}" ipv4.dns "${dnsStr}" && sudo nmcli connection up "${connName}"`,
        err => {
          if (err) socket.emit('notification', { type: 'error', message: 'Failed to update DNS' });
          else {
            socket.emit('notification', {
              type: 'success',
              message: `DNS updated for ${connName}`,
            });
            socket.emit('network:refresh');
          }
        }
      );
    });
  });

  socket.on('network:scan', () => {
    exec('sudo nmcli device wifi rescan', () => {
      exec("nmcli -t -f active,ssid device wifi | grep '^yes' | cut -d: -f2", (err, activeSsid) => {
        const currentSsid = activeSsid ? activeSsid.trim() : null;
        exec('nmcli -t -f SSID,SIGNAL,BARS,SECURITY device wifi list', (err, stdout) => {
          if (err)
            return socket.emit('notification', { type: 'error', message: 'WiFi scan failed' });
          const networks = stdout
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('--'))
            .map(line => {
              const [ssid, signal, bars, security] = line.split(':');
              return {
                ssid,
                signal: parseInt(signal) || 0,
                bars,
                security,
                connected: ssid === currentSsid && currentSsid !== null,
              };
            });

          const uniqueSsidMap = new Map();
          networks.forEach(n => {
            if (!uniqueSsidMap.has(n.ssid) || n.connected) uniqueSsidMap.set(n.ssid, n);
          });
          socket.emit('network:scan_results', Array.from(uniqueSsidMap.values()));
        });
      });
    });
  });

  socket.on('network:get_saved', () => {
    exec('nmcli -t -f NAME,TYPE,DEVICE connection show', (err, stdout) => {
      if (err)
        return socket.emit('notification', {
          type: 'error',
          message: 'Failed to get saved networks',
        });
      const connections = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [name, type, device] = line.split(':');
          return { name, type, device };
        })
        .filter(conn => conn.type.includes('wireless') || conn.type.includes('wifi'));
      socket.emit('network:saved_results', connections);
    });
  });

  socket.on('network:connect', ({ ssid, password }) => {
    const cmd = password
      ? `sudo nmcli device wifi connect "${ssid}" password "${password}"`
      : `sudo nmcli device wifi connect "${ssid}"`;
    exec(cmd, err => {
      if (err)
        socket.emit('notification', { type: 'error', message: `Failed to connect to ${ssid}` });
      else socket.emit('notification', { type: 'success', message: `Connected to ${ssid}` });
      socket.emit('network:refresh');
    });
  });

  socket.on('network:delete', name => {
    exec(`sudo nmcli connection delete "${name}"`, err => {
      if (err) socket.emit('notification', { type: 'error', message: `Failed to delete ${name}` });
      else socket.emit('notification', { type: 'success', message: `Deleted ${name}` });
      socket.emit('network:refresh');
    });
  });

  socket.on('settings:update_password', async ({ currentPassword, newPassword }) => {
    if (currentPassword !== process.env.ADMIN_PASSWORD) {
      return socket.emit('notification', { type: 'error', message: 'Current password incorrect' });
    }
    try {
      const envPath = path.join(__dirname, '../.env');
      let envContent = '';

      if (await fs_extra.pathExists(envPath)) {
        envContent = await fs_extra.readFile(envPath, 'utf8');
      }

      let updatedContent;
      if (envContent.includes('ADMIN_PASSWORD=')) {
        updatedContent = envContent.replace(/ADMIN_PASSWORD=.*/, `ADMIN_PASSWORD=${newPassword}`);
      } else {
        updatedContent = envContent + `\nADMIN_PASSWORD=${newPassword}`;
      }

      await fs_extra.writeFile(envPath, updatedContent.trim() + '\n');
      process.env.ADMIN_PASSWORD = newPassword;
      socket.emit('notification', { type: 'success', message: 'Password updated successfully' });
    } catch (e) {
      console.error('Password update error:', e);
      socket.emit('notification', { type: 'error', message: 'Failed to save new password' });
    }
  });

  // --- File Manager ---
  socket.on('files:list', async dirPath => {
    try {
      const target = dirPath || os.homedir();
      const items = await fs_extra.readdir(target, { withFileTypes: true });
      const list = items
        .map(item => ({
          name: item.name,
          isDirectory: item.isDirectory(),
          path: path.join(target, item.name),
          size: item.isDirectory() ? 0 : fs_extra.statSync(path.join(target, item.name)).size,
        }))
        .sort((a, b) => b.isDirectory - a.isDirectory || a.name.localeCompare(b.name));
      socket.emit('files:data', { path: target, items: list });
    } catch (e) {
      socket.emit('notification', {
        type: 'error',
        message: `Failed to list directory: ${e.message}`,
      });
    }
  });

  socket.on('files:read', async filePath => {
    try {
      const content = await fs_extra.readFile(filePath, 'utf8');
      socket.emit('files:content', { path: filePath, content });
    } catch (e) {
      socket.emit('notification', { type: 'error', message: `Failed to read file: ${e.message}` });
    }
  });

  socket.on('files:write', async ({ path, content }) => {
    try {
      await fs_extra.writeFile(path, content, 'utf8');
      socket.emit('notification', { type: 'success', message: 'File saved successfully' });
    } catch (e) {
      socket.emit('notification', { type: 'error', message: `Failed to save file: ${e.message}` });
    }
  });

  socket.on('files:delete', async filePath => {
    try {
      await fs_extra.remove(filePath);
      socket.emit('notification', { type: 'success', message: 'Item deleted' });
      socket.emit('files:refresh');
    } catch (e) {
      socket.emit('notification', { type: 'error', message: `Delete failed: ${e.message}` });
    }
  });

  // --- Script Runner ---
  socket.on('scripts:run', scriptPath => {
    const child = exec(scriptPath);
    socket.emit('scripts:output', `\n> Running: ${scriptPath}\n`);
    child.stdout.on('data', data => socket.emit('scripts:output', data));
    child.stderr.on('data', data => socket.emit('scripts:output', `[ERROR] ${data}`));
    child.on('close', code => {
      socket.emit('scripts:output', `\n> Process finished with code ${code}\n`);
      socket.emit('scripts:finished');
    });
  });

  // --- GPIO Management ---
  let pins = Array.from({ length: 40 }, (_, i) => ({
    number: i + 1,
    mode: 'IN',
    state: 'LOW',
  }));

  socket.on('gpio:get_pins', () => socket.emit('gpio:pins_data', pins));

  socket.on('gpio:toggle', pinNumber => {
    const pin = pins.find(p => p.number === pinNumber);
    if (pin) {
      pin.mode = pin.mode === 'IN' ? 'OUT' : 'IN';
      const cmd = `gpio mode ${pinNumber} ${pin.mode === 'OUT' ? 'out' : 'in'}`;
      exec(cmd);
      socket.emit('gpio:pins_data', pins);
      socket.emit('notification', {
        type: 'success',
        message: `Pin ${pinNumber} set to ${pin.mode}`,
      });
    }
  });

  socket.on('gpio:set_state', ({ pinNumber, state }) => {
    const pin = pins.find(p => p.number === pinNumber);
    if (pin && pin.mode === 'OUT') {
      pin.state = state;
      const cmd = `gpio write ${pinNumber} ${state === 'HIGH' ? 1 : 0}`;
      exec(cmd);
      socket.emit('gpio:pins_data', pins);
    }
  });

  // --- Pi-hole live summary ---
  let piholeTimeout = null;

  socket.on('pihole:watch', (interval = 5000) => {
    if (piholeTimeout) clearInterval(piholeTimeout);
    const tick = async () => {
      try {
        socket.emit('pihole:summary', await pihole.getSummary());
      } catch (e) {
        socket.emit('pihole:error', { message: e.message });
      }
    };
    tick();
    const ms = Math.max(2000, Math.min(60000, Number(interval) || 5000));
    piholeTimeout = setInterval(tick, ms);
  });

  socket.on('pihole:unwatch', () => {
    if (piholeTimeout) {
      clearInterval(piholeTimeout);
      piholeTimeout = null;
    }
  });

  socket.on('disconnect', () => {
    if (processTimeout) clearTimeout(processTimeout);
    if (piholeTimeout) clearInterval(piholeTimeout);
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Expose the official Pi-hole admin UI on a second port for the iframe fallback.
  if (String(process.env.PIHOLE_ENABLE_PROXY || 'true').toLowerCase() !== 'false') {
    startPiholeProxy().catch(err => console.warn('[pihole-proxy]', err.message));
  }

  let cachedStats = {
    disk_used: '0.0 GB',
    disk_total: '0.0 GB',
    ip: 'Disconnected',
    interfaces: '',
  };
  let fastInterval = 5000;
  let slowInterval = 60000;

  async function updateSlowStats() {
    try {
      const [fs, net] = await Promise.all([si.fsSize(), si.networkInterfaces()]);
      const rootFs = fs.find(f => f.mount === '/') || fs[0];
      const activeNet = net.filter(n => n.operstate === 'up' && !n.internal);
      cachedStats = {
        disk_used: (rootFs.used / 1024 ** 3).toFixed(1) + ' GB',
        disk_total: (rootFs.size / 1024 ** 3).toFixed(1) + ' GB',
        ips: activeNet.map(n => ({ iface: n.iface, ip: n.ip4 })),
        interfaces: activeNet.map(n => n.iface).join(', '),
      };
    } catch (e) {
      // Pi 2B: transient telemetry failures are not fatal, keep the last sample.
    }
    setTimeout(updateSlowStats, slowInterval);
  }

  let memCache = null;
  let tempCache = null;
  let cacheExpiry = 0;

  async function updateFastStats() {
    try {
      const now = Date.now();
      if (now > cacheExpiry) {
        const [mem, temp] = await Promise.all([si.mem(), si.cpuTemperature()]);
        memCache = mem;
        tempCache = temp;
        cacheExpiry = now + 10000;
      }
      const cpu = await si.currentLoad();
      const stats = {
        cpu: Math.round(cpu.currentLoad),
        mem: memCache ? Math.round((memCache.active / memCache.total) * 100) : 0,
        mem_total: memCache ? (memCache.total / 1024 ** 3).toFixed(1) + ' GB' : '0.0 GB',
        mem_used: memCache ? (memCache.active / 1024 ** 3).toFixed(1) + ' GB' : '0.0 GB',
        temp: tempCache?.main || 0,
        uptime: os.uptime(),
        ...cachedStats,
      };
      io.emit('telemetry:stats', stats);
      fastInterval = stats.cpu > 80 ? 10000 : stats.cpu < 20 ? 3000 : 5000;
    } catch (e) {
      // Pi 2B: transient telemetry failures are not fatal, keep the last sample.
    }
    setTimeout(updateFastStats, fastInterval);
  }

  updateSlowStats();
  updateFastStats();
});
