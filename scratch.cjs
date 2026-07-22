const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) { 
      results.push(file);
    }
  });
  return results;
}
const files = walk('./src/components/flows');
const keys = new Set();
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(/t\(['"]([a-zA-Z0-9_]+)['"]/g);
  if (matches) {
    matches.forEach(m => {
      const key = m.slice(3, -1);
      keys.add(key);
    });
  }
});
const existing = fs.readFileSync('./src/lib/next-intl.ts', 'utf8');
const missing = Array.from(keys).filter(k => !existing.includes('Flows.builder.' + k + '"') && !existing.includes('Flows.' + k + '"') && !existing.includes('"' + k + '"'));
console.log(missing.join('\n'));
