import { spawnSync } from 'child_process';

const argv = process.argv.slice(2);
const skipSmoke = argv.includes('--skip-smoke');
const skipScan = argv.includes('--skip-scan');
const skipBench = argv.includes('--skip-bench');
const skipRegression = argv.includes('--skip-regression');
const profileArg = argv.find((entry) => entry.startsWith('--profile=')) || null;
const releaseProfile = profileArg ? profileArg.split('=').slice(1).join('=').trim().toLowerCase() : 'alpha';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runStep(label, command, args) {
  console.log(`[release-train] ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(`[release-train] falha ao executar ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

runStep('build', npmCmd, ['run', 'build', '--', '--pretty', 'false']);

if (!skipBench) {
  runStep('benchmarks', npmCmd, ['run', 'qa:bench']);
}

if (!skipRegression) {
  runStep('critical regression', npmCmd, ['run', 'qa:regression']);
}

if (!skipSmoke) {
  runStep('smokes', npmCmd, ['run', 'test:smoke:flows']);
}

if (!skipScan) {
  runStep('release scan', npmCmd, ['run', 'release:scan']);
}

runStep('entrega 6 qa gate', npmCmd, ['run', 'ops:qa', '--', '--profile', releaseProfile, '--require-pass']);
