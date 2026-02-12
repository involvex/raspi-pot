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
const PluginManager = require('./plugin-manager.js');
require('dotenv').config();

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
  }
});
const upload = multer({ storage });

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'raspberry';

// Initialize Plugin Manager
const pluginManager = new PluginManager();

// Initialize plugins
(async() => {
  try {
    console.log('Initializing plugins...');
    await pluginManager.loadAllPlugins();

    // Enable cloud storage plugin by default
    console.log(
      'Available plugins:',
      pluginManager.getPluginList().map(p => p.name)
    );
    await pluginManager.enablePlugin('cloud-storage');
    console.log('Cloud storage plugin enabled successfully');
    console.log(
      'Enabled plugins after enabling:',
      pluginManager.getEnabledPlugins().map(p => p.name)
    );
  } catch (error) {
    console.error('Failed to initialize plugins:', error);
  }
})();

const io = new Server(server, {
  cors: {
    origin: '*', // Allow all for dev, tighten for prod
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Plugin HTTP Request Middleware
app.use('/api/cloud-storage', async(req, res, next) => {
  try {
    const enabledPlugins = pluginManager.getEnabledPlugins();
    const cloudStoragePlugin = enabledPlugins.find(p => p.name === 'cloud-storage');

    if (
      cloudStoragePlugin &&
      cloudStoragePlugin.instance &&
      cloudStoragePlugin.instance.onHttpRequest
    ) {
      await cloudStoragePlugin.instance.onHttpRequest(req, res, next);
    } else {
      next();
    }
  } catch (error) {
    console.error('Plugin middleware error:', error);
    next();
  }
});

// Fallback cloud storage routes (direct implementation)
app.get('/api/cloud-storage/gdrive/status', (req, res) => {
  res.json({ success: true, authenticated: false, configured: false });
});

app.get('/api/cloud-storage/mega/status', (req, res) => {
  res.json({ success: true, authenticated: false, configured: false });
});

app.post('/api/cloud-storage/mega/login', (req, res) => {
  res.json({ success: false, error: 'Plugin not properly loaded' });
});

// Plugin Management Routes
app.get('/api/plugins', async(req, res) => {
  try {
    const plugins = pluginManager.getPluginList();
    res.json({ success: true, plugins });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/plugins/install', async(req, res) => {
  try {
    const { pluginData } = req.body;
    const success = await pluginManager.installPlugin(pluginData);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/plugins/:name/enable', async(req, res) => {
  try {
    const { name } = req.params;
    const success = await pluginManager.enablePlugin(name);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/plugins/:name/disable', async(req, res) => {
  try {
    const { name } = req.params;
    const success = await pluginManager.disablePlugin(name);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/plugins/:name/settings', async(req, res) => {
  try {
    const { name } = req.params;
    const settings = pluginManager.getPluginSettings(name);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/plugins/:name/settings', async(req, res) => {
  try {
    const { name } = req.params;
    const settings = req.body;

    // Find plugin and update its settings
    const plugins = pluginManager.getEnabledPlugins();
    const plugin = plugins.find(p => p.name === name);

    if (plugin && plugin.instance && plugin.instance.updateSettings) {
      await plugin.instance.updateSettings(settings);
    } else {
      await pluginManager.savePluginSettings(name, settings);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/plugins/:name', async(req, res) => {
  try {
    const { name } = req.params;
    const success = await pluginManager.uninstallPlugin(name);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
  // Support both Bearer header and query param (needed for direct browser downloads)
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
  console.log('Downloading file:', absolutePath);

  // Explicitly allow dotfiles (hidden files)
  res.download(absolutePath, path.basename(absolutePath), { dotfiles: 'allow' }, err => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) {
        res.status(404).send('File not found');
      }
    }
  });
});

// File Upload
app.post('/api/files/upload', authenticateToken, upload.single('file'), (req, res) => {
  res.json({ success: true, message: 'File uploaded' });
});

// Serve static files from the SvelteKit build (production)
app.use(express.static(path.join(__dirname, '../client/build')));

// Handle all other routes by serving index.html (SPA fallback)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
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

  // Execute plugin hooks for new connection
  pluginManager.executeHook('onSocketConnection', socket);

  // Allow multiple terminals? For now, one per socket.
  let ptyProcess = null;

  socket.on('terminal:start', ({ cols, rows } = {}) => {
    if (ptyProcess) return; // Already started

    // Use safe defaults if not provided
    const safeCols = cols || 80;
    const safeRows = rows || 24;

    try {
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: safeCols,
        rows: safeRows,
        cwd: process.env.HOME,
        env: process.env
      });

      ptyProcess.onData(data => {
        socket.emit('terminal:output', data);
      });

      ptyProcess.onExit(() => {
        socket.emit('terminal:exit');
        ptyProcess = null;
      });
    } catch (e) {
      console.error('Failed to spawn pty:', e);
    }
  });

  socket.on('terminal:input', data => {
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  socket.on('terminal:resize', ({ cols, rows }) => {
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

  // --- Process Management ---
  let processTimeout = null;

  socket.on('processes:watch', (interval = 10000) => {
    if (processTimeout) clearTimeout(processTimeout);

    const sendProcesses = async() => {
      try {
        const data = await si.processes();
        // Sort by CPU and take top 15
        const topProcs = data.list
          .sort((a, b) => b.cpu - a.cpu)
          .slice(0, 15)
          .map(p => ({
            pid: p.pid,
            name: p.name,
            cpu: Math.round(p.cpu * 10) / 10,
            mem: Math.round(p.mem * 10) / 10,
            user: p.user
          }));
        socket.emit('processes:data', topProcs);
      } catch (e) {
        console.error('Process fetch error:', e);
      }
      processTimeout = setTimeout(sendProcesses, interval);
    };

    sendProcesses(); // Start the loop
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
        socket.emit('notification', {
          type: 'error',
          message: `Failed to kill process ${pid}`
        });
      else
        socket.emit('notification', {
          type: 'success',
          message: `Process ${pid} killed`
        });
    });
  });

  // --- System Power ---
  socket.on('system:power', action => {
    if (action === 'reboot') {
      exec('sudo reboot');
    } else if (action === 'shutdown') {
      exec('sudo shutdown -h now');
    }
  });

  // --- Service Management ---
  socket.on('services:get', async() => {
    try {
      // Fetch some common services or all. For simplicity on Linux:
      exec(
        'systemctl list-units --type=service --state=running,stopped --no-pager --no-legend',
        (err, stdout) => {
          if (err)
            return socket.emit('notification', {
              type: 'error',
              message: 'Failed to fetch services'
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
                description: parts.slice(4).join(' ')
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
    // action: start, stop, restart
    if (!['start', 'stop', 'restart'].includes(action)) return;

    exec(`sudo systemctl ${action} ${service}`, err => {
      if (err)
        socket.emit('notification', {
          type: 'error',
          message: `Failed to ${action} ${service}`
        });
      else {
        socket.emit('notification', {
          type: 'success',
          message: `Service ${service} ${action}ed`
        });
        // Refresh list
        socket.emit('services:refresh');
      }
    });
  });

  // --- Network Management ---
  socket.on('network:scan', () => {
    // Trigger a rescan
    exec('sudo nmcli device wifi rescan', () => {
      // Get current active WiFi SSID
      exec('nmcli -t -f active,ssid device wifi | grep \'^yes\' | cut -d: -f2', (err, activeSsid) => {
        const currentSsid = activeSsid ? activeSsid.trim() : null;

        exec('nmcli -t -f SSID,SIGNAL,BARS,SECURITY device wifi list', (err, stdout) => {
          if (err)
            return socket.emit('notification', {
              type: 'error',
              message: 'WiFi scan failed'
            });
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
                connected: ssid === currentSsid && currentSsid !== null
              };
            });

          // Filter unique SSIDs, preferring connected ones
          const uniqueSsidMap = new Map();
          networks.forEach(n => {
            if (!uniqueSsidMap.has(n.ssid) || n.connected) {
              uniqueSsidMap.set(n.ssid, n);
            }
          });

          socket.emit('network:scan_results', Array.from(uniqueSsidMap.values()));
        });
      });
    });
  });

  socket.on('network:get_saved', () => {
    // Use -f TYPE to ensure we only get '802-11-wireless'
    exec('nmcli -t -f NAME,TYPE,DEVICE connection show', (err, stdout) => {
      if (err)
        return socket.emit('notification', {
          type: 'error',
          message: 'Failed to get saved networks'
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
        socket.emit('notification', {
          type: 'error',
          message: `Failed to connect to ${ssid}`
        });
      else
        socket.emit('notification', {
          type: 'success',
          message: `Connected to ${ssid}`
        });
      socket.emit('network:refresh');
    });
  });

  socket.on('network:delete', name => {
    exec(`sudo nmcli connection delete "${name}"`, err => {
      if (err)
        socket.emit('notification', {
          type: 'error',
          message: `Failed to delete ${name}`
        });
      else
        socket.emit('notification', {
          type: 'success',
          message: `Deleted ${name}`
        });
      socket.emit('network:refresh');
    });
  });

  socket.on('settings:update_password', async({ currentPassword, newPassword }) => {
    // Note: In this simple implementation, we check against the live variable.
    // A better way would be using a DB, but for RaspiPot we'll update the .env file.
    if (currentPassword !== process.env.ADMIN_PASSWORD) {
      return socket.emit('notification', {
        type: 'error',
        message: 'Current password incorrect'
      });
    }

    try {
      const envPath = path.join(__dirname, '../.env');
      let envContent = await fs_extra.readFile(envPath, 'utf8');

      // Replace ADMIN_PASSWORD line
      const updatedContent = envContent.replace(
        /ADMIN_PASSWORD=.*/,
        `ADMIN_PASSWORD=${newPassword}`
      );

      await fs_extra.writeFile(envPath, updatedContent);
      process.env.ADMIN_PASSWORD = newPassword; // Update in memory

      socket.emit('notification', {
        type: 'success',
        message: 'Password updated successfully'
      });
    } catch (e) {
      console.error('Failed to update .env:', e);
      socket.emit('notification', {
        type: 'error',
        message: 'Failed to save new password'
      });
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
          size: item.isDirectory() ? 0 : fs_extra.statSync(path.join(target, item.name)).size
        }))
        .sort((a, b) => b.isDirectory - a.isDirectory || a.name.localeCompare(b.name));

      socket.emit('files:data', { path: target, items: list });
    } catch (e) {
      socket.emit('notification', {
        type: 'error',
        message: `Failed to list directory: ${e.message}`
      });
    }
  });

  socket.on('files:read', async filePath => {
    try {
      const content = await fs_extra.readFile(filePath, 'utf8');
      socket.emit('files:content', { path: filePath, content });
    } catch (e) {
      socket.emit('notification', {
        type: 'error',
        message: `Failed to read file: ${e.message}`
      });
    }
  });

  socket.on('files:write', async({ path, content }) => {
    try {
      await fs_extra.writeFile(path, content, 'utf8');
      socket.emit('notification', {
        type: 'success',
        message: 'File saved successfully'
      });
    } catch (e) {
      socket.emit('notification', {
        type: 'error',
        message: `Failed to save file: ${e.message}`
      });
    }
  });

  socket.on('files:delete', async filePath => {
    try {
      await fs_extra.remove(filePath);
      socket.emit('notification', { type: 'success', message: 'Item deleted' });
      socket.emit('files:refresh');
    } catch (e) {
      socket.emit('notification', {
        type: 'error',
        message: `Delete failed: ${e.message}`
      });
    }
  });

  // --- Script Runner ---
  socket.on('scripts:run', scriptPath => {
    const child = exec(scriptPath);

    socket.emit('scripts:output', `\n> Running: ${scriptPath}\n`);

    child.stdout.on('data', data => {
      socket.emit('scripts:output', data);
    });

    child.stderr.on('data', data => {
      socket.emit('scripts:output', `[ERROR] ${data}`);
    });

    child.on('close', code => {
      socket.emit('scripts:output', `\n> Process finished with code ${code}\n`);
      socket.emit('scripts:finished');
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Execute plugin hooks for disconnection
    pluginManager.executeHook('onSocketDisconnection', socket);

    if (processTimeout) clearTimeout(processTimeout);
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  let cachedStats = {
    disk_used: '0.0 GB',
    disk_total: '0.0 GB',
    ip: 'Disconnected',
    interfaces: ''
  };

  // Adaptive telemetry intervals based on system load for Pi 2B optimization
  let fastInterval = 5000; // Default 5s for Pi 2B (was 2s)
  let slowInterval = 60000; // Default 60s for disk/network (was 30s)

  // Slow Telemetry (Disk and Network info - adaptive rate)
  async function updateSlowStats() {
    try {
      const [fs, net] = await Promise.all([si.fsSize(), si.networkInterfaces()]);
      const rootFs = fs.find(f => f.mount === '/') || fs[0];
      const activeNet = net.filter(n => n.operstate === 'up' && !n.internal);

      cachedStats = {
        disk_used: (rootFs.used / 1024 ** 3).toFixed(1) + ' GB',
        disk_total: (rootFs.size / 1024 ** 3).toFixed(1) + ' GB',
        ips: activeNet.map(n => ({ iface: n.iface, ip: n.ip4 })),
        interfaces: activeNet.map(n => n.iface).join(', ')
      };
    } catch (e) {
      console.error('Slow telemetry error:', e);
    }
    setTimeout(updateSlowStats, slowInterval);
  }

  // Fast Telemetry (CPU, Mem, Temp - adaptive rate with caching)
  let memCache = null;
  let tempCache = null;
  let cacheExpiry = 0;

  async function updateFastStats() {
    try {
      const now = Date.now();

      // Cache expensive memory and temp calls for Pi 2B
      if (now > cacheExpiry) {
        const [mem, temp] = await Promise.all([si.mem(), si.cpuTemperature()]);
        memCache = mem;
        tempCache = temp;
        cacheExpiry = now + 10000; // Cache for 10s
      }

      const cpu = await si.currentLoad(); // CPU changes frequently, don't cache

      const stats = {
        cpu: Math.round(cpu.currentLoad),
        mem: memCache ? Math.round((memCache.active / memCache.total) * 100) : 0,
        mem_total: memCache ? (memCache.total / 1024 ** 3).toFixed(1) + ' GB' : '0.0 GB',
        mem_used: memCache ? (memCache.active / 1024 ** 3).toFixed(1) + ' GB' : '0.0 GB',
        temp: tempCache?.main || 0,
        uptime: os.uptime(),
        ...cachedStats
      };

      // Execute plugin hooks for telemetry data
      const pluginResults = await pluginManager.executeHook('onTelemetryData', stats);

      // Apply plugin modifications if any
      let finalStats = stats;
      for (const result of pluginResults) {
        if (result.result && typeof result.result === 'object') {
          finalStats = { ...finalStats, ...result.result };
        }
      }

      io.emit('telemetry:stats', finalStats);

      // Adaptive interval based on CPU load for Pi 2B
      if (stats.cpu > 80) {
        fastInterval = 10000; // Slower when under high load
      } else if (stats.cpu < 20) {
        fastInterval = 3000; // Faster when idle
      } else {
        fastInterval = 5000; // Normal rate
      }
    } catch (e) {
      console.error('Fast telemetry error:', e);
    }
    setTimeout(updateFastStats, fastInterval);
  }

  updateSlowStats();
  updateFastStats();
});
