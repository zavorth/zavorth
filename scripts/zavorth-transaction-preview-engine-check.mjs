import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/contracts/ZavorthTransactionPreviewContract.ts',
  'src/services/ZavorthTransactionPreviewService.ts',
  'scripts/zavorth-transaction-preview.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionPreviewContract.test.ts',
  'tests/services/ZavorthTransactionPreviewService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-preview',
  'zavorth:transaction-preview:json',
  'zavorth:transaction-preview:check',
  'qa:zavorth-transaction-preview',
];

const requiredMarkers = [
  'zavorth-transaction-preview/checkpoint-2',
  'ready-for-review',
  'needs-clarification',
  'liveActionApplied',
  'executableNow',
  'approvalPrompt',
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

const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionPreviewContract.ts'), 'utf8');
const serviceText = readFileSync(join(root, 'src/services/ZavorthTransactionPreviewService.ts'), 'utf8');
for (const marker of requiredMarkers) {
  if (!contractText.includes(marker) && !serviceText.includes(marker)) {
    failures.push(`missing marker: ${marker}`);
  }
}

function runPreview(text, extraArgs = []) {
  const output = execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-preview.ts', '--json', '--text', text, ...extraArgs],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return JSON.parse(output);
}

const freeText = runPreview('Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.');
if (freeText.intent.kind !== 'unknown-transaction') {
  failures.push(`free text must not activate product kind, got ${freeText.intent.kind}`);
}

const trade = runPreview('Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.', [
  '--kind',
  'execute-trade',
  '--action-kind',
  'trade-order',
]);
if (trade.status !== 'ready-for-review') {
  failures.push(`trade preview status mismatch: ${trade.status}`);
}
if (trade.connector.kind !== 'exchange') {
  failures.push(`trade connector mismatch: ${trade.connector.kind}`);
}
if (trade.approval.required !== true || trade.approval.status !== 'pending') {
  failures.push('trade approval envelope mismatch');
}
if (trade.policy.liveActionApplied !== false || trade.policy.executableNow !== false) {
  failures.push('trade preview must not be executable or apply live action');
}

const vague = runPreview('Buy this for me later.', ['--kind', 'purchase-product']);
if (vague.status !== 'needs-clarification') {
  failures.push(`vague preview should need clarification, got ${vague.status}`);
}

const secret = runPreview('Buy ETH up to R$100 using api_key=sk-super-secret-value-123456.');
if (secret.status !== 'blocked') {
  failures.push(`secret preview should be blocked, got ${secret.status}`);
}
if (JSON.stringify(secret).includes('sk-super-secret-value-123456')) {
  failures.push('secret preview leaked raw secret');
}

if (failures.length > 0) {
  console.error('[transaction-preview-preview-engine-check] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[transaction-preview-preview-engine-check] ok');
console.log('- contract, service, CLI, docs and tests are present');
console.log('- transaction intents become reviewable previews');
console.log('- live effects remain impossible in Preview engine');
console.log('- unclear or secret-bearing requests are not approval-ready');
