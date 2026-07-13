/**
 * Optional sync helper: copies monorepo sdk/plugin sources and rewrites imports
 * into a standalone package-local form. The published package ships standalone
 * JS implementations by default; this script is for maintainers who want to
 * re-pull algorithmic changes from the monorepo tree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const monorepoSdk = path.resolve(packageRoot, '../../src/sdk/plugin');
const outDir = path.join(packageRoot, 'src', 'synced');

if (!fs.existsSync(monorepoSdk)) {
  console.error('Monorepo sdk/plugin not found; skip sync.');
  process.exit(0);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const name of fs.readdirSync(monorepoSdk)) {
  if (!name.endsWith('.ts')) continue;
  const source = fs.readFileSync(path.join(monorepoSdk, name), 'utf8');
  const rewritten = source
    .replace(/from\s+['"]\.\.\/\.\.\/contracts\/[^'"]+['"]/g, "from './types.stub.js'")
    .replace(/from\s+['"]\.\.\/module\/[^'"]+['"]/g, "from './module.stub.js'")
    .replace(/from\s+['"]\.\.\/\.\.\/\.\.\/src\/[^'"]+['"]/g, "from './types.stub.js'");
  fs.writeFileSync(path.join(outDir, name), rewritten, 'utf8');
}

console.log(`Synced monorepo plugin sdk into ${outDir} (imports rewritten; review before shipping).`);
