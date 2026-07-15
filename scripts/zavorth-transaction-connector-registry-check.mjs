import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-connector-'));
const ledgerFile = join(tempDir, 'ledger.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'connector-registry-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionConnectorContract.ts',
  'src/services/ZavorthTransactionConnectorRegistryService.ts',
  'scripts/zavorth-transaction-connector.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionConnectorContract.test.ts',
  'tests/services/ZavorthTransactionConnectorRegistryService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-connector',
  'zavorth:transaction-connector:json',
  'zavorth:transaction-connector:check',
  'qa:zavorth-transaction-connector',
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

  const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionConnectorContract.ts'), 'utf8');
  const serviceText = readFileSync(join(root, 'src/services/ZavorthTransactionConnectorRegistryService.ts'), 'utf8');
  for (const marker of [
    'zavorth-transaction-connector/checkpoint-4',
    'externalSideEffects: false',
    'supportsLive: false',
    'approval_grant_required',
  ]) {
    if (!contractText.includes(marker) && !serviceText.includes(marker)) {
      failures.push(`missing marker: ${marker}`);
    }
  }

  const blockedTrade = runConnector([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--text',
    'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
    '--kind',
    'execute-trade',
    '--action-kind',
    'trade-order',
    '--mode',
    'paper',
  ]);
  if (blockedTrade.result.status !== 'blocked' || !blockedTrade.result.blockers.includes('approval_grant_required')) {
    failures.push(`unapproved trade should be blocked: ${JSON.stringify(blockedTrade.result.blockers)}`);
  }

  const approvedTrade = runConnector([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--text',
    'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
    '--kind',
    'execute-trade',
    '--action-kind',
    'trade-order',
    '--approve',
    '--mode',
    'paper',
  ]);
  if (approvedTrade.result.status !== 'simulated') {
    failures.push(`approved trade should simulate, got ${approvedTrade.result.status}`);
  }
  if (
    approvedTrade.result.connector.kind !== 'exchange' ||
    approvedTrade.result.payload.method !== 'SIMULATE_TRADE_ORDER'
  ) {
    failures.push('approved trade connector payload mismatch');
  }
  if (
    approvedTrade.result.externalSideEffects !== false ||
    approvedTrade.result.liveActionApplied !== false ||
    approvedTrade.result.executableNow !== false
  ) {
    failures.push('approved dry-run must remain side-effect-free');
  }

  const monitor = runConnector([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--text',
    'Monitor notebook below R$3500 and notify me.',
    '--kind',
    'monitor-price',
    '--action-kind',
    'price-monitor',
    '--mode',
    'sandbox',
  ]);
  if (monitor.result.status !== 'simulated' || monitor.result.connector.kind !== 'market-data') {
    failures.push(
      `monitor should simulate through market-data, got ${monitor.result.status}/${monitor.result.connector?.kind}`,
    );
  }

  const rawCredential = runConnector([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--text',
    'Monitor notebook below R$3500 and notify me.',
    '--kind',
    'monitor-price',
    '--action-kind',
    'price-monitor',
    '--credential-ref',
    'api_key=sk-super-secret-value-123456',
  ]);
  if (!rawCredential.result.blockers.includes('raw_credential_ref_blocked')) {
    failures.push('raw credential ref should be blocked');
  }
  if (JSON.stringify(rawCredential).includes('sk-super-secret-value-123456')) {
    failures.push('connector output leaked raw credential');
  }

  if (failures.length > 0) {
    console.error('[transaction-connector-connector-registry-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-connector-connector-registry-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- real-money connector dry-run requires Approval gate approval');
  console.log('- approved dry-runs simulate typed payloads without external side effects');
  console.log('- raw credential references are blocked and redacted');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function runConnector(args) {
  const output = execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-connector.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  return JSON.parse(output);
}
