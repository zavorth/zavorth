import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthCliExperienceParityContract.ts',
  'src/services/ZavorthCliExperienceParityService.ts',
  'scripts/zavorth-cli-experience-parity.ts',
  'tests/services/ZavorthCliExperienceParityService.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-cli-experience-parity.ts', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'cli-experience-parity') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (!snapshot.entryCommands.includes('zavorth daily')) {
  throw new Error('zavorth daily entrypoint missing');
}
if (snapshot.safety.cliCanExecuteTargetAction !== false) {
  throw new Error('cli experience parity must not execute target actions');
}
if (!snapshot.commands.some((command) => command.command.includes('zavorth ask-runtime'))) {
  throw new Error('runtime question commands missing');
}
if (!snapshot.commands.some((command) => command.command.includes('zavorth guided-missions'))) {
  throw new Error('guided mission commands missing');
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthCliExperienceParityService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-cli-experience-parity-check] ok');
