import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ZavorthNativeLearningLoopContract.ts',
  'src/services/ZavorthNativeLearningLoopService.ts',
  'scripts/zavorth-native-learning-loop.ts',
  'scripts/zavorth-native-learning-loop-check.mjs',
  'tests/services/ZavorthNativeLearningLoopService.test.ts',
  'docs/native-learning-loop.md',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

const service = read('src/services/ZavorthNativeLearningLoopService.ts');
const contract = read('src/contracts/ZavorthNativeLearningLoopContract.ts');
const packageJson = read('package.json');
const productGate = read('scripts/zavorth-product-readiness-gate.mjs');
const docs = read('docs/native-learning-loop.md');

const markers = [
  ['contract version', 'phase-3-native-learning-loop'],
  ['session search', 'sessionSearchReady'],
  ['auto skill candidate', 'auto-skill-candidate'],
  ['skill improvement candidate', 'skill-improvement-candidate'],
  ['approved nudge', 'approved-nudge'],
  ['user model update', 'user-model-update'],
  ['reversible user model', 'userModelIsReversible'],
  ['security firewall', 'neverLearnsSecurityPolicy'],
  ['untrusted recall', 'untrustedOnRecall'],
  ['top-k recall', 'topKOnly'],
  ['no raw secrets', 'rawSecretsSerialized: false'],
];

for (const [label, marker] of markers) {
  if (!service.includes(marker) && !contract.includes(marker) && !docs.includes(marker)) {
    failures.push(`missing marker: ${label}`);
  }
}

for (const script of [
  'zavorth:native-learning-loop',
  'zavorth:native-learning-loop:json',
  'zavorth:native-learning-loop:check',
  'qa:zavorth-native-learning-loop',
]) {
  if (!packageJson.includes(script)) failures.push(`missing package script ${script}`);
}

if (!productGate.includes('native-learning-loop')) {
  failures.push('product readiness gate is not wired to native learning loop');
}

const run = spawnSync(
  process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npx',
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx tsx scripts/zavorth-native-learning-loop.ts --json --observe "summarize a github pr and list changed files"']
    : ['tsx', 'scripts/zavorth-native-learning-loop.ts', '--json', '--observe', 'summarize a github pr and list changed files'],
  { encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 },
);

if (run.status !== 0) {
  failures.push(`snapshot command failed: ${run.stderr || run.stdout}`);
} else {
  try {
    const snapshot = JSON.parse(run.stdout);
    if (snapshot.contractVersion !== '2026-05-24.phase-3-native-learning-loop') failures.push('unexpected contract version');
    if (!snapshot.summary.sessionSearchReady) failures.push('session search is not ready');
    if (!snapshot.summary.autoSkillCandidateReady) failures.push('auto skill candidate lane is not ready');
    if (!snapshot.summary.skillImprovementCandidateReady) failures.push('skill improvement lane is not ready');
    if (!snapshot.summary.reversibleUserModelReady) failures.push('reversible user model is not ready');
    if (!snapshot.summary.securityPolicyFirewallReady) failures.push('security policy firewall is not ready');
    if (snapshot.summary.rawSecretsSerialized !== false) failures.push('raw secret serialization invariant failed');
    if (!snapshot.invariants.neverLearnsSecurityPolicy) failures.push('security learning invariant failed');
    if (!Array.isArray(snapshot.candidates) || snapshot.candidates.length < 3) failures.push('expected learning candidates');
  } catch (error) {
    failures.push(`snapshot JSON parse failed: ${error.message}`);
  }
}

if (failures.length) {
  console.error('[zavorth-native-learning-loop-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-native-learning-loop-check] ok');

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
