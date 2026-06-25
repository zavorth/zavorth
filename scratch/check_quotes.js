import fs from 'fs';

const content = fs.readFileSync('../openclaw-latest/src/utils.ts', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('export function sliceUtf16Safe'));
if (idx !== -1) {
  console.log('Lines before sliceUtf16Safe:');
  console.log(lines.slice(Math.max(0, idx - 25), idx).join('\n'));
} else {
  console.log('Not found!');
}
