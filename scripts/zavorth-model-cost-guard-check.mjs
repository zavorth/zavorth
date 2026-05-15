import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthModelCostGuardContract.ts',
  'src/services/ZavorthModelCostGuardService.ts',
  'scripts/zavorth-model-cost-guard.ts',
  'tests/services/ZavorthModelCostGuardService.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-model-cost-guard.ts', '--profile=personal', '--request=review this entire repository deeply', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'model-cost-guard') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.safety.rawSecretsSerialized !== false) {
  throw new Error('model cost guard must not serialize raw secrets');
}
if (snapshot.safety.paidEscalationRequiresApproval !== true) {
  throw new Error('paid escalation approval invariant missing');
}
if (!['ask_before_live', 'allow_with_budget', 'allow_preview', 'block_until_configured'].includes(snapshot.routing.decision)) {
  throw new Error(`unexpected decision ${snapshot.routing.decision}`);
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthModelCostGuardService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-model-cost-guard-check] ok');
