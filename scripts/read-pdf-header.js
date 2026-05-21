const fs = require('fs');
const path = require('path');
const file = process.argv[2] || 'test-carta.pdf';
const fullPath = path.resolve(__dirname, '..', file);
if (!fs.existsSync(fullPath)) {
  console.error('File not found:', fullPath);
  process.exit(1);
}
const buf = fs.readFileSync(fullPath);
const snippet = buf.slice(0, 16);
const hex = Array.from(snippet).map(b => b.toString(16).padStart(2, '0')).join(' ');
console.log('File:', fullPath);
console.log('Bytes:', hex);
console.log('Text preview:', snippet.toString());
