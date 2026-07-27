import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ZavorthAdaptiveLearningOsContract.ts',
  'src/contracts/ZavorthAdaptiveLearningSemanticContract.ts',
  'src/services/ZavorthAdaptiveLearningOsService.ts',
  'src/services/ZavorthAdaptiveTechnicalSafetyScannerService.ts',
  'src/services/ZavorthAdaptiveSemanticClassifierService.ts',
  'src/services/ZavorthAdaptiveMultilingualRecallService.ts',
  'src/services/ZavorthAdaptiveLearningI18nService.ts',
  'scripts/zavorth-adaptive-learning-os.ts',
  'scripts/zavorth-adaptive-learning-os-check.mjs',
  'tests/services/ZavorthAdaptiveLearningOsService.test.ts',
  'tests/services/ZavorthAdaptiveSemanticClassifierService.test.ts',
  'docs/adaptive-learning-os.md',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

const service = read('src/services/ZavorthAdaptiveLearningOsService.ts');
const contract = read('src/contracts/ZavorthAdaptiveLearningOsContract.ts');
const semanticContract = read('src/contracts/ZavorthAdaptiveLearningSemanticContract.ts');
const technicalScanner = read('src/services/ZavorthAdaptiveTechnicalSafetyScannerService.ts');
const semanticClassifier = read('src/services/ZavorthAdaptiveSemanticClassifierService.ts');
const multilingualRecall = read('src/services/ZavorthAdaptiveMultilingualRecallService.ts');
const i18n = read('src/services/ZavorthAdaptiveLearningI18nService.ts');
const docs = read('docs/adaptive-learning-os.md');
const packageJson = read('package.json');

for (const [label, marker] of [
  ['contract version', 'adaptive-learning-os.v1'],
  ['green lane', 'Green Lane'],
  ['yellow lane', 'Yellow Lane'],
  ['red lane', 'Red Lane'],
  ['evidence-bound user model', 'evidence-bound'],
  ['shadow skills', 'shadowSkills'],
  ['psychological safety', 'rawPsychologicalDiagnosisBlocked'],
  ['approval invariant', 'everyDurableBehaviorChangeRequiresApproval'],
  ['multilingual normalization', 'normalizeForPolicy'],
  ['snapshot redaction', 'redact('],
  ['non-mutating native preview support', 'commitGreenMemory'],
  ['technical scanner service', 'ZavorthAdaptiveTechnicalSafetyScannerService'],
  ['semantic classifier contract', 'ZavorthAdaptiveSemanticClassifier'],
  ['semantic classification snapshot', 'semanticClassifierUsed'],
  ['multilingual recall service', 'ZavorthAdaptiveMultilingualRecallService'],
  ['operator i18n catalog', 'ZavorthAdaptiveLearningI18nService'],
  ['technical scanner invariant', 'technicalScannerReady'],
  ['semantic classifier invariant', 'semanticClassifierGoverned'],
  ['semantic llm gate runtime', 'semanticLlmGate'],
  ['semantic llm gate contract', 'ZavorthAdaptiveSemanticLlmGate'],
  ['semantic llm response schema', 'responseSchema'],
  ['semantic llm gated evidence', 'semantic-provider:llm-gated-json'],
  ['multilingual recall invariant', 'multilingualRecallLocalOnly'],
  ['operator i18n invariant', 'operatorI18nReady'],
]) {
  if (!service.includes(marker)
    && !contract.includes(marker)
    && !semanticContract.includes(marker)
    && !technicalScanner.includes(marker)
    && !semanticClassifier.includes(marker)
    && !multilingualRecall.includes(marker)
    && !i18n.includes(marker)
    && !docs.includes(marker)) {
    failures.push(`missing marker: ${label}`);
  }
}

for (const script of [
  'zavorth:adaptive-learning-os',
  'zavorth:adaptive-learning-os:json',
  'zavorth:adaptive-learning-os:check',
  'qa:zavorth-adaptive-learning-os',
]) {
  if (!packageJson.includes(script)) failures.push(`missing package script ${script}`);
}

const jestRun = runCommand('npx jest tests/services/ZavorthAdaptiveLearningOsService.test.ts tests/services/ZavorthAdaptiveSemanticClassifierService.test.ts --runInBand');
if (jestRun.status !== 0) {
  failures.push(`jest failed: ${jestRun.stderr || jestRun.stdout}`);
}

