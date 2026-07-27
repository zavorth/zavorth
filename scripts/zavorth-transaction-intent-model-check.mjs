import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/contracts/ZavorthTransactionIntentContract.ts',
  'src/services/ZavorthTransactionIntentService.ts',
  'scripts/zavorth-transaction-intent.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionIntentContract.test.ts',
  'tests/services/ZavorthTransactionIntentService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-intent',
  'zavorth:transaction-intent:json',
  'zavorth:transaction-intent:check',
  'qa:zavorth-transaction-intent',
];

const requiredMarkers = [
  'zavorth-transaction-intent/gate-1',
  'execute-trade',
  'pay-bill',
  'buy-api-credits',
  'approval-proposal',
  'sourceWasRedacted',
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`missing file: ${file}`);
  }
}

const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
for (const script of requiredPackageScripts) {
  if (!packageJson.includes(`"${script}"`)) {
    failures.push(`missing package script: ${script}`);
  }
}

const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionIntentContract.ts'), 'utf8');
const serviceText = readFileSync(join(root, 'src/services/ZavorthTransactionIntentService.ts'), 'utf8');
for (const marker of requiredMarkers) {
  if (!contractText.includes(marker) && !serviceText.includes(marker)) {
    failures.push(`missing marker: ${marker}`);
  }
}

if (!serviceText.includes('input.kind') || serviceText.includes('detectIntentRule')) {
  failures.push('free-text keyword intent activation must be removed (structured kind only)');
}

function runJson(text, extraArgs = []) {
  const output = execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-intent.ts', '--json', '--text', text, ...extraArgs],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return JSON.parse(output);
}

const freeText = runJson('Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.');
if (freeText.intent.kind !== 'unknown-transaction' || freeText.intent.actionKind !== 'cart-preview') {
  failures.push(`free text must not activate product kind, got ${freeText.intent.kind}/${freeText.intent.actionKind}`);
}

const eth = runJson('Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.', [
  '--kind',
  'execute-trade',
  '--action-kind',
  'trade-order',
]);
if (eth.intent.kind !== 'execute-trade') {
  failures.push(`ETH intent kind mismatch: ${eth.intent.kind}`);
}
if (eth.intent.naturalFirstRoute !== 'approval-proposal') {
  failures.push(`ETH route mismatch: ${eth.intent.naturalFirstRoute}`);
}
if (eth.intent.safetyDecision.allowed !== true || eth.intent.safetyDecision.status !== 'dry-run-only') {
  failures.push(`ETH safety mismatch: ${eth.intent.safetyDecision.status}`);
}

const monitor = runJson('Monitor notebook below R$3500 and notify me.', [
  '--kind',
  'monitor-price',
  '--action-kind',
  'price-monitor',
]);
if (monitor.intent.kind !== 'monitor-price' || monitor.intent.actionKind !== 'price-monitor') {
  failures.push(`monitor parse mismatch: ${monitor.intent.kind}/${monitor.intent.actionKind}`);
}
if (monitor.intent.naturalFirstRoute !== 'tool-preview') {
  failures.push(`monitor route mismatch: ${monitor.intent.naturalFirstRoute}`);
}

const secret = runJson('Buy ETH up to R$100 with api_key=sk-super-secret-value-123456.');
if (secret.intent.sourceText.includes('sk-super-secret-value-123456')) {
  failures.push('secret text was not redacted');
}
if (secret.intent.safetyDecision.status !== 'blocked') {
  failures.push(`secret policy should be blocked, got ${secret.intent.safetyDecision.status}`);
}

if (failures.length > 0) {
  console.error('[transaction-intent-intent-model-check] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[transaction-intent-intent-model-check] ok');
console.log('- contract, service, CLI, docs and tests are present');
console.log('- free text never activates transaction kind (structured kind only)');
console.log('- structured examples parse into governed intents');
console.log('- raw transaction secrets are redacted and blocked');
