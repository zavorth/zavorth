import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-sandbox-adapter-certification-'));
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const credentialStoreFile = join(tempDir, 'credential-refs.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'intent-model2-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionSandboxAdapterCertificationContract.ts',
  'src/services/ZavorthTransactionSandboxAdapterCertificationService.ts',
  'scripts/zavorth-transaction-sandbox-adapter-certification.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionSandboxAdapterCertificationContract.test.ts',
  'tests/services/ZavorthTransactionSandboxAdapterCertificationService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-sandbox-adapter-certification',
  'zavorth:transaction-sandbox-adapter-certification:json',
  'zavorth:transaction-sandbox-adapter-certification:check',
  'qa:zavorth-transaction-sandbox-adapter-certification',
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
    join(root, 'src/contracts/ZavorthTransactionSandboxAdapterCertificationContract.ts'),
    'utf8',
  );
  const serviceText = readFileSync(
    join(root, 'src/services/ZavorthTransactionSandboxAdapterCertificationService.ts'),
    'utf8',
  );
  const docsText = readFileSync(join(root, 'docs/README.md'), 'utf8');
  for (const marker of [
    'zavorth-transaction-sandbox-adapter-certification/checkpoint-12',
    'sandbox-certification-ready',
    'endpoint-allowlist-ready',
    'separate-sandbox-executor-required',
    'noSandboxNetworkCall',
    'sandboxExecutionAuthorized',
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
    'Intent model2 exchange paper ref',
    '--connector-kind',
    'exchange',
    '--environment',
    'paper',
    '--actions',
    'trade-order',
    '--owner-approved',
  ]);
  const ref = credential.record?.ref;

  const needsActivationReview = runCertificationExpectFailure([...baseArgs(ref), '--safe-sandbox-adapter']);
  if (needsActivationReview.status !== 'activation-review-required') {
    failures.push(`activation review status mismatch: ${needsActivationReview.status}`);
  }

  const needsAdapter = runCertificationExpectFailure([...readyActivationReviewArgs(ref)]);
  if (needsAdapter.status !== 'adapter-manifest-required') {
    failures.push(`adapter manifest status mismatch: ${needsAdapter.status}`);
  }

  const ready = runCertification([...readyActivationReviewArgs(ref), '--safe-sandbox-adapter']);
  if (ready.status !== 'sandbox-certification-ready' || ready.certificationPacket?.certificationOnly !== true) {
    failures.push(`sandbox certification mismatch: ${ready.status}`);
  }
  if (
    ready.certificationPacket?.sandboxExecutionAuthorized !== false ||
    ready.certificationPacket?.liveExecutionAuthorized !== false ||
    ready.safety.noSandboxNetworkCall !== true
  ) {
    failures.push('Intent model2 packet must keep sandbox and live execution disabled');
  }
  if (!ready.gates.every((gate) => gate.passed === true)) {
    failures.push('sandbox-certification-ready should pass every Intent model2 gate');
  }

  const liveEndpoint = runCertificationExpectFailure([
    ...readyActivationReviewArgs(ref),
    '--adapter-id',
    'dangerous-live-adapter',
    '--adapter-kind',
    'exchange',
    '--adapter-environment',
    'live',
    '--adapter-endpoint',
    'https://api.binance.com',
    '--adapter-allow-host',
    'api.binance.com',
    '--adapter-credential-ref',
    ref,
    '--adapter-idempotency-header',
    'Idempotency-Key',
    '--adapter-rate-limit',
    '10',
    '--adapter-timeout-ms',
    '5000',
    '--adapter-circuit-breaker',
    '--adapter-supports-live',
  ]);
  if (liveEndpoint.status !== 'sandbox-policy-blocked') {
    failures.push(`live endpoint should policy-block, got ${liveEndpoint.status}`);
  }

  const rawSecret = runCertificationExpectFailure([
    ...readyActivationReviewArgs(ref),
    '--adapter-id',
    'secret-bearing-adapter',
    '--adapter-kind',
    'exchange',
    '--adapter-environment',
    'paper',
    '--adapter-endpoint',
    'https://paper.exchange.zavorth.local?api_key=sk-super-secret-value-123456',
    '--adapter-allow-host',
    'paper.exchange.zavorth.local',
    '--adapter-credential-ref',
    ref,
    '--adapter-idempotency-header',
    'Idempotency-Key',
    '--adapter-rate-limit',
    '10',
    '--adapter-timeout-ms',
    '5000',
    '--adapter-circuit-breaker',
    '--adapter-raw-secrets-accepted',
  ]);
  if (JSON.stringify(rawSecret).includes('sk-super-secret-value-123456')) {
    failures.push('sandbox adapter certification output leaked raw secret');
  }
  if (rawSecret.status !== 'sandbox-policy-blocked') {
    failures.push(`raw secret adapter should policy-block, got ${rawSecret.status}`);
  }

  if (failures.length > 0) {
    console.error('[transaction-sandbox-adapter-certification-intent-model2-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-sandbox-adapter-certification-intent-model2-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- Intent model2 consumes Intent model1 review-ready packets');
  console.log(
    '- sandbox adapter manifests require allowlist, SecretRef, idempotency, timeout, rate limit and circuit breaker',
  );
  console.log('- certification-ready still performs no sandbox or live external I/O');
  console.log('- live endpoints and raw secrets remain blocked');
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

function readyActivationReviewArgs(ref) {
  return [
    ...baseArgs(ref),
    '--activation-review-confirm',
    '--activation-review-phrase-default',
    '--safe-default-controls',
    ...killSwitchArgs(),
    ...rollbackArgs(),
  ];
}

function killSwitchArgs() {
  return [
    '--kill-switch-id',
    'intent-model2-kill-switch',
    '--kill-switch-enabled',
    '--kill-switch-tested',
    '--kill-switch-command',
    'zavorth transaction disable-live --scope intent-model2',
  ];
}

function rollbackArgs() {
  return [
    '--rollback-drill-id',
    'intent-model2-rollback-drill',
    '--rollback-drill-performed',
    '--rollback-drill-successful',
    '--rollback-summary',
    'Replay and rollback completed against the simulated transaction ledger.',
    '--replay-command',
    'npm run zavorth:transaction-live-candidate:json -- --replay intent-model0',
    '--rollback-command',
    'npm run zavorth:transaction-live-activation-review -- --rollback intent-model1',
    '--rollback-artifact',
    'data/runtime/intent-model2-rollback-receipt.json',
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
      ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-sandbox-adapter-certification.ts', ...args],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
    ),
  );
}

function runCertificationExpectFailure(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-sandbox-adapter-certification.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  if (result.status === 0) {
    failures.push(`expected sandbox adapter certification command failure for args: ${args.join(' ')}`);
  }
  return JSON.parse(result.stdout);
}
