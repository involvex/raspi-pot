# Plugin Development Guide

This guide covers developing plugins for the RaspiPot dashboard system. Plugins allow you to extend functionality, add custom features, and integrate with external services.

## Plugin Architecture

The plugin system is built around a modular architecture that allows:

- Dynamic loading and unloading of plugins
- Event-driven communication with the core system
- Isolated plugin environments
- Rich API for system integration

## Plugin Structure

Each plugin is a self-contained module with the following structure:

```
plugin-name/
├── plugin.json          # Plugin manifest
├── index.js            # Main plugin code
├── README.md           # Plugin documentation
├── assets/             # Static assets (optional)
│   ├── icon.png
│   └── styles.css
└── lib/                # Additional libraries (optional)
    └── helper.js
```

## Plugin Manifest (plugin.json)

The manifest file defines plugin metadata and configuration:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "A brief description of what this plugin does",
  "author": "Your Name",
  "main": "index.js",
  "category": "System|Network|Information|Tools",
  "permissions": ["telemetry", "notifications", "network", "filesystem"],
  "hooks": ["onTelemetryData", "onSocketConnection"],
  "settings": {
    "apiKey": "",
    "updateInterval": 60000,
    "enabled": true
  },
  "dependencies": {
    "axios": "^1.0.0"
  }
}
```

### Manifest Fields

- **name**: Unique plugin identifier (required)
- **version**: Semantic version (required)
- **description**: Brief description (required)
- **author**: Plugin author (optional)
- **main**: Entry point file (default: "index.js")
- **category**: Plugin category for UI organization
- **permissions**: Required system permissions
- **hooks**: Event hooks the plugin implements
- **settings**: Default configuration values
- **dependencies**: NPM dependencies

## Plugin Development

### Base Plugin Class

All plugins extend the `BasePlugin` class:

```javascript
const BasePlugin = require('../../base-plugin');

class MyPlugin extends BasePlugin {
  constructor(manifest) {
    super(manifest);
    // Plugin initialization
  }

  async enable() {
    await super.enable();
    // Plugin-specific enable logic
    this.log('Plugin enabled');
  }

  async disable() {
    // Plugin-specific disable logic
    await super.disable();
  }
}

module.exports = MyPlugin;
```

### Available Hooks

Plugins can implement various hooks to interact with the system:

#### onTelemetryData(data)

Called when system telemetry data is updated:

```javascript
async onTelemetryData(data) {
  // Modify or process telemetry data
  if (data.cpu > 90) {
    this.warn(`High CPU: ${data.cpu}%`);
  }

  // Return modified data (optional)
  return { ...data, customMetric: calculateSomething() };
}
```

#### onSocketConnection(socket)

Called when a new client connects:

```javascript
async onSocketConnection(socket) {
  this.log(`Client connected: ${socket.id}`);

  // Send plugin-specific data to client
  socket.emit('plugin:data', { plugin: this.name, data: this.getData() });
}
```

#### onSocketDisconnection(socket)

Called when a client disconnects:

```javascript
async onSocketDisconnection(socket) {
  this.log(`Client disconnected: ${socket.id}`);
}
```

#### onHttpRequest(req, res, next)

Called for HTTP requests (for custom API endpoints):

```javascript
async onHttpRequest(req, res, next) {
  if (req.path === '/api/my-plugin/data' && req.method === 'GET') {
    res.json({ success: true, data: this.getData() });
    return;
  }
  next(); // Pass to next handler
}
```

### Plugin API

#### Logging

```javascript
this.log('Info message'); // Info level
this.warn('Warning message'); // Warning level
this.error('Error message'); // Error level
```

#### System Information

Plugins can access system information through the telemetry hooks or by importing systeminformation:

```javascript
const si = require('systeminformation');

async getSystemInfo() {
  const cpu = await si.cpu();
  const mem = await si.mem();
  return { cpu, mem };
}
```

#### File System Operations

```javascript
const fs = require('fs-extra');
const path = require('path');

// Plugin-specific data directory
const dataDir = path.join(__dirname, 'data');

async saveData(data) {
  await fs.ensureDir(dataDir);
  await fs.writeJson(path.join(dataDir, 'data.json'), data);
}
```

## Plugin Examples

### Example 1: Simple Monitor Plugin

```javascript
const BasePlugin = require('../../base-plugin');

class SimpleMonitor extends BasePlugin {
  constructor(manifest) {
    super(manifest);
    this.alertThreshold = manifest.settings?.alertThreshold || 80;
  }

  async onTelemetryData(data) {
    if (data.cpu > this.alertThreshold) {
      this.warn(`CPU alert: ${data.cpu}%`);
    }

    // Add custom metric
    return {
      ...data,
      performance_score: this.calculateScore(data),
    };
  }

  calculateScore(data) {
    return Math.max(0, 100 - data.cpu - data.mem * 0.5);
  }
}

module.exports = SimpleMonitor;
```

### Example 2: API Integration Plugin

```javascript
const BasePlugin = require('../../base-plugin');
const axios = require('axios');

class WeatherPlugin extends BasePlugin {
  constructor(manifest) {
    super(manifest);
    this.apiKey = manifest.settings?.apiKey || '';
    this.location = manifest.settings?.location || 'London';
    this.weatherData = null;
  }

  async enable() {
    await super.enable();
    await this.fetchWeather();
  }

