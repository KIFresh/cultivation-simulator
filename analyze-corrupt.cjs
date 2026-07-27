const fs = require('fs');
const path = require('path');
const file = process.argv[2];
const buf = fs.readFileSync(file);
let firstNonNull = -1;
for (let i = 0; i < buf.length; i++) { if (buf[i] !== 0x00) { firstNonNull = i; break; } }
// count total nulls
let nullCount = 0;
for (let i = 0; i < buf.length; i++) if (buf[i] === 0x00) nullCount++;
const tail = buf.slice(firstNonNull).toString('utf8', 0, 300);
console.log('FILE=' + file);
console.log('size=' + buf.length + ' firstNonNullOffset=' + firstNonNull + ' totalNulls=' + nullCount);
console.log('--- content after first non-null (first 300 chars) ---');
console.log(tail);
console.log('--- end ---');
