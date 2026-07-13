import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const name of fs.readdirSync(src)) {
  if (!name.endsWith('.js') && !name.endsWith('.d.ts')) continue;
  if (name === 'index.ts') continue;
  fs.copyFileSync(path.join(src, name), path.join(dist, name));
}

// Ensure package entrypoints exist
if (!fs.existsSync(path.join(dist, 'index.js'))) {
  throw new Error('build failed: dist/index.js missing');
}
if (!fs.existsSync(path.join(dist, 'index.d.ts'))) {
  throw new Error('build failed: dist/index.d.ts missing');
}

console.log('Built @zavorth/plugin-sdk -> dist/');
