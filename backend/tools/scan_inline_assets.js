const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const results = [];

  const inlineScriptRe = /<script\b(?![^>]*\bnonce=)[^>]*>([\s\S]*?)<\/script>/i;
  const inlineStyleTagRe = /<style\b(?![^>]*\bnonce=)[^>]*>([\s\S]*?)<\/style>/i;
  const styleAttrRe = /style=\"([^\"]*)\"/i;
  const eventHandlerRe = /\bon\w+\s*=\s*\"([^\"]*)\"/i; // onClick, onsubmit etc

  lines.forEach((line, idx) => {
    if (inlineScriptRe.test(line)) results.push({line: idx+1, type: 'inline-script', snippet: line.trim()});
    if (inlineStyleTagRe.test(line)) results.push({line: idx+1, type: 'inline-style-tag', snippet: line.trim()});
    if (styleAttrRe.test(line)) results.push({line: idx+1, type: 'style-attr', snippet: line.trim()});
    if (eventHandlerRe.test(line)) results.push({line: idx+1, type: 'inline-event', snippet: line.trim()});
  });

  return results;
}

let total = 0;
const report = {};

for (const f of files) {
  const fp = path.join(publicDir, f);
  const res = scanFile(fp);
  report[f] = res;
  total += res.length;
}

console.log('Inline asset scan report');
console.log('Public HTML files scanned:', files.length);
console.log('Total inline occurrences found:', total);
console.log('---\n');
for (const f of files) {
  const items = report[f];
  if (!items || items.length === 0) continue;
  console.log(f + ':');
  items.forEach(it => {
    console.log(`  [${it.type}] line ${it.line}: ${it.snippet.substring(0,200)}`);
  });
  console.log('');
}

if (total === 0) process.exit(0);
process.exit(0);
