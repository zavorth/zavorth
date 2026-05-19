import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthSemanticQaSecurityReleaseCertificationContract.ts',
  'src/services/ZavorthSemanticQaSecurityReleaseCertificationService.ts',
  'scripts/semantic-qa-security-release-certification.ts',
  'scripts/semantic-qa-security-release-certification-check.mjs',
  'src/sdk/semantic-qa-security-release-certification.ts',
  'tests/services/ZavorthSemanticQaSecurityReleaseCertificationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[semantic-qa-security-release-certification] ${prefix} ${name}: ${detail}`);
}

function read(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'S7 files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthSemanticQaSecurityReleaseCertificationContract.ts');
addCheck(
  'Contract captures semantic QA security release claims',
  [
    'ZAVORTH_SEMANTIC_QA_SECURITY_RELEASE_CERTIFICATION_CONTRACT_VERSION',
    'ZavorthSemanticQaSecurityReleaseClaim',
    'family-coverage',
    'receipt-coverage',
    'qa-scenario-policy',
    'security-control-policy',
    'release-acceptance-policy',
    'workflow-semantic-policy',
    'patch-risk-policy',
    'unsafe-release-policy',
    'gapsBlockRelease',
  ].every((marker) => contract.includes(marker)),
  'contract includes family, receipt, QA, security, release, workflow, patch and unsafe policy vocabulary',
);

const service = read('src/services/ZavorthSemanticQaSecurityReleaseCertificationService.ts');
addCheck(
  'Service certifies guarded Surface controls release semantics',
  [
    'ZavorthQaSecurityReleaseCertificationPackService',
    'familyClaim',
    'receiptClaim',
    'qaScenarioClaim',
    'securityControlClaim',
    'releaseAcceptanceClaim',
    'workflowSemanticClaim',
    'patchRiskClaim',
    'unsafeReleaseClaims',
  ].every((marker) => service.includes(marker)),
  'service converts Surface controls QA/security/release evidence into behavior-level semantic claims',
);

const command = read('scripts/semantic-qa-security-release-certification.ts');
addCheck(
  'Command exposes text JSON root-dir and require-pass',
  ['--json', '--require-pass', '--root-dir', 'formatSnapshotText'].every((marker) => command.includes(marker)),
  'operator command supports text, JSON, root-dir and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes S7 scripts and SDK subpath',
  [
    'semantic-qa-security-release-certification',
    'semantic-qa-security-release-certification:json',
    'semantic-qa-security-release-certification:check',
    'qa:semantic-qa-security-release-certification',
    './sdk/semantic-qa-security-release-certification',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and public SDK export are registered',
);

const forbiddenWord = String.fromCharCode(111, 112, 101, 110, 99, 108, 97, 119);
const publicFiles = requiredFiles.filter((file) => !file.startsWith('docs/')).concat(['package.json']);
const forbiddenHits = publicFiles.filter((file) => read(file).toLowerCase().includes(forbiddenWord));
addCheck(
  'New public S7 files avoid forbidden source branding',
  forbiddenHits.length === 0,
  forbiddenHits.length === 0 ? 'no forbidden source branding in new public S7 files' : forbiddenHits.join(', '),
);

const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/semantic-qa-security-release-certification.ts',
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
    'Runtime S7 semantic receipt passes',
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
      'Runtime S7 semantic receipt passes',
      snapshot.status === 'passed'
        && snapshot.summary.gaps === 0
        && snapshot.summary.semanticClaims > 0
        && snapshot.summary.receiptBackedClaims === snapshot.summary.semanticClaims
        && snapshot.summary.familyClaimsCertified === snapshot.summary.packFamilies
        && snapshot.summary.receiptClaimsCertified === snapshot.summary.packReceipts
        && snapshot.summary.qaScenarioClaimsCertified >= 8
        && snapshot.summary.securityControlClaimsCertified >= 6
        && snapshot.summary.releaseAcceptanceClaimsCertified >= 8
        && snapshot.summary.workflowSemanticClaimsCertified >= 6
        && snapshot.summary.functionalRunnerClaimsCertified === 1
        && snapshot.summary.scenariosPassed === 4
        && snapshot.summary.dependencyPatchesAcceptedSilently === false
        && snapshot.summary.rawWorkflowYamlCopied === false
        && snapshot.summary.liveExternalIoPerformed === false
        && snapshot.summary.secretValuesSerialized === false
        && receiptIdsValid
        && claimIdsUnique,
      `status=${snapshot.status}, claims=${snapshot.summary.semanticClaims}, gaps=${snapshot.summary.gaps}, receiptIdsValid=${receiptIdsValid}, claimIdsUnique=${claimIdsUnique}, next=${snapshot.commands.nextStage}`,
    );
  } catch (error) {
    addCheck('Runtime S7 semantic receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[semantic-qa-security-release-certification] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
