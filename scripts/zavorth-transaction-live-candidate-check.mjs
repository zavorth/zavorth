import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-live-candidate-'));
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const credentialStoreFile = join(tempDir, 'credential-refs.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'intent-model0-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionLiveCandidateContract.ts',
  'src/services/ZavorthTransactionLiveCandidateEnvelopeService.ts',
  'scripts/zavorth-transaction-live-candidate.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionLiveCandidateContract.test.ts',
  'tests/services/ZavorthTransactionLiveCandidateEnvelopeService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-live-candidate',
  'zavorth:transaction-live-candidate:json',
  'zavorth:transaction-live-candidate:check',
  'qa:zavorth-transaction-live-candidate',
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

  const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionLiveCandidateContract.ts'), 'utf8');
  const serviceText = readFileSync(
    join(root, 'src/services/ZavorthTransactionLiveCandidateEnvelopeService.ts'),
    'utf8',
  );
  const docsText = readFileSync(join(root, 'docs/README.md'), 'utf8');
  for (const marker of [
    'zavorth-transaction-live-candidate/checkpoint-10',
    'ZAVORTH LIVE CANDIDATE ONLY',
    'candidateDoesNotAuthorizeLiveExecution',
    'owner-confirmation',
    'live-switch-disabled',
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
    'Intent model0 exchange paper ref',
    '--connector-kind',
    'exchange',
    '--environment',
    'paper',
    '--actions',
    'trade-order',
    '--owner-approved',
  ]);
  const ref = credential.record?.ref;

  const needsOwner = runLiveCandidateExpectFailure([
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
  ]);
  if (needsOwner.status !== 'owner-confirmation-required') {
    failures.push(`owner gate status mismatch: ${needsOwner.status}`);
  }
  if (!needsOwner.gates.some((gate) => gate.kind === 'owner-confirmation' && gate.passed === false)) {
    failures.push('owner confirmation gate should be false before phrase');
  }

  const ready = runLiveCandidate([
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
  ]);
  if (ready.status !== 'candidate-ready' || ready.envelope?.candidateOnly !== true) {
    failures.push(`candidate-ready mismatch: ${ready.status}`);
  }
  if (
    ready.safety.liveExecutionAuthorized !== false ||
    ready.safety.executableNow !== false ||
    ready.safety.liveActionApplied !== false
  ) {
    failures.push('candidate-ready must still keep live execution disabled');
  }
  if (!ready.gates.every((gate) => gate.passed === true)) {
    failures.push('candidate-ready should pass every Intent model0 gate');
  }

  const missingCredential = runLiveCandidateExpectFailure([
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
    '--require-credential',
    '--owner-confirm',
    '--owner-phrase-default',
  ]);
  if (missingCredential.status !== 'runtime-blocked') {
    failures.push(`missing credential should runtime-block, got ${missingCredential.status}`);
  }

  const rawSecret = runLiveCandidateExpectFailure([
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
    '--owner-confirm',
    '--owner-phrase-default',
  ]);
  if (JSON.stringify(rawSecret).includes('sk-super-secret-value-123456')) {
    failures.push('live candidate output leaked raw secret');
  }
  if (rawSecret.status !== 'runtime-blocked') {
    failures.push(`raw secret should runtime-block, got ${rawSecret.status}`);
  }

  if (failures.length > 0) {
    console.error('[transaction-live-candidate-intent-model0-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-live-candidate-intent-model0-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- owner confirmation gates candidate envelopes with the required phrase');
  console.log('- candidate-ready includes an audit envelope but still no live execution');
  console.log('- raw secrets remain redacted and blocked');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
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

function runLiveCandidate(args) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-live-candidate.ts', ...args],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
    ),
  );
}

function runLiveCandidateExpectFailure(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-live-candidate.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  if (result.status === 0) {
    failures.push(`expected live candidate command failure for args: ${args.join(' ')}`);
  }
  return JSON.parse(result.stdout);
}
