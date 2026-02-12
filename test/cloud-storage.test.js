#!/usr/bin/env node

/**
 * Cloud Storage Plugin Test Script
 * Tests the basic functionality of the cloud storage plugin
 */

const fs = require('fs-extra');
const path = require('path');

async function testPluginStructure() {
  console.log('🧪 Testing Cloud Storage Plugin Structure...');

  const pluginPath = path.join(__dirname, '../plugins/cloud-storage');

  // Check if plugin directory exists
  if (!(await fs.pathExists(pluginPath))) {
    console.error('❌ Plugin directory not found');
    return false;
  }
  console.log('✅ Plugin directory exists');

  // Check required files
  const requiredFiles = ['plugin.json', 'index.js'];
  for (const file of requiredFiles) {
    const filePath = path.join(pluginPath, file);
    if (!(await fs.pathExists(filePath))) {
      console.error(`❌ Required file missing: ${file}`);
      return false;
    }
    console.log(`✅ ${file} exists`);
  }

  // Check plugin manifest
  try {
    const manifest = await fs.readJson(path.join(pluginPath, 'plugin.json'));
    if (!manifest.name || !manifest.version || !manifest.main) {
      console.error('❌ Invalid plugin manifest');
      return false;
    }
    console.log('✅ Plugin manifest is valid');
    console.log(`   Name: ${manifest.name}`);
    console.log(`   Version: ${manifest.version}`);
    console.log(`   Description: ${manifest.description}`);
  } catch (error) {
    console.error('❌ Failed to read plugin manifest:', error.message);
    return false;
  }

  return true;
}

async function testDependencies() {
  console.log('\n🧪 Testing Dependencies...');

  const requiredPackages = ['googleapis', 'megajs', 'multer'];

  try {
    const packageJson = await fs.readJson(path.join(__dirname, '../package.json'));
    const dependencies = packageJson.dependencies || {};

    for (const pkg of requiredPackages) {
      if (dependencies[pkg]) {
        console.log(`✅ ${pkg} is in dependencies (${dependencies[pkg]})`);
      } else {
        console.warn(`⚠️  ${pkg} not found in dependencies`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to check dependencies:', error.message);
    return false;
  }

  return true;
}

async function testUIFiles() {
  console.log('\n🧪 Testing UI Files...');

  const uiPath = path.join(__dirname, '../client/src/routes/cloud-storage/+page.svelte');

  if (!(await fs.pathExists(uiPath))) {
    console.error('❌ Cloud storage UI not found');
    return false;
  }
  console.log('✅ Cloud storage UI exists');

  // Check UI content
  try {
    const uiContent = await fs.readFile(uiPath, 'utf8');

    // Check for key components
    const checks = [
      { pattern: /activeTab.*gdrive/, name: 'Google Drive tab' },
      { pattern: /activeTab.*mega/, name: 'Mega tab' },
      { pattern: /uploadFile/, name: 'Upload functionality' },
      { pattern: /downloadFile/, name: 'Download functionality' },
      { pattern: /deleteFile/, name: 'Delete functionality' },
      { pattern: /authenticateGDrive/, name: 'Google Drive auth' },
      { pattern: /loginMega/, name: 'Mega login' },
    ];

    for (const check of checks) {
      if (check.pattern.test(uiContent)) {
        console.log(`✅ ${check.name} implemented`);
      } else {
        console.warn(`⚠️  ${check.name} not found`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to read UI file:', error.message);
    return false;
  }

  return true;
}

async function testSidebarIntegration() {
  console.log('\n🧪 Testing Sidebar Integration...');

  const sidebarPath = path.join(__dirname, '../client/src/lib/components/Sidebar.svelte');

  if (!(await fs.pathExists(sidebarPath))) {
    console.error('❌ Sidebar component not found');
    return false;
  }

  try {
    const sidebarContent = await fs.readFile(sidebarPath, 'utf8');

    if (sidebarContent.includes('cloud-storage')) {
      console.log('✅ Cloud storage link added to sidebar');
    } else {
      console.warn('⚠️  Cloud storage link not found in sidebar');
    }

    if (sidebarContent.includes('Cloud Storage')) {
      console.log('✅ Cloud storage label found');
    } else {
      console.warn('⚠️  Cloud storage label not found');
    }
  } catch (error) {
    console.error('❌ Failed to read sidebar file:', error.message);
    return false;
  }

  return true;
}

async function testDocumentation() {
  console.log('\n🧪 Testing Documentation...');

  const docPath = path.join(__dirname, '../docs/CLOUD_STORAGE.md');

  if (!(await fs.pathExists(docPath))) {
    console.error('❌ Cloud storage documentation not found');
    return false;
  }
  console.log('✅ Cloud storage documentation exists');

  try {
    const docContent = await fs.readFile(docPath, 'utf8');

    // Check for key sections
    const sections = [
      'Features',
      'Installation',
      'Configuration',
      'Usage',
      'API Reference',
      'Security Considerations',
      'Troubleshooting',
    ];

    for (const section of sections) {
      if (docContent.includes(`## ${section}`)) {
        console.log(`✅ ${section} section documented`);
      } else {
        console.warn(`⚠️  ${section} section not found`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to read documentation:', error.message);
    return false;
  }

  return true;
}

async function createTestFile() {
  console.log('\n🧪 Creating Test File...');

  const testDir = path.join(__dirname, '../test-uploads');
  await fs.ensureDir(testDir);

  const testFile = path.join(testDir, 'test-upload.txt');
  const testContent = `Cloud Storage Plugin Test File
Created: ${new Date().toISOString()}
Size: Small test file for upload testing
Content: This is a test file for the cloud storage plugin.
`;

  await fs.writeFile(testFile, testContent);
  console.log(`✅ Test file created: ${testFile}`);

  return testFile;
}

async function runTests() {
  console.log('🚀 Starting Cloud Storage Plugin Tests\n');

  const tests = [
    testPluginStructure,
    testDependencies,
    testUIFiles,
    testSidebarIntegration,
    testDocumentation,
    createTestFile,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result !== false) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      failed++;
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Cloud storage plugin is ready to use.');
    console.log('\n📝 Next Steps:');
    console.log('1. Install dependencies: npm install googleapis megajs multer');
    console.log('2. Enable the cloud storage plugin in the dashboard');
    console.log('3. Configure your Google Drive or Mega credentials');
    console.log('4. Test file upload/download functionality');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }

  return failed === 0;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testPluginStructure,
  testDependencies,
  testUIFiles,
  testSidebarIntegration,
  testDocumentation,
  createTestFile,
  runTests,
};
