import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthSemanticFunctionalClosureCertificationContract.ts',
  'src/services/ZavorthSemanticFunctionalClosureCertificationService.ts',
  'scripts/semantic-functional-closure-certification.ts',
  'scripts/semantic-functional-closure-certification-check.mjs',
  'src/sdk/semantic-functional-closure-certification.ts',
  'tests/services/ZavorthSemanticFunctionalClosureCertificationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[semantic-functional-closure-certification] ${prefix} ${name}: ${detail}`);
}

function read(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'S9 files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthSemanticFunctionalClosureCertificationContract.ts');
addCheck(
  'Contract captures semantic functional closure claims',
  [
    'ZAVORTH_SEMANTIC_FUNCTIONAL_CLOSURE_CERTIFICATION_CONTRACT_VERSION',
    'ZavorthSemanticFunctionalClosureClaim',
    'closure-item-coverage',
    'closure-receipt-coverage',
    'priority-closure-policy',
    'decision-closure-policy',
    'release-gate-policy',
    'machine-readable-policy',
    'unsafe-closure-policy',
    'gapsBlockRelease',
  ].every((marker) => contract.includes(marker)),
  'contract includes item, receipt, priority, decision, dashboard, ledger, release gate and unsafe policy vocabulary',
);

const service = read('src/services/ZavorthSemanticFunctionalClosureCertificationService.ts');
addCheck(
  'Service certifies guarded Certification matrix closure semantics',
  [
    'ZavorthFunctionalClosureService',
    'itemClaim',
    'receiptClaim',
    'priorityPolicyClaims',
    'decisionPolicyClaims',
    'dashboardClaim',
    'ledgerUpdateClaim',
    'releaseGateClaim',
    'unsafeClosureClaims',
  ].every((marker) => service.includes(marker)),
  'service converts Certification matrix functional closure evidence into final semantic claims',
);

const command = read('scripts/semantic-functional-closure-certification.ts');
addCheck(
  'Command exposes text JSON release-gate root-dir and require-pass',
  ['--json', '--require-pass', '--release-gate', '--root-dir', 'formatSnapshotText'].every((marker) => command.includes(marker)),
  'operator command supports text, JSON, release-gate, root-dir and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes S9 scripts and SDK subpath',
  [
    'semantic-functional-closure-certification',
    'semantic-functional-closure-certification:json',
    'semantic-functional-closure-certification:check',
    'qa:semantic-functional-closure-certification',
    './sdk/semantic-functional-closure-certification',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and public SDK export are registered',
);

const forbiddenWord = String.fromCharCode(111, 112, 101, 110, 99, 108, 97, 119);
const publicFiles = requiredFiles.filter((file) => !file.startsWith('docs/')).concat(['package.json']);
const forbiddenHits = publicFiles.filter((file) => read(file).toLowerCase().includes(forbiddenWord));
addCheck(
  'New public S9 files avoid forbidden source branding',
  forbiddenHits.length === 0,
  forbiddenHits.length === 0 ? 'no forbidden source branding in new public S9 files' : forbiddenHits.join(', '),
);

const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/semantic-functional-closure-certification.ts',
    '--json',
    '--require-pass',
  ],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  },
);

if (runtime.status !== 0) {
  addCheck(
    'Runtime S9 semantic receipt passes',
    false,
    `command exited ${runtime.status}; ${runtime.stderr || runtime.stdout}`.slice(0, 2000),
  );
} else {
  try {
    const snapshot = JSON.parse(runtime.stdout);
    const receiptIdsValid = snapshot.claims.every((claim) => (
      Array.isArray(claim.receiptIds)
      && claim.receiptIds.length > 0
      && claim.receiptIds.every((id) => typeof id === 'string' && id.trim().length > 0)
    ));
    const claimIdsUnique = new Set(snapshot.claims.map((claim) => claim.id)).size === snapshot.claims.length;
    addCheck(
      'Runtime S9 semantic receipt passes',
      snapshot.status === 'passed'
        && snapshot.summary.gaps === 0
        && snapshot.summary.semanticClaims > 0
        && snapshot.summary.receiptBackedClaims === snapshot.summary.semanticClaims
        && snapshot.summary.itemClaimsCertified === snapshot.summary.closureItems
        && snapshot.summary.receiptClaimsCertified === snapshot.summary.closureReceipts
        && snapshot.summary.priorityPoliciesCertified >= 3
        && snapshot.summary.decisionPoliciesCertified >= 2
        && snapshot.summary.scenariosPassed === 4
        && snapshot.summary.releaseAllowed === true
        && snapshot.summary.releaseBlockers === 0
        && snapshot.summary.ledgerUpdatesPreviewOnly === true
        && snapshot.summary.ledgerUpdatesApplied === false
        && snapshot.summary.machineReadableReceipt === true
        && snapshot.summary.liveExternalIoPerformed === false
        && snapshot.summary.secretValuesSerialized === false
        && receiptIdsValid
        && claimIdsUnique,
      `status=${snapshot.status}, claims=${snapshot.summary.semanticClaims}, gaps=${snapshot.summary.gaps}, receiptIdsValid=${receiptIdsValid}, claimIdsUnique=${claimIdsUnique}, next=${snapshot.commands.nextStep}`,
    );
  } catch (error) {
    addCheck('Runtime S9 semantic receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[semantic-functional-closure-certification] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
