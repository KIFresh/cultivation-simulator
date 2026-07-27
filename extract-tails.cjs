const fs = require('fs');
const path = require('path');
const targets = [
  'src/lib/stream-client.ts',
  'src/app/dashboard/hooks/use-cultivator.ts',
  'src/app/api/narrative/__tests__/route.test.ts',
  'src/lib/__tests__/cultivation-data.test.ts',
];
let out = [];
for (const f of targets) {
  const buf = fs.readFileSync(f);
  let off = -1;
  for (let i = 0; i < buf.length; i++) { if (buf[i] !== 0x00) { off = i; break; } }
  const tail = buf.slice(off).toString('utf8');
  out.push('\n\n========== SALVAGED TAIL: ' + f + ' (offset=' + off + ', len=' + tail.length + ') ==========\n');
  out.push(tail);
}
fs.writeFileSync('salvage.txt', out.join(''));
console.log('wrote salvage.txt');
