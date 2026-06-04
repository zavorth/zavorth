import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'zavorth-transaction-certification-'));
const ledgerFile = join(tempDir, 'approval-ledger.jsonl');
const credentialStoreFile = join(tempDir, 'credential-refs.jsonl');
const env = {
  ...process.env,
  ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY: 'certification-matrix-check-signing-key-000000000000000000000000000000',
};

const requiredFiles = [
  'src/contracts/ZavorthTransactionCertificationContract.ts',
  'src/services/ZavorthTransactionCertificationService.ts',
  'scripts/zavorth-transaction-certification.ts',
  'docs/README.md',
  'tests/contracts/ZavorthTransactionCertificationContract.test.ts',
  'tests/services/ZavorthTransactionCertificationService.test.ts',
];

const requiredPackageScripts = [
  'zavorth:transaction-certification',
  'zavorth:transaction-certification:json',
  'zavorth:transaction-certification:check',
  'qa:zavorth-transaction-certification',
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

  const contractText = readFileSync(join(root, 'src/contracts/ZavorthTransactionCertificationContract.ts'), 'utf8');
  const serviceText = readFileSync(join(root, 'src/services/ZavorthTransactionCertificationService.ts'), 'utf8');
  const docsText = readFileSync(join(root, 'docs/README.md'), 'utf8');
  for (const marker of [
    'zavorth-transaction-certification/checkpoint-9',
    'web-trade-approval',
    'secret-redaction',
    'no-live-execution',
    'Owner-Gated Live Candidate Envelope',
  ]) {
    if (!contractText.includes(marker) && !serviceText.includes(marker) && !docsText.includes(marker)) {
      failures.push(`missing marker: ${marker}`);
    }
  }

  const report = runCertification([
    '--json',
    '--ledger-file',
    ledgerFile,
    '--credential-store-file',
    credentialStoreFile,
  ]);

  if (report.status !== 'passed') {
    failures.push(`certification status mismatch: ${report.status}`);
  }
  if (report.scenarioCount !== 5 || report.failedScenarioCount !== 0) {
    failures.push(`scenario count mismatch: ${report.passedScenarioCount}/${report.scenarioCount}`);
  }
  const requiredGates = [
    'natural-first-routing',
    'approval-gate',
    'credential-ref-gate',
    'typed-connector-simulation',
    'zavorthControl-projection',
    'cross-surface-consistency',
    'secret-redaction',
    'no-live-execution',
  ];
  for (const gate of requiredGates) {
    if (!report.gates.some((item) => item.kind === gate && item.passed === true)) {
      failures.push(`missing passed gate: ${gate}`);
    }
  }
  if (JSON.stringify(report).includes('sk-super-secret-value-123456')) {
    failures.push('certification report leaked raw secret');
  }
  if (report.safety.noLiveExecution !== true || report.safety.liveActionApplied !== false || report.safety.externalSideEffects !== false) {
    failures.push('certification report must remain live-disabled');
  }

  if (failures.length > 0) {
    console.error('[transaction-certification-certification-matrix-check] failed');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[transaction-certification-certification-matrix-check] ok');
  console.log('- contract, service, CLI, docs and tests are present');
  console.log('- Phases 0-8 certify as one governed transaction plane');
  console.log('- approval, credential, connector, surface and cockpit gates pass');
  console.log('- raw secrets remain redacted and live execution remains disabled');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function runCertification(args) {
  return JSON.parse(execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-transaction-certification.ts', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env },
  ));
}
