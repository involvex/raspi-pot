const fs = require('fs');
let content = fs.readFileSync('server/index.js', 'utf8');
const lines = content.split('\n');

// Fix line 70: 'api/cloud-storage' should be '/api/cloud-storage'
lines[69] = 'app.use(\'/api/cloud-storage\', (req, res, next) => {';

// Fix line 102: 'api/cloud-storage/gdrive/status' should be '/api/cloud-storage/gdrive/status'
lines[101] = 'app.get(\'/api/cloud-storage/gdrive/status\', (req, res) => {';

// Fix line 106: 'api/cloud-storage/mega/status' should be '/api/cloud-storage/mega/status'
lines[105] = 'app.get(\'/api/cloud-storage/mega/status\', (req, res) => {';

// Fix line 110: 'api/cloud-storage/mega/login' should be '/api/cloud-storage/mega/login'
lines[109] = 'app.post(\'/api/cloud-storage/mega/login\', (req, res) => {';

// Fix line 115: 'api/plugins' should be '/api/plugins'
lines[114] = 'app.get(\'/api/plugins\', async(req, res) => {';

// Fix other API routes
for (let i = 0; i < lines.length; i++) {
  // Skip lines we already fixed
  if ([69, 101, 105, 109, 114].includes(i)) continue;

  // Fix patterns: 'api or "api should be '/api or "/api
  if (lines[i].includes('\'api/') || lines[i].includes('"api/')) {
    lines[i] = lines[i].replace(/'([("])api\//g, '$1/api/');
  }
}

fs.writeFileSync('server/index.js', lines.join('\n'));
console.log('Fixed server/index.js');
