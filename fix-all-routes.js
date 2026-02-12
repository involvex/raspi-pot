const fs = require('fs');
const content = fs.readFileSync('server/index.js', 'utf8');
const lines = content.split('\n');

// Fix lines with 'api or "api that should be '/api or "/api
const linesToFix = [
  73, 101, 105, 106, 110, 114, 115, 119, 124, 134, 144, 154, 165, 189, 190, 199, 200, 224, 230, 249,
  257
];

for (const i of linesToFix) {
  const line = lines[i];
  if (line.includes('\'api/') || line.includes('"api/')) {
    lines[i] = line.replace(/'([("/])api\//g, '$1/api/');
  }
}

fs.writeFileSync('server/index.js', lines.join('\n'));
console.log(`Fixed ${linesToFix.length} routes`);
