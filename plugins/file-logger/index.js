const BasePlugin = require('../../base-plugin');
const fs = require('fs-extra');
const path = require('path');

class FileLoggerPlugin extends BasePlugin {
  constructor(manifest) {
    super(manifest);
    this.settings = manifest.settings || {};
    this.logFile = path.join(__dirname, '../../../logs', this.settings.logFile || 'raspipot.log');
    this.maxFileSize = this.parseSize(this.settings.maxFileSize || '10MB');
    this.logLevel = this.settings.logLevel || 'info';
    this.logLevels = { error: 0, warn: 1, info: 2, debug: 3 };

    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    try {
      await fs.ensureDir(path.dirname(this.logFile));
    } catch (error) {
      this.error(`Failed to create log directory: ${error.message}`);
    }
  }

  parseSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+)(B|KB|MB|GB)$/i);
    if (!match) return 10 * 1024 * 1024; // Default 10MB
    return parseInt(match[1]) * units[match[2].toUpperCase()];
  }

  async enable() {
    await super.enable();
    await this.writeLog('info', 'File logger plugin enabled');
  }

  async disable() {
    await this.writeLog('info', 'File logger plugin disabled');
    await super.disable();
  }

  async onTelemetryData(data) {
    // Log significant system events
    if (data.cpu > 90) {
      await this.writeLog('warn', `High CPU usage detected: ${data.cpu}%`);
    }

    if (data.mem > 90) {
      await this.writeLog('warn', `High memory usage detected: ${data.mem}%`);
    }

    if (data.temp > 75) {
      await this.writeLog('warn', `High temperature detected: ${data.temp}°C`);
    }

    // Log periodic system status (every 10 minutes approximately)
    if (Math.random() < 0.003) {
      // Roughly every 5 minutes at 2s intervals
      await this.writeLog(
        'info',
        `System status - CPU: ${data.cpu}%, Memory: ${data.mem}%, Temp: ${data.temp}°C`
      );
    }
  }

  async onSocketConnection(socket) {
    await this.writeLog('info', `Client connected: ${socket.id} from ${socket.handshake.address}`);
  }

  async onSocketDisconnection(socket) {
    await this.writeLog('info', `Client disconnected: ${socket.id}`);
  }

  async writeLog(level, message) {
    if (this.logLevels[level] > this.logLevels[this.logLevel]) {
      return; // Skip if below log level
    }

    try {
      await this.rotateLogIfNeeded();

      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  async rotateLogIfNeeded() {
    try {
      const stats = await fs.stat(this.logFile);
      if (stats.size >= this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveFile = this.logFile.replace('.log', `-${timestamp}.log`);
        await fs.move(this.logFile, archiveFile);
        this.log(`Log rotated: ${archiveFile}`);
      }
    } catch (error) {
      // File might not exist yet, which is fine
      if (error.code !== 'ENOENT') {
        this.error(`Failed to rotate log: ${error.message}`);
      }
    }
  }

  async getLogEntries(lines = 100) {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      const allLines = content.trim().split('\n');
      return allLines.slice(-lines);
    } catch (error) {
      this.error(`Failed to read log file: ${error.message}`);
      return [];
    }
  }

  async clearLogs() {
    try {
      await fs.remove(this.logFile);
      await this.writeLog('info', 'Log file cleared');
      return true;
    } catch (error) {
      this.error(`Failed to clear logs: ${error.message}`);
      return false;
    }
  }
}

module.exports = FileLoggerPlugin;
