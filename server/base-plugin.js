class BasePlugin {
  constructor(manifest) {
    this.manifest = manifest;
    this.name = manifest.name;
    this.version = manifest.version;
    this.description = manifest.description || '';
    this.author = manifest.author || '';
    this.enabled = false;
  }

  async enable() {
    this.enabled = true;
    console.log(`Plugin ${this.name} enabled`);
  }

  async disable() {
    this.enabled = false;
    console.log(`Plugin ${this.name} disabled`);
  }

  // Hook methods that plugins can override
  async onTelemetryData(data) {
    // Called when telemetry data is updated
    // Override in plugin implementation
    // Default implementation does nothing
  }

  onSocketConnection() {
    // Called when a new socket connection is established
    // Override in plugin implementation
  }

  onSocketDisconnection() {
    // Called when a socket connection is closed
    // Override in plugin implementation
  }

  async onHttpRequest(req, res, next) {
    // Called for HTTP requests (if plugin wants to add routes)
    next();
  }

  // Plugin lifecycle methods
  async install() {
    // Called when plugin is installed
  }

  async uninstall() {
    // Called when plugin is uninstalled
  }

  // Utility methods
  log(message, level = 'info') {
    console.log(`[${this.name}] ${level.toUpperCase()}: ${message}`);
  }

  error(message) {
    this.log(message, 'error');
  }

  warn(message) {
    this.log(message, 'warn');
  }
}

module.exports = BasePlugin;
