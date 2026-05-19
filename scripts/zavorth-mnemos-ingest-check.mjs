import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ZavorthMnemosIngestContract.ts',
  'src/services/ZavorthMnemosIngestService.ts',
  'scripts/zavorth-mnemos-ingest.ts',
  'tests/services/ZavorthMnemosIngestService.test.ts',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    failures.push(`missing ${file}`);
  }
}

const contract = fs.existsSync(requiredFiles[0]) ? fs.readFileSync(requiredFiles[0], 'utf8') : '';
const service = fs.existsSync(requiredFiles[1]) ? fs.readFileSync(requiredFiles[1], 'utf8') : '';
const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';

const markers = [
  ['preview ready', "'preview-ready'"],
  ['apply blocked', "'blocked'"],
  ['approval required', 'approvalRequired'],
  ['workspace confined', 'workspaceConfined: true'],
  ['no provider call', 'providerCall: false'],
  ['no network call', 'networkCall: false'],
  ['secret redaction', 'SECRET_PATTERNS'],
  ['path confinement', 'path escapes workspace'],
  ['patch preview', 'append-source-note'],
];

for (const [label, marker] of markers) {
  if (!contract.includes(marker) && !service.includes(marker)) {
    failures.push(`missing marker: ${label}`);
  }
}

if (!packageJson.includes('mnemos:ingest')) {
  failures.push('package script mnemos:ingest missing');
}
if (!packageJson.includes('mnemos:ingest:check')) {
  failures.push('package script mnemos:ingest:check missing');
}

if (!failures.length) {
  const jest = spawnSync(
    process.execPath,
    ['node_modules/jest/bin/jest.js', 'tests/services/ZavorthMnemosIngestService.test.ts', '--runInBand'],
    { stdio: 'inherit' },
  );
  if (jest.status !== 0) {
    failures.push(`jest failed with exit code ${jest.status}`);
  }
}

if (failures.length) {
  console.error('[zavorth-mnemos-ingest-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-mnemos-ingest-check] ok');
