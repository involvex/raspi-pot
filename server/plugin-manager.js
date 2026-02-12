const fs = require('fs-extra');
const path = require('path');
const { EventEmitter } = require('events');

class PluginManager extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();
    this.pluginDir = path.join(__dirname, '../plugins');
    this.configPath = path.join(__dirname, '../plugins.json');
    this.enabledPlugins = new Set();

    this.ensurePluginDirectory();
    this.loadPluginConfig();
  }

  async ensurePluginDirectory() {
    await fs.ensureDir(this.pluginDir);
  }

  async loadPluginConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const config = await fs.readJson(this.configPath);
        this.enabledPlugins = new Set(config.enabled || []);
      }
    } catch (error) {
      console.error('Failed to load plugin config:', error);
    }
  }

  async savePluginConfig() {
    try {
      const config = {
        enabled: Array.from(this.enabledPlugins),
        lastUpdated: new Date().toISOString()
      };
      await fs.writeJson(this.configPath, config, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save plugin config:', error);
    }
  }

  async loadPlugin(pluginName) {
    try {
      console.log(`Loading plugin: ${pluginName}`);
      const pluginPath = path.join(this.pluginDir, pluginName);
      const manifestPath = path.join(pluginPath, 'plugin.json');

      console.log(`Plugin path: ${pluginPath}`);
      console.log(`Manifest path: ${manifestPath}`);

      if (!(await fs.pathExists(manifestPath))) {
        throw new Error(`Plugin manifest not found: ${manifestPath}`);
      }

      const manifest = await fs.readJson(manifestPath);
      console.log(`Manifest loaded for ${pluginName}:`, manifest.name);

      // Validate manifest
      if (!manifest.name || !manifest.version || !manifest.main) {
        throw new Error('Invalid plugin manifest');
      }

      // Load plugin module
      const mainPath = path.join(pluginPath, manifest.main);
      console.log(`Main file path: ${mainPath}`);

      if (!(await fs.pathExists(mainPath))) {
        throw new Error(`Plugin main file not found: ${mainPath}`);
      }

      delete require.cache[require.resolve(mainPath)];
      const PluginClass = require(mainPath);
      console.log(`Plugin class loaded: ${PluginClass.name}`);

      // Create plugin instance
      const plugin = new PluginClass(manifest);
      console.log(`Plugin instance created: ${plugin.name}`);

      // Store plugin
      this.plugins.set(pluginName, {
        instance: plugin,
        manifest,
        enabled: this.enabledPlugins.has(pluginName)
      });

      console.log(`Plugin loaded: ${pluginName} v${manifest.version}`);
      this.emit('pluginLoaded', pluginName, manifest);

      return true;
    } catch (error) {
      console.error(`Failed to load plugin ${pluginName}:`, error);
      this.emit('pluginError', pluginName, error);
      return false;
    }
  }

  async enablePlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    if (plugin.enabled) {
      return true;
    }

    try {
      await plugin.instance.enable();
      plugin.enabled = true;
      this.enabledPlugins.add(pluginName);
      await this.savePluginConfig();

      console.log(`Plugin enabled: ${pluginName}`);
      this.emit('pluginEnabled', pluginName);
      return true;
    } catch (error) {
      console.error(`Failed to enable plugin ${pluginName}:`, error);
      this.emit('pluginError', pluginName, error);
      return false;
    }
  }

  async disablePlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    if (!plugin.enabled) {
      return true;
    }

    try {
      await plugin.instance.disable();
      plugin.enabled = false;
      this.enabledPlugins.delete(pluginName);
      await this.savePluginConfig();

      console.log(`Plugin disabled: ${pluginName}`);
      this.emit('pluginDisabled', pluginName);
      return true;
    } catch (error) {
      console.error(`Failed to disable plugin ${pluginName}:`, error);
      this.emit('pluginError', pluginName, error);
      return false;
    }
  }

  async installPlugin(pluginData) {
    try {
      const { name, version, files } = pluginData;
      const pluginPath = path.join(this.pluginDir, name);

      // Create plugin directory
      await fs.ensureDir(pluginPath);

      // Write plugin files
      for (const file of files) {
        const filePath = path.join(pluginPath, file.path);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, file.content);
      }

      // Load the plugin
      await this.loadPlugin(name);

      console.log(`Plugin installed: ${name} v${version}`);
      this.emit('pluginInstalled', name);
      return true;
    } catch (error) {
      console.error('Failed to install plugin:', error);
      this.emit('pluginError', 'install', error);
      return false;
    }
  }

  async uninstallPlugin(pluginName) {
    try {
      // Disable plugin first
      if (this.enabledPlugins.has(pluginName)) {
        await this.disablePlugin(pluginName);
      }

      // Remove plugin from memory
      this.plugins.delete(pluginName);
      this.enabledPlugins.delete(pluginName);

      // Remove plugin files
      const pluginPath = path.join(this.pluginDir, pluginName);
      await fs.remove(pluginPath);

      await this.savePluginConfig();

      console.log(`Plugin uninstalled: ${pluginName}`);
      this.emit('pluginUninstalled', pluginName);
      return true;
    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginName}:`, error);
      this.emit('pluginError', pluginName, error);
      return false;
    }
  }

  async loadAllPlugins() {
    try {
      console.log(`Loading plugins from directory: ${this.pluginDir}`);
      const pluginDirs = await fs.readdir(this.pluginDir);
      console.log(`Found plugin directories: ${pluginDirs}`);

      for (const dir of pluginDirs) {
        const pluginPath = path.join(this.pluginDir, dir);
        const stat = await fs.stat(pluginPath);

        if (stat.isDirectory()) {
          console.log(`Loading plugin from directory: ${dir}`);
          await this.loadPlugin(dir);
        }
      }

      // Enable plugins that were previously enabled
      console.log(`Previously enabled plugins: ${Array.from(this.enabledPlugins)}`);
      for (const pluginName of this.enabledPlugins) {
        if (this.plugins.has(pluginName)) {
          await this.enablePlugin(pluginName);
        }
      }

      console.log(`Loaded ${this.plugins.size} plugins`);
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
  }

  getPluginList() {
    return Array.from(this.plugins.entries()).map(([name, plugin]) => ({
      name,
      manifest: plugin.manifest,
      enabled: plugin.enabled
    }));
  }

  getEnabledPlugins() {
    return Array.from(this.plugins.entries())
      .filter(([_, plugin]) => plugin.enabled)
      .map(([name, plugin]) => ({
        name,
        manifest: plugin.manifest,
        instance: plugin.instance
      }));
  }

  // Hook system for plugins to extend functionality
  async executeHook(hookName, ...args) {
    const results = [];

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.instance[hookName]) {
        try {
          const result = await plugin.instance[hookName](...args);
          results.push({ plugin: plugin.name, result });
        } catch (error) {
          console.error(`Hook ${hookName} failed in plugin ${plugin.name}:`, error);
        }
      }
    }

    return results;
  }
}

module.exports = PluginManager;
