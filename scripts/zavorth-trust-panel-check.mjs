import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthTrustPanelContract.ts',
  'src/services/ZavorthTrustPanelService.ts',
  'scripts/zavorth-trust-panel.ts',
  'tests/services/ZavorthTrustPanelService.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-trust-panel.ts', '--profile=business', '--category=security', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'trust-panel') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.advanced.commandCenterCanExecute !== false) {
  throw new Error('trust panel must not execute actions');
}
if (snapshot.safety.projectionOnly !== true || snapshot.safety.liveActionsRequirePolicyBroker !== true) {
  throw new Error('trust panel safety invariant missing');
}
if (!snapshot.buckets.some((bucket) => bucket.id === 'blocked' && bucket.rules.some((rule) => rule.id === 'raw-secret-handling'))) {
  throw new Error('raw secret blocking rule missing');
}
if (!snapshot.buckets.some((bucket) => bucket.id === 'asks_first' && bucket.rules.some((rule) => rule.id === 'workspace-mutation'))) {
  throw new Error('workspace mutation approval rule missing');
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthTrustPanelService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-trust-panel-check] ok');
