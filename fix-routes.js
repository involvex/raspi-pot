const fs = require('fs');
let content = fs.readFileSync('server/index.js', 'utf8');

// Fix all routes missing leading slash in 'api
content = content.replace(/app\.(get|post|use|delete)\('api\//g, 'app.$1(\'/api/');
content = content.replace(/app\.(get|post|use|delete)\("api\//g, 'app.$1("/api/');

fs.writeFileSync('server/index.js', content);
console.log('Fixed all routes');
