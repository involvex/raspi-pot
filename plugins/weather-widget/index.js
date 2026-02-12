const BasePlugin = require('../../server/base-plugin.js');

class WeatherWidgetPlugin extends BasePlugin {
  constructor(manifest) {
    super(manifest);
    this.settings = manifest.settings || {};
    this.weatherData = null;
    this.lastUpdate = 0;
    this.updateInterval = this.settings.updateInterval || 1800000; // 30 minutes
  }

  async enable() {
    await super.enable();
    this.log('Weather widget plugin enabled');

    // Initial weather fetch
    await this.updateWeatherData();
  }

  async onHttpRequest(req, res, next) {
    // Handle weather API routes
    if (req.path === '/api/plugins/weather' && req.method === 'GET') {
      try {
        await this.ensureFreshWeatherData();
        res.json({
          success: true,
          data: this.weatherData,
          location: this.settings.location,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
      return;
    }

    // Handle settings update
    if (req.path === '/api/plugins/weather/settings' && req.method === 'POST') {
      try {
        this.settings = { ...this.settings, ...req.body };
        this.updateInterval = this.settings.updateInterval || 1800000;
        await this.updateWeatherData();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
      return;
    }

    next();
  }

  async ensureFreshWeatherData() {
    const now = Date.now();
    if (!this.weatherData || now - this.lastUpdate > this.updateInterval) {
      await this.updateWeatherData();
    }
  }

  async updateWeatherData() {
    try {
      // For demo purposes, return mock data
      // In production, you'd integrate with a real weather API
      this.weatherData = this.getMockWeatherData();
      this.lastUpdate = Date.now();
      this.log('Weather data updated');
    } catch (error) {
      this.error(`Failed to update weather data: ${error.message}`);
      throw error;
    }
  }

  getMockWeatherData() {
    const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Sunny'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];

    return {
      current: {
        temperature: Math.round(15 + Math.random() * 20),
        condition: randomCondition,
        humidity: Math.round(40 + Math.random() * 40),
        windSpeed: Math.round(5 + Math.random() * 15),
        pressure: Math.round(1000 + Math.random() * 30),
        visibility: Math.round(8 + Math.random() * 4),
        uvIndex: Math.round(1 + Math.random() * 8),
        feelsLike: Math.round(15 + Math.random() * 20),
      },
      forecast: Array.from({ length: 5 }, (_, i) => ({
        date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toLocaleDateString(),
        high: Math.round(18 + Math.random() * 15),
        low: Math.round(8 + Math.random() * 10),
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        precipitation: Math.round(Math.random() * 80),
      })),
      lastUpdated: new Date().toISOString(),
    };
  }

  async getWeatherData() {
    await this.ensureFreshWeatherData();
    return this.weatherData;
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.updateInterval = this.settings.updateInterval || 1800000;
    await this.updateWeatherData();
    this.log('Weather settings updated');
  }
}

module.exports = WeatherWidgetPlugin;
