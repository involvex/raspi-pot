# Plugin System Overview

The RaspiPot dashboard includes a powerful plugin system that allows users to extend functionality, add custom features, and integrate with external services. This document provides an overview of the plugin architecture and usage.

## Features

### Dynamic Plugin Management

- **Hot Loading**: Install, enable, disable, and uninstall plugins without restarting the dashboard
- **Web Interface**: Complete plugin management through the dashboard UI
- **Dependency Management**: Automatic handling of plugin dependencies
- **Configuration**: Plugin-specific settings managed through the interface

### Plugin Capabilities

- **System Monitoring**: Extend telemetry with custom metrics
- **External APIs**: Integrate with weather, notification, and monitoring services
- **File Operations**: Log system events, manage files, and process data
- **Network Services**: Add custom API endpoints and webhooks
- **UI Extensions**: Add new dashboard components and widgets

### Security & Isolation

- **Permission System**: Granular permissions for system access
- **Resource Limits**: Built-in protection against resource abuse
- **Error Isolation**: Plugin failures don't affect core system
- **Secure Execution**: Sandboxed plugin environment

## Architecture

### Core Components

1. **Plugin Manager**: Central plugin lifecycle management
2. **Base Plugin Class**: Foundation for all plugins
3. **Hook System**: Event-driven communication between core and plugins
4. **Permission Framework**: Security and access control
5. **Configuration Manager**: Plugin settings and preferences

### Plugin Lifecycle

```
Install → Load → Enable → Active → Disable → Uninstall
```

1. **Install**: Copy plugin files and validate manifest
2. **Load**: Load plugin code into memory
3. **Enable**: Activate plugin functionality
4. **Active**: Plugin is running and responding to events
5. **Disable**: Deactivate plugin (keep loaded)
6. **Uninstall**: Remove plugin completely

## Available Plugins

### Built-in Example Plugins

#### System Monitor Plugin

- **Purpose**: Advanced system monitoring with historical data
- **Features**:
  - Historical metrics tracking
  - System health scoring
  - Configurable alert thresholds
  - Performance trend analysis

#### Weather Widget Plugin

- **Purpose**: Weather information display
- **Features**:
  - Current weather conditions
  - 5-day forecast
  - Multiple location support
  - Customizable units

#### File Logger Plugin

- **Purpose**: System event logging
- **Features**:
  - Configurable log levels
  - Automatic log rotation
  - File size management
  - Event filtering

## Plugin Categories

### System Plugins

Extend core system functionality:

- Performance monitoring
- Resource management
- System automation
- Security enhancements

### Network Plugins

Network and communication features:

- External API integrations
- Notification services
- Remote monitoring
- Data synchronization

### Information Plugins

Data display and information:

- Weather widgets
- News feeds
- Stock tickers
- Calendar integration

### Tool Plugins

Utility and productivity features:

- File management tools
- System utilities
- Automation scripts
- Custom dashboards

## Installation and Management

### Web Interface

1. Navigate to **Plugins** in the dashboard
2. Click **Install Plugin** to upload new plugins
3. Use toggle switches to enable/disable plugins
4. Configure plugin settings as needed
5. Monitor plugin status and performance

### Command Line (Advanced)

```bash
# List installed plugins
curl http://localhost:3000/api/plugins

# Enable plugin
curl -X POST http://localhost:3000/plugins/my-plugin/enable

# Disable plugin
curl -X POST http://localhost:3000/plugins/my-plugin/disable

# Uninstall plugin
curl -X DELETE http://localhost:3000/plugins/my-plugin
```

## Plugin Development

### Getting Started

1. Create plugin directory in `server/plugins/`
2. Define `plugin.json` manifest
3. Implement plugin class extending `BasePlugin`
4. Add desired hooks and functionality
5. Test with plugin manager

### Quick Example

```javascript
const BasePlugin = require('../../base-plugin');

class MyPlugin extends BasePlugin {
  async onTelemetryData(data) {
    this.log(`CPU usage: ${data.cpu}%`);
    return data; // Pass through unchanged
  }
}

module.exports = MyPlugin;
```

### Plugin Manifest

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Your Name",
  "main": "index.js",
  "permissions": ["telemetry"],
  "hooks": ["onTelemetryData"]
}
```

## Configuration

### Plugin Settings

Each plugin can have its own configuration:

- Accessible through the web interface
- Stored in plugin configuration files
- Runtime configuration updates
- Validation and type checking

### System Settings

Global plugin system settings:

- Plugin directory location
- Security policies
- Resource limits
- Logging configuration

## Security

### Permission System

Plugins request specific permissions:

- `telemetry`: Access system metrics
- `notifications`: Send notifications
- `network`: Make network requests
- `filesystem`: Read/write files
- `system`: Execute system commands

### Sandboxing

- Isolated execution environment
- Resource usage monitoring
- Error containment
- Access control enforcement

## Performance

### Optimization Features

- Lazy loading of plugins
- Efficient event handling
- Memory usage monitoring
- CPU usage tracking

### Best Practices

- Use async operations
- Implement proper error handling
- Cache expensive operations
- Clean up resources properly

## Troubleshooting

### Common Issues

1. **Plugin Won't Load**
   - Check manifest syntax
   - Verify main file exists
   - Review error logs

2. **Plugin Not Responding**
   - Check if plugin is enabled
   - Review plugin logs
   - Verify hooks are implemented

3. **Performance Issues**
   - Monitor resource usage
   - Check for memory leaks
   - Review plugin code efficiency

### Debug Information

```bash
# Check plugin status
curl http://localhost:3000/api/plugins

# View system logs
tail -f logs/raspipot.log

# Monitor resource usage
top -p $(pgrep node)
```

## API Reference

### Plugin Manager Endpoints

- `GET /api/plugins` - List all plugins
- `POST /api/plugins/install` - Install new plugin
- `POST /api/plugins/:name/enable` - Enable plugin
- `POST /api/plugins/:name/disable` - Disable plugin
- `DELETE /api/plugins/:name` - Uninstall plugin

### Plugin Hooks

- `onTelemetryData(data)` - System telemetry updates
- `onSocketConnection(socket)` - New client connections
- `onSocketDisconnection(socket)` - Client disconnections
- `onHttpRequest(req, res, next)` - HTTP request handling

## Future Enhancements

### Planned Features

- Plugin marketplace
- Automatic updates
- Plugin dependencies
- Version management
- Plugin templates
- Advanced debugging tools

### Community

- Plugin development forum
- Shared plugin repository
- Contributing guidelines
- Plugin certification program

## Support

For plugin development support:

- Documentation: `docs/PLUGIN_DEVELOPMENT.md`
- Example plugins: `plugins/` directory
- Issues: GitHub repository
- Community: Discussion forums

The plugin system is designed to be extensible, secure, and easy to use, enabling users to customize their RaspiPot dashboard to meet their specific needs.