const greenRun = runCommand('npx tsx scripts/zavorth-adaptive-learning-os.ts --json --strict --observe=direct-portuguese-evidence-concise-tradeoffs');
if (greenRun.status !== 0) {
  failures.push(`green lane snapshot failed: ${greenRun.stderr || greenRun.stdout}`);
} else {
  try {
    const snapshot = JSON.parse(greenRun.stdout);
    if (snapshot.summary.greenAutoApplied < 1) failures.push('green lane did not auto-apply low-risk learning');
    if (snapshot.safety.rawPsychologicalDiagnosisBlocked !== true) failures.push('psychological diagnosis invariant missing');
    if (snapshot.safety.technicalScannerReady !== true) failures.push('technical scanner invariant missing');
    if (snapshot.safety.semanticClassifierGoverned !== true) failures.push('semantic classifier invariant missing');
    if (snapshot.safety.multilingualRecallLocalOnly !== true) failures.push('multilingual recall invariant missing');
    if (snapshot.safety.operatorI18nReady !== true) failures.push('operator i18n invariant missing');
    if (!snapshot.classification?.technical?.scanned) failures.push('technical classification snapshot missing');
    if (!snapshot.classification?.semantic) failures.push('semantic classification snapshot missing for green probe');
  } catch (error) {
    failures.push(`green lane JSON parse failed: ${error.message}`);
  }
}

const redRun = runCommand('npx tsx scripts/zavorth-adaptive-learning-os.ts --json --strict --observe=depressed-psychological-fragile');
if (redRun.status !== 0) {
  failures.push(`red lane snapshot failed: ${redRun.stderr || redRun.stdout}`);
} else {
  try {
    const snapshot = JSON.parse(redRun.stdout);
    if (snapshot.summary.redApprovalRequired < 1) failures.push('red lane did not require approval');
    if (snapshot.memoryWrites.length !== 0) failures.push('sensitive inference was persisted');
    if (!snapshot.classification?.technical?.findings?.includes('sensitive-user-state')) {
      failures.push('red lane did not expose technical sensitive-user-state finding');
    }
  } catch (error) {
    failures.push(`red lane JSON parse failed: ${error.message}`);
  }
}

const portugueseSensitiveRun = runCommand('npx tsx scripts/zavorth-adaptive-learning-os.ts --json --strict --observe=sensitive-user-state-fixture');
if (portugueseSensitiveRun.status !== 0) {
  failures.push(`Portuguese sensitive snapshot failed: ${portugueseSensitiveRun.stderr || portugueseSensitiveRun.stdout}`);
} else {
  try {
    const snapshot = JSON.parse(portugueseSensitiveRun.stdout);
    if (snapshot.status !== 'attention') failures.push('Portuguese sensitive inference was not attention status');
    if (snapshot.summary.redApprovalRequired < 1) failures.push('Portuguese sensitive inference did not require approval');
    if (snapshot.memoryWrites.length !== 0) failures.push('Portuguese sensitive inference was persisted');
  } catch (error) {
    failures.push(`Portuguese sensitive JSON parse failed: ${error.message}`);
  }
}

const policyRun = runCommand('npx tsx scripts/zavorth-adaptive-learning-os.ts --json --strict --observe=unsafe-policy-change-fixture');
if (policyRun.status !== 0) {
  failures.push(`policy snapshot failed: ${policyRun.stderr || policyRun.stdout}`);
} else {
  try {
    const snapshot = JSON.parse(policyRun.stdout);
    if (snapshot.status !== 'blocked') failures.push('policy-changing observation was not blocked');
    if (!snapshot.ledger.entries.some((entry) => entry.decision === 'rejected')) failures.push('policy-changing observation was not rejected');
    if (snapshot.memoryWrites.length !== 0) failures.push('policy-changing observation was persisted');
  } catch (error) {
    failures.push(`policy JSON parse failed: ${error.message}`);
  }
}

const secretRun = runCommand('npx tsx scripts/zavorth-adaptive-learning-os.ts --json --strict --observe=After-successful-runs-summarize-github-pr-api_key=sk-testsecret123-token=ghp_secretvalue');
if (secretRun.status !== 0) {
  failures.push(`secret redaction snapshot failed: ${secretRun.stderr || secretRun.stdout}`);
} else {
  try {
    JSON.parse(secretRun.stdout);
    if (secretRun.stdout.includes('sk-testsecret123') || secretRun.stdout.includes('ghp_secretvalue')) {
      failures.push('secret value leaked in adaptive learning snapshot');
    }
    if (!secretRun.stdout.includes('[REDACTED]')) failures.push('secret snapshot did not include redaction marker');
  } catch (error) {
    failures.push(`secret redaction JSON parse failed: ${error.message}`);
  }
}

if (failures.length) {
  console.error('[zavorth-adaptive-learning-os-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-adaptive-learning-os-check] ok');

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function runCommand(command) {
  return spawnSync(
    process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'sh',
    process.platform === 'win32'
      ? ['/d', '/s', '/c', command]
      : ['-lc', command],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 },
  );
}
