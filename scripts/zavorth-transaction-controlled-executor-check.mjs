import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-sandbox-controlled-executor-'));
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const credentialStoreFile = join(tempDir, 'credential-refs.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'intent-model3-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionSandboxControlledExecutorContract.ts',
  'src/services/ZavorthTransactionSandboxControlledExecutorService.ts',
  'scripts/zavorth-transaction-sandbox-controlled-executor.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionSandboxControlledExecutorContract.test.ts',
  'tests/services/ZavorthTransactionSandboxControlledExecutorService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-sandbox-controlled-executor',
  'zavorth:transaction-sandbox-controlled-executor:json',
  'zavorth:transaction-sandbox-controlled-executor:check',
  'qa:zavorth-transaction-sandbox-controlled-executor',
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
    join(root, 'src/contracts/ZavorthTransactionSandboxControlledExecutorContract.ts'),
    'utf8',
  );
  const serviceText = readFileSync(
    join(root, 'src/services/ZavorthTransactionSandboxControlledExecutorService.ts'),
    'utf8',
  );
  const docsText = readFileSync(join(root, 'docs/README.md'), 'utf8');
  for (const marker of [
    'zavorth-transaction-sandbox-controlled-executor/gate-13',
    'ZAVORTH CONTROLLED SANDBOX EXECUTION ONLY',
    'sandbox-executed',
    'localSandboxDryRunPerformed',
    'noExternalNetworkCall',
    'sandboxExternalIoPerformed',
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
    'Intent model3 exchange paper ref',
    '--connector-kind',
    'exchange',
    '--environment',
    'paper',
    '--actions',
    'trade-order',
    '--owner-approved',
  ]);
  const ref = credential.record?.ref;

  const needsCertification = runExecutorExpectFailure([
    ...baseArgs(ref),
    '--safe-sandbox-adapter',
    '--sandbox-execution-confirm',
    '--sandbox-execution-phrase-default',
  ]);
  if (needsCertification.status !== 'certification-required') {
    failures.push(`certification-required mismatch: ${needsCertification.status}`);
  }

  const needsOperator = runExecutorExpectFailure([...readySandboxAdapterArgs(ref)]);
  if (needsOperator.status !== 'sandbox-operator-approval-required') {
    failures.push(`operator gate mismatch: ${needsOperator.status}`);
  }

  const executed = runExecutor([
    ...readySandboxAdapterArgs(ref),
    '--sandbox-execution-confirm',
    '--sandbox-execution-phrase-default',
    '--sandbox-run-id',
    'intent-model3-sandbox-run',
  ]);
  if (executed.status !== 'sandbox-executed' || executed.executionReceipt?.localSandboxDryRunPerformed !== true) {
    failures.push(`sandbox execution mismatch: ${executed.status}`);
  }
  if (
    executed.executionReceipt?.sandboxExternalIoPerformed !== false ||
    executed.executionReceipt?.liveExecutionAuthorized !== false ||
    executed.safety.noExternalNetworkCall !== true
  ) {
    failures.push('Intent model3 receipt must keep external and live execution disabled');
  }
  if (!executed.gates.every((gate) => gate.passed === true)) {
    failures.push('sandbox-executed should pass every Intent model3 gate');
  }

  const killed = runExecutorExpectFailure([
    ...readySandboxAdapterArgs(ref),
    '--sandbox-execution-confirm',
    '--sandbox-execution-phrase-default',
    '--force-kill-switch',
  ]);
  if (killed.status !== 'sandbox-execution-blocked') {
    failures.push(`forced kill switch should block, got ${killed.status}`);
  }

  const rawSecret = runExecutorExpectFailure([
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
  ]);
  if (JSON.stringify(rawSecret).includes('sk-super-secret-value-123456')) {
    failures.push('controlled sandbox executor output leaked raw secret');
  }
  if (rawSecret.status !== 'certification-required') {
    failures.push(`raw secret should certification-block, got ${rawSecret.status}`);
  }

  if (failures.length > 0) {
    console.error('[transaction-sandbox-controlled-executor-intent-model3-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-sandbox-controlled-executor-intent-model3-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- Intent model3 consumes Intent model2 sandbox-certification-ready packets');
  console.log('- dedicated sandbox owner phrase gates local sandbox execution');
  console.log('- sandbox-executed emits a local receipt with no endpoint call or live effect');
  console.log('- kill switch, dry-run failure and raw secrets remain blocked');
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

function readySandboxAdapterArgs(ref) {
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

function killSwitchArgs() {
  return [
    '--kill-switch-id',
    'intent-model3-kill-switch',
    '--kill-switch-enabled',
    '--kill-switch-tested',
    '--kill-switch-command',
    'zavorth transaction disable-live --scope intent-model3',
  ];
}

function rollbackArgs() {
  return [
    '--rollback-drill-id',
    'intent-model3-rollback-drill',
    '--rollback-drill-performed',
    '--rollback-drill-successful',
    '--rollback-summary',
    'Replay and rollback completed against the dry-run transaction ledger.',
    '--replay-command',
    'npm run zavorth:transaction-live-candidate:json -- --replay intent-model0',
    '--rollback-command',
    'npm run zavorth:transaction-live-activation-review -- --rollback intent-model1',
    '--rollback-artifact',
    'data/runtime/intent-model3-rollback-receipt.json',
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

function runExecutor(args) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-sandbox-controlled-executor.ts', ...args],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
    ),
  );
}

function runExecutorExpectFailure(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-sandbox-controlled-executor.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  if (result.status === 0) {
    failures.push(`expected controlled sandbox executor command failure for args: ${args.join(' ')}`);
  }
  return JSON.parse(result.stdout);
}
