import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-runtime-'));
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const credentialStoreFile = join(tempDir, 'credential-refs.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'runtime-gateway-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionRuntimeContract.ts',
  'src/services/ZavorthTransactionRuntimeOrchestratorService.ts',
  'scripts/zavorth-transaction-runtime.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionRuntimeContract.test.ts',
  'tests/services/ZavorthTransactionRuntimeOrchestratorService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-runtime',
  'zavorth:transaction-runtime:json',
  'zavorth:transaction-runtime:check',
  'qa:zavorth-transaction-runtime',
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

  const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionRuntimeContract.ts'), 'utf8');
  const serviceText = readFileSync(join(root, 'src/services/ZavorthTransactionRuntimeOrchestratorService.ts'), 'utf8');
  for (const marker of ['zavorth-transaction-runtime/checkpoint-6', 'externalSideEffects: false', 'credential-validation', 'typed-connector']) {
    if (!contractText.includes(marker) && !serviceText.includes(marker)) {
      failures.push(`missing marker: ${marker}`);
    }
  }

  const credential = runCredential([
    '--json',
    '--store-file',
    credentialStoreFile,
    '--register',
    '--label',
    'Demo exchange paper ref',
    '--connector-kind',
    'exchange',
    '--environment',
    'paper',
    '--actions',
    'trade-order',
    '--owner-approved',
  ]);
  const ref = credential.record?.ref;

  const needsApproval = runRuntimeExpectFailure([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--credential-store-file',
    credentialStoreFile,
    '--text',
    'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
    '--mode',
    'paper',
  ]);
  if (needsApproval.status !== 'approval-required' || !needsApproval.blockers.includes('approval_required')) {
    failures.push(`approval-required mismatch: ${needsApproval.status}`);
  }

  const simulated = runRuntime([
    '--json',
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
  ]);
  if (simulated.status !== 'simulated') {
    failures.push(`simulated runtime mismatch: ${simulated.status}`);
  }
  if (simulated.credentialValidation?.status !== 'ready' || simulated.connectorRun?.status !== 'simulated') {
    failures.push('credential or connector stage did not complete');
  }
  if (simulated.externalSideEffects !== false || simulated.liveActionApplied !== false || simulated.executableNow !== false) {
    failures.push('runtime simulation must remain side-effect-free');
  }

  const missingCredential = runRuntimeExpectFailure([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--credential-store-file',
    credentialStoreFile,
    '--text',
    'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
    '--approve',
    '--mode',
    'paper',
    '--require-credential',
  ]);
  if (missingCredential.status !== 'credential-required' || !missingCredential.blockers.includes('credential_ref_required')) {
    failures.push(`credential-required mismatch: ${missingCredential.status}`);
  }

  const monitor = runRuntime([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--credential-store-file',
    credentialStoreFile,
    '--text',
    'Monitore notebook abaixo de R$3500 e me avise.',
    '--mode',
    'sandbox',
  ]);
  if (monitor.status !== 'simulated' || monitor.connectorRun?.connector?.kind !== 'market-data') {
    failures.push(`monitor runtime mismatch: ${monitor.status}/${monitor.connectorRun?.connector?.kind}`);
  }

  const rawSecret = runRuntimeExpectFailure([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--credential-store-file',
    credentialStoreFile,
    '--text',
    'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
    '--approve',
    '--mode',
    'paper',
  ]);
  if (JSON.stringify(rawSecret).includes('sk-super-secret-value-123456')) {
    failures.push('runtime output leaked raw secret');
  }
  if (rawSecret.status !== 'blocked') {
    failures.push(`raw secret runtime should be blocked, got ${rawSecret.status}`);
  }

  if (failures.length > 0) {
    console.error('[transaction-runtime-runtime-gateway-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-runtime-runtime-gateway-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- natural transaction text runs through preview, approval, credential validation and typed connector simulation');
  console.log('- approval and credential gates block incomplete runs');
  console.log('- runtime stays side-effect-free and live-disabled');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function runCredential(args) {
  return JSON.parse(execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-credential.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  ));
}

function runRuntime(args) {
  return JSON.parse(execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-runtime.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  ));
}

function runRuntimeExpectFailure(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-runtime.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  if (result.status === 0) {
    failures.push(`expected runtime command failure for args: ${args.join(' ')}`);
  }
  return JSON.parse(result.stdout);
}
