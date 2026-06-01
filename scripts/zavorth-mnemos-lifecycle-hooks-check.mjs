import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ZavorthMnemosLifecycleHookContract.ts',
  'src/services/ZavorthMnemosLifecycleHookService.ts',
  'src/contracts/MnemosEventContract.ts',
  'scripts/zavorth-mnemos-lifecycle-hook.ts',
  'tests/services/ZavorthMnemosLifecycleHookService.test.ts',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

const contract = fs.existsSync(requiredFiles[0]) ? fs.readFileSync(requiredFiles[0], 'utf8') : '';
const eventContract = fs.existsSync(requiredFiles[2]) ? fs.readFileSync(requiredFiles[2], 'utf8') : '';
const service = fs.existsSync(requiredFiles[1]) ? fs.readFileSync(requiredFiles[1], 'utf8') : '';
const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';

for (const marker of [
  'session.started',
  'session.ended',
  'user.prompt.submitted',
  'tool.previewed',
  'tool.completed',
  'approval.granted',
  'receipt.emitted',
  'decision.confirmed',
  'promotionRequiresApproval: true',
  'durableSemanticMutation: false',
]) {
  if (!contract.includes(marker) && !eventContract.includes(marker) && !service.includes(marker)) {
    failures.push(`missing lifecycle marker: ${marker}`);
  }
}

for (const marker of ['mnemos:lifecycle', 'mnemos:lifecycle:check']) {
  if (!packageJson.includes(marker)) failures.push(`package script missing: ${marker}`);
}

if (!failures.length) {
  const jest = spawnSync(
    process.execPath,
    ['node_modules/jest/bin/jest.js', 'tests/services/ZavorthMnemosLifecycleHookService.test.ts', '--runInBand'],
    { stdio: 'inherit' },
  );
  if (jest.status !== 0) failures.push(`jest failed with exit code ${jest.status}`);
}

if (failures.length) {
  console.error('[zavorth-mnemos-lifecycle-hooks-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-mnemos-lifecycle-hooks-check] ok');
