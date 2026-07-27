const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync('corrupt-report.txt', 'utf8').split('\n');
const files = lines.filter(l => l.startsWith('D:\\')).map(l => l.split('  (size=')[0]);
const rows = [];
let fully = 0, partial = 0;
for (const f of files) {
  try {
    const buf = fs.readFileSync(f);
    let off = -1;
    for (let i = 0; i < buf.length; i++) { if (buf[i] !== 0x00) { off = i; break; } }
    let nulls = 0;
    for (let i = 0; i < buf.length; i++) if (buf[i] === 0x00) nulls++;
    const size = buf.length;
    const cat = (nulls === size) ? 'FULL' : 'PART';
    if (cat === 'FULL') fully++; else partial++;
    rows.push({ f: path.relative('.', f), size, off, nulls, cat, tail: size - off });
  } catch (e) {
    rows.push({ f: path.relative('.', f), size: 0, off: -1, nulls: 0, cat: 'ERR', tail: 0, err: e.message });
  }
}
rows.sort((a, b) => (a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : 0));
let out = [];
out.push('TOTAL=' + rows.length + ' FULLY_WIPED=' + fully + ' PARTIAL=' + partial);
out.push('');
for (const r of rows) {
  out.push(`${r.cat}  off=${r.off}  nulls=${r.nulls}/${r.size}  tail=${r.tail}  ${r.f}`);
}
fs.writeFileSync('classify-report.txt', out.join('\n'));
console.log('TOTAL=' + rows.length + ' FULLY_WIPED=' + fully + ' PARTIAL=' + partial);
console.log(out.slice(2).join('\n'));
