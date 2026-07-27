const fs = require('fs');
const path = require('path');
const root = 'D:\\projects\\cultivation-simulator\\src';
const excludeDirs = new Set(['generated', 'src', 'node_modules']);
const exts = new Set(['.ts', '.tsx']);
const corrupt = [];
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (excludeDirs.has(e.name)) continue; walk(full); }
    else if (exts.has(path.extname(e.name))) {
      try {
        const buf = fs.readFileSync(full);
        let nulls = 0;
        for (let i = 0; i < buf.length; i++) if (buf[i] === 0x00) nulls++;
        if (nulls > 0) corrupt.push({ f: path.relative('.', full), size: buf.length, nulls });
      } catch (err) { corrupt.push({ f: path.relative('.', full), size: -1, nulls: -1, err: err.message }); }
    }
  }
}
walk(root);
corrupt.sort((a, b) => b.nulls - a.nulls);
let out = [];
out.push('FILES_WITH_ANY_NULL_BYTE=' + corrupt.length);
for (const c of corrupt) out.push(`${c.nulls}\t${c.size}\t${c.f}`);
fs.writeFileSync('all-nulls-report.txt', out.join('\n'));
console.log('FILES_WITH_ANY_NULL_BYTE=' + corrupt.length);
console.log(out.slice(1).join('\n'));
