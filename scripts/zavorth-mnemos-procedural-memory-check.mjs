import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ZavorthMnemosProceduralMemoryContract.ts',
  'src/services/ZavorthMnemosProceduralMemoryService.ts',
  'scripts/zavorth-mnemos-procedural-memory.ts',
  'tests/services/ZavorthMnemosProceduralMemoryService.test.ts',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

const contract = fs.existsSync(requiredFiles[0]) ? fs.readFileSync(requiredFiles[0], 'utf8') : '';
const service = fs.existsSync(requiredFiles[1]) ? fs.readFileSync(requiredFiles[1], 'utf8') : '';
const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';

const markers = [
  ['procedural version', 'zavorth-mnemos-procedural-memory-v1'],
  ['approval policy', 'approval-policy'],
  ['workflow preference', 'workflow-preference'],
  ['provider preference', 'provider-preference'],
  ['safety boundary', 'safety-boundary'],
  ['approval required', 'approvalRequiredForWrite'],
  ['explicit revocation', 'explicitRevocation'],
  ['no raw secrets', 'noRawSecrets'],
  ['no provider call', 'providerCall: false'],
  ['no network call', 'networkCall: false'],
];

for (const [label, marker] of markers) {
  if (!contract.includes(marker) && !service.includes(marker)) {
    failures.push(`missing marker: ${label}`);
  }
}

if (!packageJson.includes('mnemos:procedural')) failures.push('package script mnemos:procedural missing');
if (!packageJson.includes('mnemos:procedural:check')) failures.push('package script mnemos:procedural:check missing');

if (!failures.length) {
  const jest = spawnSync(
    process.execPath,
    ['node_modules/jest/bin/jest.js', 'tests/services/ZavorthMnemosProceduralMemoryService.test.ts', '--runInBand'],
    { stdio: 'inherit' },
  );
  if (jest.status !== 0) failures.push(`jest failed with exit code ${jest.status}`);
}

if (failures.length) {
  console.error('[zavorth-mnemos-procedural-memory-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-mnemos-procedural-memory-check] ok');
