import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthSatelliteApprovalCompanionContract.ts',
  'src/services/ZavorthSatelliteApprovalCompanionService.ts',
  'scripts/zavorth-satellite-approval-companion.ts',
  'tests/services/ZavorthSatelliteApprovalCompanionService.test.ts',
  'src/satellite/index.html',
  'src/satellite/satellite.js',
  'src/satellite/satellite.css',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-satellite-approval-companion.ts', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'satellite-approval-companion') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.route !== '/satellite') {
  throw new Error(`unexpected route ${snapshot.route}`);
}
if (snapshot.safety.satelliteCanExecuteTargetAction !== false || snapshot.safety.rawSecretsSerialized !== false) {
  throw new Error('satellite safety invariant missing');
}
if (!snapshot.cards.every((card) => card.safety.satelliteCanExecuteTargetAction === false)) {
  throw new Error('satellite cards must not execute target actions');
}
if (!snapshot.cards.every((card) => card.buttons.every((button) => button.websocketEnvelope.type === 'capability.result'))) {
  throw new Error('satellite buttons must use capability.result decision envelopes');
}
if (/\bsk-[A-Za-z0-9_-]{12,}\b/.test(output)) {
  throw new Error('raw secret leaked in satellite approval companion output');
}

const satelliteJs = readFileSync(path.join(root, 'src/satellite/satellite.js'), 'utf8');
for (const forbidden of [
  /authToken\s*:\s*authTokenInput/,
  /sharedSecret\s*:\s*sharedSecretInput/,
  /config\.authToken/,
  /config\.sharedSecret/,
  /decision\s*===\s*['"]reject['"]/,
  /buildActionButton\(['"]reject['"]/,
]) {
  if (forbidden.test(satelliteJs)) {
    throw new Error(`satellite browser security regression: ${forbidden}`);
  }
}
if (!/localStorage\.removeItem\(key\)/.test(satelliteJs)) {
  throw new Error('satellite queues must purge legacy localStorage payloads');
}
if (!/buildActionButton\(['"]deny['"], ['"]Deny['"]\)/.test(satelliteJs)) {
  throw new Error('satellite deny button must emit the governed deny decision');
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthSatelliteApprovalCompanionService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-satellite-approval-companion-check] ok');
