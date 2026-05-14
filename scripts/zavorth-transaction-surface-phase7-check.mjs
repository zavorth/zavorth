import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-surface-'));
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const credentialStoreFile = join(tempDir, 'credential-refs.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'phase7-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionSurfaceContract.ts',
  'src/services/ZavorthTransactionSurfaceGatewayService.ts',
  'scripts/zavorth-transaction-surface.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionSurfaceContract.test.ts',
  'tests/services/ZavorthTransactionSurfaceGatewayService.test.ts',
  'tests/runtime/agent/NaturalFirstRunClassifier.transaction.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-surface',
  'zavorth:transaction-surface:json',
  'zavorth:transaction-surface:phase7:check',
  'qa:zavorth-transaction-surface',
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

  const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionSurfaceContract.ts'), 'utf8');
  const serviceText = readFileSync(join(root, 'src/services/ZavorthTransactionSurfaceGatewayService.ts'), 'utf8');
  const classifierText = readFileSync(join(root, 'src/runtime/agent/NaturalFirstRunClassifier.ts'), 'utf8');
  for (const marker of ['zavorth-transaction-surface/phase-7', 'request-approval', 'provide-credential-ref', 'TRANSACTION_APPROVAL_PATTERNS']) {
    if (!contractText.includes(marker) && !serviceText.includes(marker) && !classifierText.includes(marker)) {
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

  const approvalRequired = runSurfaceExpectFailure([
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
  if (approvalRequired.status !== 'approval-required' || approvalRequired.naturalFirst.route !== 'approval-proposal') {
    failures.push(`approval surface mismatch: ${approvalRequired.status}/${approvalRequired.naturalFirst.route}`);
  }
  if (!approvalRequired.actions.some((action) => action.kind === 'request-approval' && action.enabled === true)) {
    failures.push('approval-required projection lacks enabled request-approval action');
  }

  const simulated = runSurface([
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
  if (simulated.status !== 'simulated' || simulated.runtime.connectorRun?.status !== 'simulated') {
    failures.push(`simulated projection mismatch: ${simulated.status}`);
  }
  if (simulated.externalSideEffects !== false || simulated.liveActionApplied !== false || simulated.executableNow !== false) {
    failures.push('surface projection must remain live-disabled');
  }
  if (!simulated.cards.some((card) => card.kind === 'safety' && card.lines.includes('liveActionApplied=false'))) {
    failures.push('surface projection lacks safety card');
  }

  const monitor = runSurface([
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
  if (monitor.status !== 'simulated' || monitor.naturalFirst.route !== 'tool-preview') {
    failures.push(`monitor projection mismatch: ${monitor.status}/${monitor.naturalFirst.route}`);
  }
  if (!String(monitor.replyText).includes('Simulado')) {
    failures.push('telegram monitor reply should be concise and localized');
  }

  const rawSecret = runSurfaceExpectFailure([
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
    failures.push('surface output leaked raw secret');
  }
  if (rawSecret.status !== 'blocked') {
    failures.push(`raw secret surface should be blocked, got ${rawSecret.status}`);
  }

  if (failures.length > 0) {
    console.error('[transaction-surface-phase7-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-surface-phase7-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- Natural First routes transaction text into governed preview/approval paths');
  console.log('- Web/API/Telegram projections expose cards and actions without live execution');
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

function runSurface(args) {
  return JSON.parse(execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-surface.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  ));
}

function runSurfaceExpectFailure(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-surface.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  );
  if (result.status === 0) {
    failures.push(`expected surface command failure for args: ${args.join(' ')}`);
  }
  return JSON.parse(result.stdout);
}
