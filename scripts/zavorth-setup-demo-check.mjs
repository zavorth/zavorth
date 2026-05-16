import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthSetupDemoReadinessContract.ts',
  'src/services/ZavorthSetupDemoReadinessService.ts',
  'scripts/zavorth-setup-demo.ts',
  'tests/services/ZavorthSetupDemoReadinessService.test.ts',
  'tests/e2e/ZavorthPhaseDSetupDemoSmoke.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const scriptName of [
  'zavorth:setup-demo',
  'zavorth:setup-demo:json',
  'zavorth:setup-demo:check',
  'qa:zavorth-setup-demo',
]) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`missing package script ${scriptName}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-setup-demo.ts', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'setup-demo-readiness') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.phase !== 'D') {
  throw new Error(`unexpected phase ${snapshot.phase}`);
}
if (snapshot.status !== 'ready') {
  throw new Error(`setup demo readiness blocked: ${snapshot.status}`);
}
if (snapshot.installOnboard?.targetMinutes !== 10 || snapshot.installOnboard.estimatedMinutes > 10) {
  throw new Error('setup/onboard path must stay inside the ten minute target');
}
if (!Array.isArray(snapshot.demoSeed?.fixtures) || snapshot.demoSeed.fixtures.length < 4) {
  throw new Error('demo seed must cover product home, GitHub, daily assistant and receipts');
}
for (const fixture of ['product-home', 'github-governed-review', 'daily-assistant', 'receipts']) {
  if (!snapshot.demoSeed.fixtures.some((entry) => entry.id === fixture)) {
    throw new Error(`demo seed missing fixture ${fixture}`);
  }
}
if (snapshot.safety.noRawSecretsSerialized !== true || snapshot.safety.noLiveExternalIoInSeed !== true) {
  throw new Error('Phase D seed must not serialize secrets or perform live external IO');
}
if (!snapshot.smoke?.checks?.some((check) => check.id === 'e2e-fixture-flow')) {
  throw new Error('Phase D smoke must include the e2e fixture flow');
}

execFileSync(
  runner,
  [
    ...prefix,
    'jest',
    '--runTestsByPath',
    'tests/services/ZavorthSetupDemoReadinessService.test.ts',
    'tests/e2e/ZavorthPhaseDSetupDemoSmoke.test.ts',
    '--runInBand',
  ],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-setup-demo-check] ok');
