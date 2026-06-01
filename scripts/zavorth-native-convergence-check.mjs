import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ConvergenceReadinessContract.ts',
  'src/services/ZavorthNativeConvergenceService.ts',
  'scripts/zavorth-native-convergence.ts',
  'scripts/zavorth-native-convergence-check.mjs',
  'scripts/zavorth-native-convergence-hygiene-check.mjs',
  'tests/services/ZavorthNativeConvergenceService.test.ts',
];

const requiredMarkers = [
  ['contract version', 'zavorth-native-convergence'],
  ['action harness pillar', 'action-harness'],
  ['provider mesh pillar', 'provider-mesh'],
  ['channel mesh pillar', 'channel-mesh'],
  ['mnemos learning pillar', 'mnemos-learning'],
  ['curator plane pillar', 'curator-plane'],
  ['runtime tui pillar', 'runtime-tui'],
  ['swarm scale pillar', 'swarm-scale'],
  ['sandbox control pillar', 'sandbox-control'],
  ['satellite voice pillar', 'satellite-voice'],
  ['qa product pillar', 'qa-product'],
  ['no silent mutation', 'noSilentMutation'],
  ['doctor command', 'zavorth doctor convergence'],
];

const requiredScripts = [
  'zavorth:native-convergence',
  'zavorth:native-convergence:json',
  'zavorth:native-convergence:check',
  'qa:zavorth-native-convergence',
  'provider-long-tail-activation',
  'provider-long-tail-activation:check',
  'qa:provider-long-tail-activation',
];

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

const contract = read('src/contracts/ConvergenceReadinessContract.ts');
const service = read('src/services/ZavorthNativeConvergenceService.ts');
const packageJson = read('package.json');
const cli = read('src/zavorth-cli.ts');

for (const [label, marker] of requiredMarkers) {
  if (!contract.includes(marker) && !service.includes(marker)) {
    failures.push(`missing marker: ${label}`);
  }
}

for (const script of requiredScripts) {
  if (!packageJson.includes(`"${script}"`)) failures.push(`missing package script ${script}`);
}

if (!cli.includes('runZavorthConvergenceDoctor')) {
  failures.push('CLI is not wired to convergence doctor');
}

const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npx';
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npx tsx scripts/zavorth-native-convergence.ts --json']
  : ['tsx', 'scripts/zavorth-native-convergence.ts', '--json'];
const run = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 });

if (run.status !== 0) {
  failures.push(`snapshot command failed: ${run.stderr || run.stdout}`);
} else {
  try {
    const snapshot = JSON.parse(run.stdout);
    if (snapshot.contractVersion !== '2026-06-01.zavorth-native-convergence') {
      failures.push('unexpected contract version');
    }
    if (!Array.isArray(snapshot.pillars) || snapshot.pillars.length !== 10) {
      failures.push('expected 10 convergence pillars');
    }
    for (const id of [
      'action-harness',
      'provider-mesh',
      'channel-mesh',
      'mnemos-learning',
      'curator-plane',
      'runtime-tui',
      'swarm-scale',
      'sandbox-control',
      'satellite-voice',
      'qa-product',
    ]) {
      if (!snapshot.pillars.some((pillar) => pillar.id === id)) failures.push(`missing snapshot pillar ${id}`);
    }
    if (snapshot.safety.secretValuesSerialized !== false) failures.push('secret serialization invariant failed');
    if (!snapshot.safety.actionHarnessRequiredForMutation) failures.push('action harness invariant failed');
  } catch (error) {
    failures.push(`snapshot JSON parse failed: ${error.message}`);
  }
}

if (failures.length) {
  console.error('[zavorth-native-convergence-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-native-convergence-check] ok');

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
