import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthExperienceLayerDailyUseCertificationContract.ts',
  'src/services/ZavorthExperienceLayerDailyUseCertificationService.ts',
  'scripts/zavorth-experience-layer-daily-use-certification.ts',
  'tests/services/ZavorthExperienceLayerDailyUseCertificationService.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-experience-layer-daily-use-certification.ts', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'experience-layer-daily-use-certification') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.result !== 'passed') {
  throw new Error(`experience layer certification blocked: ${snapshot.result}`);
}
if (snapshot.coveredPhases !== 13 || snapshot.phases.length !== 13) {
  throw new Error(`expected 13 covered phases, got ${snapshot.coveredPhases}/${snapshot.phases.length}`);
}
if (snapshot.safety.hiddenExecutionAuthority !== false) {
  throw new Error('experience layer must not have hidden execution authority');
}
if (!snapshot.phases.some((phase) => phase.command === 'zavorth daily')) {
  throw new Error('CLI daily-use entrypoint is not certified');
}
if (!snapshot.phases.some((phase) => phase.command === 'zavorth zavorthControl-home')) {
  throw new Error('ZavorthControl Home is not certified');
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthExperienceLayerDailyUseCertificationService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-experience-layer-daily-use-certification-check] ok');
