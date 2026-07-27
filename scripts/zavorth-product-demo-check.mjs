import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthProductDemoContract.ts',
  'src/services/ZavorthProductDemoService.ts',
  'src/services/ZavorthConnectorExperienceService.ts',
  'scripts/zavorth-product-demo.ts',
  'scripts/zavorth-connectors.ts',
  'assets/zavorth-demo/index.html',
  'tests/services/ZavorthProductDemoService.test.ts',
  'tests/services/ZavorthConnectorExperienceService.test.ts',
  'tests/cli/ZavorthCliProductDemo.test.ts',
  'docs/quickstart.md',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const scriptName of [
  'zavorth:start',
  'zavorth:demo',
  'zavorth:demo:browser',
  'zavorth:demo:json',
  'zavorth:demo:doctor',
  'zavorth:connectors',
  'zavorth:connectors:doctor',
  'zavorth:demo:check',
  'qa:zavorth-product-demo',
]) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`missing package script ${scriptName}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-product-demo.ts', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);
const connectorsOutput = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-connectors.ts', 'doctor', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const connectorsSnapshot = JSON.parse(connectorsOutput);

if (connectorsSnapshot.status !== 'ready' && connectorsSnapshot.status !== 'needs_setup') {
  throw new Error(`unexpected connector doctor status ${connectorsSnapshot.status}`);
}
for (const connector of ['github', 'telegram', 'discord']) {
  if (!connectorsSnapshot.connectors?.some((entry) => entry.id === connector)) {
    throw new Error(`connector doctor missing ${connector}`);
  }
}

if (snapshot.surface !== 'product-demo') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.phase !== 'F') {
  throw new Error(`unexpected phase ${snapshot.phase}`);
}
if (snapshot.command?.primary !== 'zavorth start') {
  throw new Error('Phase F must expose zavorth start as the primary command');
}
if (snapshot.command?.connectors !== 'zavorth connectors doctor') {
  throw new Error('Phase F must expose the public connector doctor');
}
if (snapshot.quickstart?.estimatedMinutes > 10) {
  throw new Error('Phase E quickstart must stay inside ten minutes');
}
if (snapshot.visualHome?.route !== '/control' || snapshot.visualHome?.openCommand !== 'zavorth go') {
  throw new Error('Phase F must point the visual demo at Home through zavorth go');
}
if (snapshot.visualHome?.browserDemoCommand !== 'zavorth demo browser') {
  throw new Error('Phase F must expose a browser visual demo command');
}
for (const connector of ['github', 'github-pr-comment', 'telegram', 'discord']) {
  if (!snapshot.connectors?.checklist?.some((entry) => entry.id === connector)) {
    throw new Error(`connector checklist missing ${connector}`);
  }
}
if (snapshot.smoke?.command !== 'npm run zavorth:demo:check') {
  throw new Error('Phase E smoke command mismatch');
}
if (snapshot.safety?.internalRuntimeNamesHiddenFromPrimaryPath !== true) {
  throw new Error('Phase F must keep internals hidden from the primary path');
}

const quickstart = readFileSync(path.join(root, 'docs/quickstart.md'), 'utf8');
for (const marker of [
  'zavorth start',
  'zavorth demo',
  'zavorth connectors doctor',
  '10-Minute Path',
  'GitHub checklist',
  'Telegram checklist',
  'Discord checklist',
  'npm run zavorth:demo:check',
]) {
  if (!quickstart.includes(marker)) {
    throw new Error(`quickstart marker missing: ${marker}`);
  }
}

const visualDemo = readFileSync(path.join(root, 'assets/zavorth-demo/index.html'), 'utf8');
for (const marker of [
  'Static product demo — not a live agent session',
  'Approve',
  'Receipt',
  'Approvals',
  'Proof / Receipts',
  'data-trust-loop-demo',
  '#00e88f',
]) {
  if (!visualDemo.includes(marker)) {
    throw new Error(`visual demo marker missing: ${marker}`);
  }
}
const honestyStripped = visualDemo
  .replace(/not a live agent session/gi, '')
  .replace(/is not a live agent session/gi, '');
if (/\blive agent (session|runtime)\b/i.test(honestyStripped)) {
  throw new Error('visual demo must not claim a live agent session or live agent runtime');
}

// CLI product-demo suite remains soft-skipped in jest ignore list (legacy PT fixtures).
// Keep service-level demo contracts hermetic and green here.
execFileSync(
  runner,
  [
    ...prefix,
    'jest',
    '--runTestsByPath',
    'tests/services/ZavorthProductDemoService.test.ts',
    'tests/services/ZavorthConnectorExperienceService.test.ts',
    '--runInBand',
  ],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-product-demo-check] ok');