  async onHttpRequest(req, res, next) {
    if (req.path === '/api/weather' && req.method === 'GET') {
      res.json({ success: true, data: this.weatherData });
      return;
    }
    next();
  }

  async fetchWeather() {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${this.location}&appid=${this.apiKey}`
      );
      this.weatherData = response.data;
    } catch (error) {
      this.error(`Weather fetch failed: ${error.message}`);
    }
  }
}

module.exports = WeatherPlugin;
```

## Plugin Installation

### Manual Installation

1. Create plugin directory in `server/plugins/`
2. Add `plugin.json` manifest
3. Implement plugin class in `index.js`
4. Restart server or use plugin management UI

### Web Interface Installation

1. Navigate to Plugins page in dashboard
2. Click "Install Plugin"
3. Upload plugin package (ZIP file)
4. Configure plugin settings
5. Enable plugin

## Plugin Configuration

### Settings Management

Plugins can expose configuration settings:

```javascript
class ConfigurablePlugin extends BasePlugin {
  constructor(manifest) {
    super(manifest);
    this.settings = manifest.settings || {};
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.log('Settings updated');
  }

  getSettings() {
    return this.settings;
  }
}
```

### Environment Variables

Access environment variables in plugins:

```javascript
class EnvPlugin extends BasePlugin {
  constructor(manifest) {
    super(manifest);
    this.apiKey = process.env.MY_PLUGIN_API_KEY || this.settings.apiKey;
  }
}
```

## Best Practices

### Performance

1. **Use async/await**: Don't block the event loop
2. **Cache expensive operations**: Store results of API calls
3. **Limit memory usage**: Clean up resources in disable()
4. **Use debouncing**: Avoid rapid repeated operations

### Security

1. **Validate inputs**: Sanitize all user inputs
2. **Secure API keys**: Use environment variables
3. **Limit permissions**: Request only necessary permissions
4. **Handle errors**: Don't expose sensitive information

### Error Handling

```javascript
async riskyOperation() {
  try {
    const result = await someAsyncOperation();
    return result;
  } catch (error) {
    this.error(`Operation failed: ${error.message}`);
    throw error; // Re-throw if needed
  }
}
```

### Resource Management

```javascript
async enable() {
  await super.enable();
  // Start timers, open connections, etc.
  this.timer = setInterval(this.updateData.bind(this), 60000);
}

async disable() {
  // Clean up resources
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }
  await super.disable();
}
```

## Testing Plugins

### Unit Testing

```javascript
const MyPlugin = require('./index');
const assert = require('assert');

describe('MyPlugin', () => {
  let plugin;

  beforeEach(() => {
    const manifest = {
      name: 'test-plugin',
      version: '1.0.0',
      settings: { threshold: 80 },
    };
    plugin = new MyPlugin(manifest);
  });

  it('should calculate score correctly', () => {
    const data = { cpu: 50, mem: 60 };
    const result = plugin.calculateScore(data);
    assert.strictEqual(result, 70);
  });
});
```

### Integration Testing

Test plugins with the actual system:

```javascript
// test/integration.test.js
const PluginManager = require('../server/plugin-manager');

describe('Plugin Integration', () => {
  let manager;

  beforeEach(async () => {
    manager = new PluginManager();
    await manager.loadPlugin('my-plugin');
  });

  it('should load and enable plugin', async () => {
    const success = await manager.enablePlugin('my-plugin');
    assert(success);
  });
});
```

## Debugging

### Plugin Logging

```javascript
class DebugPlugin extends BasePlugin {
  async onTelemetryData(data) {
    this.log(`Processing telemetry: CPU=${data.cpu}%, MEM=${data.mem}%`);

    // Debug output
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${this.name}] Debug:`, data);
    }

    return data;
  }
}
```

### Error Reporting

```javascript
async riskyOperation() {
  try {
    return await someOperation();
  } catch (error) {
    this.error(`Operation failed: ${error.message}`);

    // Report to monitoring service
    if (process.env.ERROR_REPORTING_URL) {
      await this.reportError(error);
    }

    throw error;
  }
}
```

## Publishing Plugins

### Plugin Package

Create a distributable package:

```bash
# Create plugin package
tar -czf my-plugin-1.0.0.tar.gz my-plugin/

# Or create ZIP for web upload
zip -r my-plugin-1.0.0.zip my-plugin/
```

### Plugin Registry

Consider publishing plugins to:

- GitHub repository with releases
- npm registry (for dependencies)
- Custom plugin registry

## Plugin API Reference

### BasePlugin Methods

- `async enable()`: Enable plugin
- `async disable()`: Disable plugin
- `log(message, level)`: Log message
- `error(message)`: Log error
- `warn(message)`: Log warning

### System Hooks

- `onTelemetryData(data)`: Telemetry updates
- `onSocketConnection(socket)`: New client connection
- `onSocketDisconnection(socket)`: Client disconnection
- `onHttpRequest(req, res, next)`: HTTP request handling

### Plugin Manager API

- `loadPlugin(name)`: Load plugin
- `enablePlugin(name)`: Enable plugin
- `disablePlugin(name)`: Disable plugin
- `uninstallPlugin(name)`: Remove plugin
- `executeHook(hookName, ...args)`: Execute plugin hooks

This guide provides everything needed to develop, test, and distribute plugins for the RaspiPot dashboard system.
