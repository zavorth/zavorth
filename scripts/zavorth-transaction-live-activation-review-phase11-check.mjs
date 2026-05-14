import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-live-activation-review-'));
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const credentialStoreFile = join(tempDir, 'credential-refs.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'phase11-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionLiveActivationReviewContract.ts',
  'src/services/ZavorthTransactionLiveActivationReviewService.ts',
  'scripts/zavorth-transaction-live-activation-review.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionLiveActivationReviewContract.test.ts',
  'tests/services/ZavorthTransactionLiveActivationReviewService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-live-activation-review',
  'zavorth:transaction-live-activation-review:json',
  'zavorth:transaction-live-activation-review:phase11:check',
  'qa:zavorth-transaction-live-activation-review',
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

  const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionLiveActivationReviewContract.ts'), 'utf8');
  const serviceText = readFileSync(join(root, 'src/services/ZavorthTransactionLiveActivationReviewService.ts'), 'utf8');
  const docsText = readFileSync(join(root, 'docs/README.md'), 'utf8');
  for (const marker of [
    'zavorth-transaction-live-activation-review/phase-11',
    'ZAVORTH LIVE ACTIVATION REVIEW ONLY',
    'ready-for-live-activation-review',
    'kill-switch-ready',
    'rollback-drill-ready',
    'separate-live-executor-required',
    'doesNotAuthorizeLiveExecution',
  ]) {
    if (!contractText.includes(marker) && !serviceText.includes(marker) && !docsText.includes(marker)) {
      failures.push(`missing marker: ${marker}`);
    }
  }

  const credential = runCredential([
    '--json',
    '--store-file',
    credentialStoreFile,
    '--register',
    '--label',
    'Phase 11 exchange paper ref',
    '--connector-kind',
    'exchange',
    '--environment',
    'paper',
    '--actions',
    'trade-order',
    '--owner-approved',
  ]);
  const ref = credential.record?.ref;

  const needsOwnerReview = runActivationExpectFailure([
    ...baseArgs(ref),
    '--safe-default-controls',
    ...killSwitchArgs(),
    ...rollbackArgs(),
  ]);
  if (needsOwnerReview.status !== 'owner-review-required') {
    failures.push(`owner review status mismatch: ${needsOwnerReview.status}`);
  }
  if (!needsOwnerReview.gates.some((gate) => gate.kind === 'owner-activation-review' && gate.passed === false)) {
    failures.push('owner activation review gate should be false before phrase');
  }

  const needsRollback = runActivationExpectFailure([
    ...baseArgs(ref),
    '--activation-review-confirm',
    '--activation-review-phrase-default',
    '--safe-default-controls',
    ...killSwitchArgs(),
  ]);
  if (needsRollback.status !== 'rollback-drill-required') {
    failures.push(`rollback gate status mismatch: ${needsRollback.status}`);
  }

  const ready = runActivation([
    ...baseArgs(ref),
    '--activation-review-confirm',
    '--activation-review-phrase-default',
    '--safe-default-controls',
    ...killSwitchArgs(),
    ...rollbackArgs(),
  ]);
  if (ready.status !== 'ready-for-live-activation-review' || ready.reviewPacket?.reviewOnly !== true) {
    failures.push(`review-ready mismatch: ${ready.status}`);
  }
  if (ready.reviewPacket?.activationAuthorized !== false || ready.safety.liveExecutionAuthorized !== false || ready.safety.executableNow !== false || ready.safety.liveActionApplied !== false) {
    failures.push('Phase 11 review packet must still keep live execution disabled');
  }
  if (!ready.gates.every((gate) => gate.passed === true)) {
    failures.push('review-ready should pass every Phase 11 gate');
  }

  const rawSecret = runActivationExpectFailure([
    '--json',
    '--surface',
    'api',
    '--ledger-file',
    ledgerFile,
    '--credential-store-file',
    credentialStoreFile,
    '--text',
    'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
    '--approve',
    '--mode',
    'paper',
    '--credential-ref',
    ref,
    '--owner-id',
    'grey',
    '--owner-confirm',
    '--owner-phrase-default',
    '--activation-review-confirm',
    '--activation-review-phrase-default',
    '--safe-default-controls',
    ...killSwitchArgs(),
    ...rollbackArgs(),
  ]);
  if (JSON.stringify(rawSecret).includes('sk-super-secret-value-123456')) {
    failures.push('live activation review output leaked raw secret');
  }
  if (rawSecret.status !== 'candidate-required') {
    failures.push(`raw secret should candidate-block before review, got ${rawSecret.status}`);
  }

  if (failures.length > 0) {
    console.error('[transaction-live-activation-review-phase11-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-live-activation-review-phase11-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- Phase 11 consumes Phase 10 candidate-ready envelopes');
  console.log('- owner review, kill switch, limits and rollback drill gate the review packet');
  console.log('- review-ready still does not authorize or execute live transactions');
  console.log('- raw secrets remain redacted and blocked');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function baseArgs(ref) {
  return [
    '--json',
    '--surface',
    'api',
    '--ledger-file',
    ledgerFile,
    '--credential-store-file',
    credentialStoreFile,
    '--text',
    'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
    '--approve',
    '--mode',
    'paper',
    '--credential-ref',
    ref,
    '--owner-id',
    'grey',
    '--owner-confirm',
    '--owner-phrase-default',
  ];
}

function killSwitchArgs() {
  return [
    '--kill-switch-id',
    'phase11-kill-switch',
    '--kill-switch-enabled',
    '--kill-switch-tested',
    '--kill-switch-command',
    'zavorth transaction disable-live --scope phase11',
  ];
}

function rollbackArgs() {
  return [
    '--rollback-drill-id',
    'phase11-rollback-drill',
    '--rollback-drill-performed',
    '--rollback-drill-successful',
    '--rollback-summary',
    'Replay and rollback completed against the simulated transaction ledger.',
    '--replay-command',
    'npm run zavorth:transaction-live-candidate:json -- --replay phase10',
    '--rollback-command',
    'npm run zavorth:transaction-live-activation-review -- --rollback phase11',
    '--rollback-artifact',
    'data/runtime/phase11-rollback-receipt.json',
  ];
}

function runCredential(args) {
  return JSON.parse(execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-credential.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  ));
}

function runActivation(args) {
  return JSON.parse(execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-live-activation-review.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  ));
}

function runActivationExpectFailure(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-live-activation-review.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  if (result.status === 0) {
    failures.push(`expected live activation review command failure for args: ${args.join(' ')}`);
  }
  return JSON.parse(result.stdout);
}
