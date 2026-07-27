const fs = require('fs');
const path = require('path');

const root = 'D:\\projects\\cultivation-simulator\\src';
const exclude = ['generated', 'src', 'node_modules']; // exclude src/src nested dup + generated
const exts = ['.ts', '.tsx'];
const corrupt = [];
const empty = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (exclude.includes(e.name)) continue;
      walk(full);
    } else if (exts.includes(path.extname(e.name))) {
      try {
        const fd = fs.openSync(full, 'r');
        const buf = Buffer.alloc(16);
        const n = fs.readSync(fd, buf, 0, 16, 0);
        fs.closeSync(fd);
        if (n === 0) { empty.push(full); continue; }
        let bad = false;
        for (let i = 0; i < n; i++) { if (buf[i] === 0x00) { bad = true; break; } }
        if (bad) corrupt.push(full + '  (size=' + fs.statSync(full).size + ')');
      } catch (err) {
        corrupt.push(full + '  [readerr:' + err.message + ']');
      }
    }
  }
}
walk(root);
const out = [];
out.push('CORRUPTED (first bytes contain 0x00): ' + corrupt.length);
out.push(...corrupt);
out.push('');
out.push('EMPTY (0 bytes): ' + empty.length);
out.push(...empty);
fs.writeFileSync('D:\\projects\\cultivation-simulator\\corrupt-report.txt', out.join('\n'));
console.log('CORRUPT=' + corrupt.length + ' EMPTY=' + empty.length);
