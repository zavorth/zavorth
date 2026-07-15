import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-live-executor-gate-'));
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const credentialStoreFile = join(tempDir, 'credential-refs.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'intent-model6-check-signing-key-0000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionLiveExecutorGateContract.ts',
  'src/services/ZavorthTransactionLiveExecutorGateService.ts',
  'scripts/zavorth-transaction-live-executor-gate.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionLiveExecutorGateContract.test.ts',
  'tests/services/ZavorthTransactionLiveExecutorGateService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-live-executor-gate',
  'zavorth:transaction-live-executor-gate:json',
  'zavorth:transaction-live-executor-gate:check',
  'qa:zavorth-transaction-live-executor-gate',
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

  const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionLiveExecutorGateContract.ts'), 'utf8');
  const serviceText = readFileSync(join(root, 'src/services/ZavorthTransactionLiveExecutorGateService.ts'), 'utf8');
  const docsText = readFileSync(join(root, 'docs/README.md'), 'utf8');
  for (const marker of [
    'zavorth-transaction-live-executor-gate/checkpoint-16',
    'ZAVORTH LIVE EXECUTOR READY HOLD',
    'live-ready-held',
    'noBundledFinancialAdapter',
    'externalAdapterBindingRequired',
    'executeLive=true',
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
    'Intent model6 exchange paper ref',
    '--connector-kind',
    'exchange',
    '--environment',
    'paper',
    '--actions',
    'trade-order',
    '--owner-approved',
  ]);
  const ref = credential.record?.ref;

  const needsMicroRollout = runGateExpectFailure([
    ...readyBeforeMicroRolloutArgs(ref),
    '--live-operator-confirm',
    '--live-operator-phrase-default',
    '--safe-live-adapter',
  ]);
  if (needsMicroRollout.status !== 'micro-rollout-certification-required') {
    failures.push(`micro rollout gate mismatch: ${needsMicroRollout.status}`);
  }

  const needsOperator = runGateExpectFailure([...microRolloutCertifiedArgs(ref), '--safe-live-adapter']);
  if (needsOperator.status !== 'live-operator-confirmation-required') {
    failures.push(`live operator gate mismatch: ${needsOperator.status}`);
  }

  const needsAdapter = runGateExpectFailure([
    ...microRolloutCertifiedArgs(ref),
    '--live-operator-confirm',
    '--live-operator-phrase-default',
  ]);
  if (needsAdapter.status !== 'live-adapter-required') {
    failures.push(`live adapter gate mismatch: ${needsAdapter.status}`);
  }

  const ready = runGate([
    ...microRolloutCertifiedArgs(ref),
    '--live-operator-confirm',
    '--live-operator-phrase-default',
    '--live-run-id',
    'intent-model6-live-run',
    '--safe-live-adapter',
  ]);
  if (ready.status !== 'live-ready-held') {
    failures.push(`live-ready-held mismatch: ${ready.status}`);
  }
  if (
    !ready.readinessPacket?.liveExecutorReady ||
    ready.readinessPacket?.liveExecutionAuthorized !== false ||
    ready.readinessPacket?.externalSideEffects !== false
  ) {
    failures.push('readiness packet must be ready-held with no live authorization or side effects');
  }
  if (!ready.gates.every((gate) => gate.passed === true)) {
    failures.push('live-ready-held should pass every Intent model6 gate');
  }

  const executeLive = runGateExpectFailure([
    ...microRolloutCertifiedArgs(ref),
    '--live-operator-confirm',
    '--live-operator-phrase-default',
    '--safe-live-adapter',
    '--execute-live',
  ]);
  if (executeLive.status !== 'live-policy-blocked') {
    failures.push(`execute-live should be policy-blocked, got ${executeLive.status}`);
  }

  const oversized = runGateExpectFailure([
    ...microRolloutCertifiedArgs(ref),
    '--live-operator-confirm',
    '--live-operator-phrase-default',
    '--safe-live-adapter',
    '--live-maximum-amount',
    '50',
  ]);
  if (oversized.status !== 'live-policy-blocked') {
    failures.push(`oversized live amount should be policy-blocked, got ${oversized.status}`);
  }

  const rawSecret = runGateExpectFailure([
    '--json',
    '--surface',
    'api',
    '--ledger-file',
    ledgerFile,
    '--credential-store-file',
    credentialStoreFile,
    '--text',
    'Buy ETH up to R$100 using api_key=sk-super-secret-value-123456.',
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
    '--safe-sandbox-adapter',
    '--sandbox-execution-confirm',
    '--sandbox-execution-phrase-default',
    '--micro-rollout-confirm',
    '--micro-rollout-phrase-default',
    '--safe-micro-rollout-controls',
    '--live-operator-confirm',
    '--live-operator-phrase-default',
    '--safe-live-adapter',
  ]);
  if (JSON.stringify(rawSecret).includes('sk-super-secret-value-123456')) {
    failures.push('live executor gate output leaked raw secret');
  }
  if (rawSecret.status !== 'micro-rollout-certification-required') {
    failures.push(`raw secret should micro-rollout-block, got ${rawSecret.status}`);
  }

  if (failures.length > 0) {
    console.error('[transaction-live-executor-gate-intent-model6-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-live-executor-gate-intent-model6-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- Intent model6 consumes Intent model4-15 micro-rollout-certified packets');
  console.log('- dedicated live operator phrase gates readiness');
  console.log(
    '- live adapter manifest, idempotency, price, balance, receipt, kill switch and rollback gates are ready',
  );
  console.log('- execute-live, unsafe amounts and raw secrets remain blocked');
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
    'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
    '--kind',
    'execute-trade',
    '--action-kind',
    'trade-order',
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
    '--safe-sandbox-adapter',
    '--sandbox-execution-confirm',
    '--sandbox-execution-phrase-default',
    '--sandbox-run-id',
    'intent-model6-sandbox-run',
  ];
}

