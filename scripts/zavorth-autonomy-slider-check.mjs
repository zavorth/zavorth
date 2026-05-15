import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthAutonomySliderContract.ts',
  'src/services/ZavorthAutonomySliderService.ts',
  'scripts/zavorth-autonomy-slider.ts',
  'tests/services/ZavorthAutonomySliderService.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-autonomy-slider.ts', '--profile=personal', '--level=advanced', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'autonomy-slider') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.requestedLevel !== 'advanced') {
  throw new Error(`expected advanced, got ${snapshot.requestedLevel}`);
}
if (snapshot.applyPlan.canApplyAutomatically !== false || snapshot.applyPlan.requiresPolicyBroker !== true) {
  throw new Error('autonomy slider must not apply authority by itself');
}
if (!snapshot.policyPreview.alwaysBlocked.some((entry) => /secret|approval|destructive/i.test(entry))) {
  throw new Error('always-blocked safety preview missing');
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthAutonomySliderService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-autonomy-slider-check] ok');
