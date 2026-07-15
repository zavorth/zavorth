import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-live-micro-rollout-cert-'));
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const credentialStoreFile = join(tempDir, 'credential-refs.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'intent-model4-15-check-signing-key-0000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionLiveMicroRolloutCertificationContract.ts',
  'src/services/ZavorthTransactionLiveMicroRolloutCertificationService.ts',
  'scripts/zavorth-transaction-live-micro-rollout-certification.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionLiveMicroRolloutCertificationContract.test.ts',
  'tests/services/ZavorthTransactionLiveMicroRolloutCertificationService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-live-micro-rollout-certification',
  'zavorth:transaction-live-micro-rollout-certification:json',
  'zavorth:transaction-live-micro-rollout-certification:check',
  'qa:zavorth-transaction-live-micro-rollout-certification',
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

  const contractText = readFileSync(
    join(root, 'src/contracts/ZavorthTransactionLiveMicroRolloutCertificationContract.ts'),
    'utf8',
  );
  const serviceText = readFileSync(
    join(root, 'src/services/ZavorthTransactionLiveMicroRolloutCertificationService.ts'),
    'utf8',
  );
  const docsText = readFileSync(join(root, 'docs/README.md'), 'utf8');
  for (const marker of [
    'zavorth-transaction-live-micro-rollout-certification/checkpoint-14-15',
    'ZAVORTH MICRO ROLLOUT CERTIFICATION ONLY',
    'micro-rollout-certified',
    'liveMicroRolloutAuthorized',
    'certificationOnly',
    'prompt-injection-without-approval',
    'price-drift',
    'controlled-production-hold',
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
    'Intent model4-15 exchange paper ref',
    '--connector-kind',
    'exchange',
    '--environment',
    'paper',
    '--actions',
    'trade-order',
    '--owner-approved',
  ]);
  const ref = credential.record?.ref;

  const needsSandboxExecution = runCertificationExpectFailure([
    ...readyBeforeSandboxArgs(ref),
    '--micro-rollout-confirm',
    '--micro-rollout-phrase-default',
    '--safe-micro-rollout-controls',
  ]);
  if (needsSandboxExecution.status !== 'sandbox-execution-required') {
    failures.push(`sandbox-execution-required mismatch: ${needsSandboxExecution.status}`);
  }

  const needsOwnerReview = runCertificationExpectFailure([
    ...readyControlledExecutorArgs(ref),
    '--safe-micro-rollout-controls',
  ]);
  if (needsOwnerReview.status !== 'micro-rollout-owner-review-required') {
    failures.push(`owner review gate mismatch: ${needsOwnerReview.status}`);
  }

  const certified = runCertification([
    ...readyControlledExecutorArgs(ref),
    '--micro-rollout-confirm',
    '--micro-rollout-phrase-default',
    '--safe-micro-rollout-controls',
  ]);
  if (certified.status !== 'micro-rollout-certified') {
    failures.push(`micro-rollout-certified mismatch: ${certified.status}`);
  }
  if (!certified.certificationPacket?.certifiedForFutureLiveMicroRollout) {
    failures.push('certification packet missing future micro-rollout certification');
  }
  if (
    certified.safety?.liveMicroRolloutAuthorized !== false ||
    certified.safety?.liveExecutionAuthorized !== false ||
    certified.safety?.liveActionApplied !== false ||
    certified.certificationPacket?.externalSideEffects !== false
  ) {
    failures.push('Intent model4-15 must keep live rollout and live execution disabled');
  }
  if (!certified.gates.every((gate) => gate.passed === true)) {
    failures.push('micro-rollout-certified should pass every Intent model4-15 gate');
  }

  const failedScenario = runCertificationExpectFailure([
    ...readyControlledExecutorArgs(ref),
    '--micro-rollout-confirm',
    '--micro-rollout-phrase-default',
    '--safe-micro-rollout-controls',
    '--fail-certification-scenario',
    'price-drift',
  ]);
  if (failedScenario.status !== 'certification-failed') {
    failures.push(`failed certification scenario should fail certification, got ${failedScenario.status}`);
  }

  const oversized = runCertificationExpectFailure([
    ...readyControlledExecutorArgs(ref),
    '--micro-rollout-confirm',
    '--micro-rollout-phrase-default',
    '--micro-max-amount',
    '50',
    '--micro-daily-limit',
    '100',
    '--micro-max-executions-per-day',
    '10',
    '--micro-observation-hours',
    '1',
  ]);
  if (oversized.status !== 'micro-rollout-policy-blocked') {
    failures.push(`oversized micro rollout should be policy-blocked, got ${oversized.status}`);
  }

  const rawSecret = runCertificationExpectFailure([
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
  ]);
  if (JSON.stringify(rawSecret).includes('sk-super-secret-value-123456')) {
    failures.push('live micro-rollout certification output leaked raw secret');
  }
  if (rawSecret.status !== 'sandbox-execution-required') {
    failures.push(`raw secret should sandbox-block, got ${rawSecret.status}`);
  }

  if (failures.length > 0) {
    console.error('[transaction-live-micro-rollout-certification-intent-model4-15-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-live-micro-rollout-certification-intent-model4-15-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- Intent model4-15 consumes Intent model3 sandbox-executed receipts');
  console.log('- dedicated micro-rollout owner phrase gates final certification');
  console.log('- rollout ladder certifies non-live stages and holds live stages');
  console.log('- aggressive certification scenarios, unsafe limits and raw secrets remain blocked');
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
  ];
}

function readyBeforeSandboxArgs(ref) {
  return [
    ...baseArgs(ref),
    '--activation-review-confirm',
    '--activation-review-phrase-default',
    '--safe-default-controls',
    ...killSwitchArgs(),
    ...rollbackArgs(),
    '--safe-sandbox-adapter',
  ];
}

function readyControlledExecutorArgs(ref) {
  return [
    ...readyBeforeSandboxArgs(ref),
    '--sandbox-execution-confirm',
    '--sandbox-execution-phrase-default',
    '--sandbox-run-id',
    'intent-model4-15-sandbox-run',
  ];
}

function killSwitchArgs() {
  return [
    '--kill-switch-id',
    'intent-model4-15-kill-switch',
    '--kill-switch-enabled',
    '--kill-switch-tested',
    '--kill-switch-command',
    'zavorth transaction disable-live --scope intent-model4-15',
  ];
}

function rollbackArgs() {
  return [
    '--rollback-drill-id',
    'intent-model4-15-rollback-drill',
    '--rollback-drill-performed',
    '--rollback-drill-successful',
    '--rollback-summary',
    'Replay and rollback completed against the simulated transaction ledger.',
    '--replay-command',
    'npm run zavorth:transaction-live-candidate:json -- --replay intent-model0',
    '--rollback-command',
    'npm run zavorth:transaction-live-activation-review -- --rollback intent-model1',
    '--rollback-artifact',
    'data/runtime/intent-model4-15-rollback-receipt.json',
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

function runCertification(args) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-live-micro-rollout-certification.ts', ...args],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
    ),
  );
}

function runCertificationExpectFailure(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-live-micro-rollout-certification.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  if (result.status === 0) {
    failures.push(`expected live micro-rollout certification command failure for args: ${args.join(' ')}`);
  }
  if (!result.stdout.trim()) {
    failures.push(`expected JSON stdout for failed command, got stderr: ${result.stderr}`);
    return {};
  }
  return JSON.parse(result.stdout);
}
