import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-approval-'));
const ledgerFile = join(tempDir, 'ledger.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'approval-gate-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionApprovalContract.ts',
  'src/services/ZavorthTransactionApprovalLedgerService.ts',
  'scripts/zavorth-transaction-approval.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionApprovalContract.test.ts',
  'tests/services/ZavorthTransactionApprovalLedgerService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-approval',
  'zavorth:transaction-approval:json',
  'zavorth:transaction-approval:check',
  'qa:zavorth-transaction-approval',
];

const failures = [];

try {
  for (const file of requiredFiles) {
    try {
      readFileSync(join(root, file), 'utf8');
    } catch {
      failures.push(`missing file: ${file}`);
    }
  }

  const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
  for (const script of requiredPackageScripts) {
    if (!packageJson.includes(`"${script}"`)) {
      failures.push(`missing package script: ${script}`);
    }
  }

  const serviceText = readFileSync(join(root, 'src/services/ZavorthTransactionApprovalLedgerService.ts'), 'utf8');
  for (const marker of ['liveExecutionAuthorized: false', 'liveActionApplied: false', 'approval-blocked', 'payloadDigest']) {
    if (!serviceText.includes(marker)) {
      failures.push(`missing service marker: ${marker}`);
    }
  }

  const approved = runApproval([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--text',
    'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
    '--decision',
    'approve',
    '--reason',
    'approval-gate check approval',
  ]);

  if (approved.decisionEntry.kind !== 'approval-granted') {
    failures.push(`approval kind mismatch: ${approved.decisionEntry.kind}`);
  }
  if (approved.decisionEntry.approvalStatus !== 'approved') {
    failures.push(`approval status mismatch: ${approved.decisionEntry.approvalStatus}`);
  }
  if (approved.decisionEntry.liveExecutionAuthorized !== false || approved.decisionEntry.liveActionApplied !== false) {
    failures.push('approval must not authorize or apply live execution');
  }
  if (!approved.decisionEntry.signature || !approved.decisionEntry.payloadDigest) {
    failures.push('approval entry missing signature or digest');
  }

  const vague = runApproval([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--text',
    'Compre isso para mim depois.',
    '--decision',
    'approve',
  ]);
  if (vague.decisionEntry.kind !== 'approval-blocked') {
    failures.push(`vague approval should be blocked, got ${vague.decisionEntry.kind}`);
  }

  const secret = runApproval([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--text',
    'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
    '--decision',
    'approve',
  ]);
  if (JSON.stringify(secret).includes('sk-super-secret-value-123456')) {
    failures.push('approval output leaked raw secret');
  }
  if (secret.decisionEntry.kind !== 'approval-blocked') {
    failures.push(`secret approval should be blocked, got ${secret.decisionEntry.kind}`);
  }

  const summary = runApproval(['--json', '--ledger-file', ledgerFile, '--summary']);
  if (summary.entries < 6 || summary.approvalsGranted !== 1 || summary.approvalsBlocked < 2) {
    failures.push(`ledger summary mismatch: ${JSON.stringify(summary)}`);
  }
  if (summary.liveActionsApplied !== 0 || summary.executableEntries !== 0) {
    failures.push('ledger summary must show zero live/executable entries');
  }

  const ledgerText = readFileSync(ledgerFile, 'utf8');
  if (ledgerText.includes('sk-super-secret-value-123456')) {
    failures.push('ledger file leaked raw secret');
  }

  if (failures.length > 0) {
    console.error('[transaction-approval-approval-gate-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-approval-approval-gate-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- approvals are signed and appended to JSONL');
  console.log('- approval never authorizes live execution in Approval gate');
  console.log('- unclear or secret-bearing previews cannot be approval-granted');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function runApproval(args) {
  const output = execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-approval.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  return JSON.parse(output);
}
