import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ZavorthMnemosLintContract.ts',
  'src/services/ZavorthMnemosLintService.ts',
  'scripts/zavorth-mnemos-lint.ts',
  'tests/services/ZavorthMnemosLintService.test.ts',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

const contract = fs.existsSync(requiredFiles[0]) ? fs.readFileSync(requiredFiles[0], 'utf8') : '';
const service = fs.existsSync(requiredFiles[1]) ? fs.readFileSync(requiredFiles[1], 'utf8') : '';
const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';

const markers = [
  ['schema drift', 'schema-drift'],
  ['broken link', 'broken-link'],
  ['secret-like', 'secret-like'],
  ['contradiction', 'contradiction'],
  ['prompt injection', 'prompt-injection'],
  ['operator decision', 'operatorDecisionForCritical'],
  ['no provider call', 'providerCall: false'],
  ['no network call', 'networkCall: false'],
  ['no durable mutation', 'durableMutation: false'],
  ['wiki root only', 'wikiRootOnly: true'],
];

for (const [label, marker] of markers) {
  if (!contract.includes(marker) && !service.includes(marker)) {
    failures.push(`missing marker: ${label}`);
  }
}

if (!packageJson.includes('mnemos:lint')) failures.push('package script mnemos:lint missing');
if (!packageJson.includes('mnemos:lint:check')) failures.push('package script mnemos:lint:check missing');

if (!failures.length) {
  const jest = spawnSync(
    process.execPath,
    ['node_modules/jest/bin/jest.js', 'tests/services/ZavorthMnemosLintService.test.ts', '--runInBand'],
    { stdio: 'inherit' },
  );
  if (jest.status !== 0) failures.push(`jest failed with exit code ${jest.status}`);
}

if (failures.length) {
  console.error('[zavorth-mnemos-lint-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-mnemos-lint-check] ok');
