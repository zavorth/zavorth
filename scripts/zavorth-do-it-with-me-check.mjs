import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthDoItWithMeContract.ts',
  'src/services/ZavorthDoItWithMeService.ts',
  'scripts/zavorth-do-it-with-me.ts',
  'tests/services/ZavorthDoItWithMeService.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-do-it-with-me.ts', '--request', 'help me configure Telegram approvals', '--category=communication', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'do-it-with-me') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.mode !== 'setup_capability') {
  throw new Error(`expected setup_capability, got ${snapshot.mode}`);
}
if (snapshot.projections.commandCenterCanExecute !== false) {
  throw new Error('do-it-with-me must not be an execution authority');
}
if (snapshot.safety.rawSecretsSerialized !== false || snapshot.safety.liveActionRequiresPolicyBroker !== true) {
  throw new Error('do-it-with-me safety invariant missing');
}
if (!snapshot.steps.some((step) => step.kind === 'secretref')) {
  throw new Error('secretref step missing');
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthDoItWithMeService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-do-it-with-me-check] ok');
