const PluginManager = require('./server/plugin-manager.js');

async function testPluginLoading() {
  console.log('Testing plugin loading...');

  const pluginManager = new PluginManager();

  try {
    await pluginManager.loadAllPlugins();
    console.log('Available plugins:', pluginManager.getPluginList().map(p => p.name));

    await pluginManager.enablePlugin('cloud-storage');
    console.log('Enabled plugins:', pluginManager.getEnabledPlugins().map(p => p.name));

    const enabledPlugins = pluginManager.getEnabledPlugins();
    const cloudStoragePlugin = enabledPlugins.find(p => p.name === 'cloud-storage');

    if (cloudStoragePlugin && cloudStoragePlugin.instance) {
      console.log('Cloud storage plugin instance:', !!cloudStoragePlugin.instance);
      console.log('Has onHttpRequest:', !!cloudStoragePlugin.instance.onHttpRequest);
    } else {
      console.log('Cloud storage plugin not found or not properly initialized');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testPluginLoading().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
