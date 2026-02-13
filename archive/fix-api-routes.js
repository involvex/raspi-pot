const fs = require('fs');
let content = fs.readFileSync('server/index.js', 'utf8');

// Fix all instances of 'api/ to be '/api/ and "api/ to be "/api/
content = content.replace(/'api\//g, '\'/api/');
content = content.replace(/"api\//g, '"/api/');

fs.writeFileSync('server/index.js', content);
console.log('Fixed all API routes');
