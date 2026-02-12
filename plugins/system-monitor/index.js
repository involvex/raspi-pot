const BasePlugin = require('../../server/base-plugin.js');

class SystemMonitorPlugin extends BasePlugin {
  constructor(manifest) {
    super(manifest);
    this.history = {
      cpu: [],
      memory: [],
      temperature: [],
      timestamps: [],
    };
    this.maxHistorySize = manifest.settings?.historySize || 100;
    this.alertThresholds = manifest.settings?.alertThresholds || {
      cpu: 80,
      memory: 85,
      temperature: 70,
    };
    this.lastAlerts = {};
  }

  async enable() {
    await super.enable();
    this.log('System monitor plugin enabled with advanced monitoring');
  }

  async onTelemetryData(data) {
    // Store historical data
    const timestamp = Date.now();
    this.history.cpu.push(data.cpu);
    this.history.memory.push(data.mem);
    this.history.temperature.push(data.temp);
    this.history.timestamps.push(timestamp);

    // Limit history size
    if (this.history.cpu.length > this.maxHistorySize) {
      this.history.cpu.shift();
      this.history.memory.shift();
      this.history.temperature.shift();
      this.history.timestamps.shift();
    }

    // Check for alerts
    await this.checkAlerts(data);

    // Add computed metrics
    const enhancedData = {
      ...data,
      cpu_avg_5min: this.calculateAverage(this.history.cpu, Math.min(5, this.history.cpu.length)),
      memory_avg_5min: this.calculateAverage(
        this.history.memory,
        Math.min(5, this.history.memory.length)
      ),
      temp_avg_5min: this.calculateAverage(
        this.history.temperature,
        Math.min(5, this.history.temperature.length)
      ),
      system_health_score: this.calculateHealthScore(data),
    };

    return enhancedData;
  }

  calculateAverage(arr, count) {
    if (arr.length === 0) return 0;
    const recent = arr.slice(-count);
    return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  }

  calculateHealthScore(data) {
    let score = 100;

    // CPU impact (30% weight)
    if (data.cpu > 90) score -= 30;
    else if (data.cpu > 80) score -= 20;
    else if (data.cpu > 70) score -= 10;

    // Memory impact (30% weight)
    if (data.mem > 90) score -= 30;
    else if (data.mem > 80) score -= 20;
    else if (data.mem > 70) score -= 10;

    // Temperature impact (40% weight)
    if (data.temp > 80) score -= 40;
    else if (data.temp > 70) score -= 25;
    else if (data.temp > 60) score -= 10;

    return Math.max(0, score);
  }

  async checkAlerts(data) {
    const now = Date.now();
    const alertCooldown = 60000; // 1 minute between alerts

    // CPU Alert
    if (data.cpu > this.alertThresholds.cpu) {
      if (!this.lastAlerts.cpu || now - this.lastAlerts.cpu > alertCooldown) {
        this.warn(`High CPU usage: ${data.cpu}%`);
        this.lastAlerts.cpu = now;
      }
    }

    // Memory Alert
    if (data.mem > this.alertThresholds.memory) {
      if (!this.lastAlerts.memory || now - this.lastAlerts.memory > alertCooldown) {
        this.warn(`High memory usage: ${data.mem}%`);
        this.lastAlerts.memory = now;
      }
    }

    // Temperature Alert
    if (data.temp > this.alertThresholds.temperature) {
      if (!this.lastAlerts.temperature || now - this.lastAlerts.temperature > alertCooldown) {
        this.warn(`High temperature: ${data.temp}°C`);
        this.lastAlerts.temperature = now;
      }
    }
  }

  getHistory() {
    return {
      cpu: this.history.cpu,
      memory: this.history.memory,
      temperature: this.history.temperature,
      timestamps: this.history.timestamps,
    };
  }

  async getMetrics() {
    return {
      history: this.getHistory(),
      alertThresholds: this.alertThresholds,
      currentHealthScore:
        this.history.temperature.length > 0
          ? this.calculateHealthScore({
              cpu: this.history.cpu[this.history.cpu.length - 1],
              mem: this.history.memory[this.history.memory.length - 1],
              temp: this.history.temperature[this.history.temperature.length - 1],
            })
          : 100,
    };
  }
}

module.exports = SystemMonitorPlugin;
