import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-command-center-'));
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const credentialStoreFile = join(tempDir, 'credential-refs.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'phase8-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionCommandCenterContract.ts',
  'src/services/ZavorthTransactionCommandCenterProjectionService.ts',
  'scripts/zavorth-transaction-command-center.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionCommandCenterContract.test.ts',
  'tests/services/ZavorthTransactionCommandCenterProjectionService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-command-center',
  'zavorth:transaction-command-center:json',
  'zavorth:transaction-command-center:phase8:check',
  'qa:zavorth-transaction-command-center',
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

  const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionCommandCenterContract.ts'), 'utf8');
  const serviceText = readFileSync(join(root, 'src/services/ZavorthTransactionCommandCenterProjectionService.ts'), 'utf8');
  const docsText = readFileSync(join(root, 'docs/README.md'), 'utf8');
  for (const marker of [
    'zavorth-transaction-command-center/phase-8',
    'noLiveExecution',
    'operatorActions',
    'reject-preview',
    'Command Center projection',
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

  const approvalProjection = runCommandCenter([
    '--json',
    '--surface',
    'web',
    '--ledger-file',
    ledgerFile,
    '--credential-store-file',
    credentialStoreFile,
    '--text',
    'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
    '--mode',
    'paper',
  ]);
  if (approvalProjection.status !== 'approval-required' || approvalProjection.tone !== 'attention') {
    failures.push(`approval projection mismatch: ${approvalProjection.status}/${approvalProjection.tone}`);
  }
  if (!approvalProjection.lanes.some((lane) => lane.kind === 'approval' && lane.status === 'pending')) {
    failures.push('approval projection lacks pending approval lane');
  }
  if (!approvalProjection.operatorActions.some((action) => action.sourceActionId === 'request-approval' && action.enabled === true)) {
    failures.push('approval projection lacks enabled request-approval action');
  }
  if (!approvalProjection.operatorActions.some((action) => action.sourceActionId === 'reject-preview' && action.placement === 'danger')) {
    failures.push('approval projection lacks reject-preview danger action');
  }

  const simulated = runCommandCenter([
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
  ]);
  if (simulated.status !== 'simulated' || simulated.tone !== 'success') {
    failures.push(`simulated projection mismatch: ${simulated.status}/${simulated.tone}`);
  }
  if (!simulated.lanes.some((lane) => lane.kind === 'connector' && lane.status === 'simulated')) {
    failures.push('simulated projection lacks simulated connector lane');
  }
  if (simulated.safety.noLiveExecution !== true || simulated.safety.liveActionApplied !== false || simulated.safety.externalSideEffects !== false) {
    failures.push('Command Center safety must remain live-disabled');
  }

  const monitor = runCommandCenter([
    '--json',
    '--surface',
    'telegram',
    '--ledger-file',
    ledgerFile,
    '--credential-store-file',
    credentialStoreFile,
    '--text',
    'Monitore notebook abaixo de R$3500 e me avise.',
    '--mode',
    'sandbox',
  ]);
  if (monitor.status !== 'simulated' || !monitor.notifications.some((entry) => String(entry.body).includes('Simulado'))) {
    failures.push('telegram monitor projection should be simulated with localized notification');
  }
  if (!monitor.timeline.some((item) => item.id === 'approval' && item.status === 'skipped')) {
    failures.push('monitor projection should skip approval timeline');
  }

  const rawSecret = runCommandCenterExpectFailure([
    '--json',
    '--surface',
    'web',
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
    failures.push('Command Center projection leaked raw secret');
  }
  if (rawSecret.status !== 'blocked' || rawSecret.safety.noRawSecretSerialized !== true) {
    failures.push(`raw secret projection should be blocked and redacted, got ${rawSecret.status}`);
  }

  if (failures.length > 0) {
    console.error('[transaction-command-center-phase8-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-command-center-phase8-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- Command Center lanes, tiles, timeline and operator actions project Phase 7 truth');
  console.log('- approval, credential, connector and safety states are visible without live execution');
  console.log('- raw secrets remain redacted and blocked');
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

function runCommandCenter(args) {
  return JSON.parse(execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-command-center.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  ));
}

function runCommandCenterExpectFailure(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-command-center.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  if (result.status === 0) {
    failures.push(`expected Command Center command failure for args: ${args.join(' ')}`);
  }
  return JSON.parse(result.stdout);
}