function readyBeforeMicroRolloutArgs(ref) {
  return [...baseArgs(ref)];
}

function microRolloutCertifiedArgs(ref) {
  return [
    ...baseArgs(ref),
    '--micro-rollout-confirm',
    '--micro-rollout-phrase-default',
    '--micro-rollout-review-id',
    'intent-model6-micro-rollout-review',
    '--safe-micro-rollout-controls',
  ];
}

function killSwitchArgs() {
  return [
    '--kill-switch-id',
    'intent-model6-kill-switch',
    '--kill-switch-enabled',
    '--kill-switch-tested',
    '--kill-switch-command',
    'zavorth transaction disable-live --scope intent-model6',
  ];
}

function rollbackArgs() {
  return [
    '--rollback-drill-id',
    'intent-model6-rollback-drill',
    '--rollback-drill-performed',
    '--rollback-drill-successful',
    '--rollback-summary',
    'Replay and rollback completed against the simulated transaction ledger.',
    '--replay-command',
    'npm run zavorth:transaction-live-candidate:json -- --replay intent-model0',
    '--rollback-command',
    'npm run zavorth:transaction-live-activation-review -- --rollback intent-model1',
    '--rollback-artifact',
    'data/runtime/intent-model6-rollback-receipt.json',
  ];
}

function runCredential(args) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-credential.ts', ...args],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
    ),
  );
}

function runGate(args) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-live-executor-gate.ts', ...args],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
    ),
  );
}

function runGateExpectFailure(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-live-executor-gate.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  if (result.status === 0) {
    failures.push(`expected live executor gate command failure for args: ${args.join(' ')}`);
  }
  if (!result.stdout.trim()) {
    failures.push(`expected JSON stdout for failed command, got stderr: ${result.stderr}`);
    return {};
  }
  return JSON.parse(result.stdout);
}
