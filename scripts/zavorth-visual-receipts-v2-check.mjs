import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthVisualReceiptsV2Contract.ts',
  'src/services/ZavorthVisualReceiptsV2Service.ts',
  'scripts/zavorth-visual-receipts-v2.ts',
  'tests/services/ZavorthVisualReceiptsV2Service.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-visual-receipts-v2.ts', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'visual-receipts-v2') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.safety.dashboardCanExecute !== false || snapshot.safety.rawSecretsSerialized !== false) {
  throw new Error('visual receipts v2 safety invariant missing');
}
if (!snapshot.cards.every((card) => card.safeActions.every((action) => action.dashboardCanExecute === false))) {
  throw new Error('receipt actions must not execute from dashboard');
}
if (/\bsk-[A-Za-z0-9_-]{12,}\b/.test(output)) {
  throw new Error('raw secret leaked in visual receipts v2 output');
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthVisualReceiptsV2Service.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-visual-receipts-v2-check] ok');
