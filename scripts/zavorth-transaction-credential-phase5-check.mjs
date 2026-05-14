import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-credential-'));
const storeFile = join(tempDir, 'credential-refs.jsonl');
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'phase5-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionCredentialContract.ts',
  'src/services/ZavorthTransactionCredentialRefService.ts',
  'scripts/zavorth-transaction-credential.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionCredentialContract.test.ts',
  'tests/services/ZavorthTransactionCredentialRefService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-credential',
  'zavorth:transaction-credential:json',
  'zavorth:transaction-credential:phase5:check',
  'qa:zavorth-transaction-credential',
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

  const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionCredentialContract.ts'), 'utf8');
  const credentialText = readFileSync(join(root, 'src/services/ZavorthTransactionCredentialRefService.ts'), 'utf8');
  const connectorText = readFileSync(join(root, 'src/services/ZavorthTransactionConnectorRegistryService.ts'), 'utf8');
  for (const marker of ['zavorth-transaction-credential/phase-5', 'rawSecretStored: false', 'valueReadableByLlm: false', 'credential_ref_format_invalid']) {
    if (!contractText.includes(marker) && !credentialText.includes(marker) && !connectorText.includes(marker)) {
      failures.push(`missing marker: ${marker}`);
    }
  }

  const registered = runCredential([
    '--json',
    '--store-file',
    storeFile,
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
  const ref = registered.record?.ref;
  if (!ref || !ref.startsWith('vault://zavorth/transaction/exchange/')) {
    failures.push(`credential ref mismatch: ${ref}`);
  }
  if (registered.record?.rawSecretStored !== false || registered.record?.valueReadableByLlm !== false) {
    failures.push('credential record must not store or expose raw value');
  }

  const validation = runCredential([
    '--json',
    '--store-file',
    storeFile,
    '--validate',
    '--ref',
    ref,
    '--connector-kind',
    'exchange',
    '--action',
    'trade-order',
  ]);
  if (validation.status !== 'ready' || validation.canUseForConnectorRun !== true) {
    failures.push(`credential validation mismatch: ${validation.status}`);
  }

  const mismatch = runCredentialExpectFailure([
    '--json',
    '--store-file',
    storeFile,
    '--validate',
    '--ref',
    ref,
    '--connector-kind',
    'payment',
    '--action',
    'payment-submit',
  ]);
  if (mismatch.status !== 'mismatch' || !mismatch.blockers.includes('credential_connector_kind_mismatch')) {
    failures.push(`credential mismatch expected, got ${mismatch.status}`);
  }

  const rawSecret = runCredentialExpectFailure([
    '--json',
    '--store-file',
    storeFile,
    '--register',
    '--label',
    'bad raw',
    '--connector-kind',
    'exchange',
    '--secret-value',
    'api_key=sk-super-secret-value-123456',
  ]);
  if (rawSecret.status !== 'blocked' || JSON.stringify(rawSecret).includes('sk-super-secret-value-123456')) {
    failures.push('raw secret registration should be blocked and redacted');
  }

  const connector = runConnector([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--text',
    'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
    '--approve',
    '--mode',
    'paper',
    '--credential-ref',
    ref,
  ]);
  if (connector.result.status !== 'simulated' || connector.result.payload?.credentialRef !== ref) {
    failures.push('connector run did not accept registered credential ref');
  }
  if (connector.result.externalSideEffects !== false || connector.result.liveActionApplied !== false) {
    failures.push('connector run with credential ref must remain side-effect-free');
  }

  if (readFileSync(storeFile, 'utf8').includes('sk-super-secret-value-123456')) {
    failures.push('credential store leaked raw secret');
  }

  if (failures.length > 0) {
    console.error('[transaction-credential-phase5-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-credential-phase5-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- credential refs are registered as metadata-only SecretRefs');
  console.log('- raw secrets are blocked and never serialized');
  console.log('- typed connector dry-runs can carry valid credential refs without live effects');
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

function runCredentialExpectFailure(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-credential.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  if (result.status === 0) {
    failures.push(`expected credential command failure for args: ${args.join(' ')}`);
  }
  return JSON.parse(result.stdout);
}

function runConnector(args) {
  return JSON.parse(execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-connector.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  ));
}
