import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthSemanticSkillEcosystemCertificationContract.ts',
  'src/services/ZavorthSemanticSkillEcosystemCertificationService.ts',
  'scripts/semantic-skill-ecosystem-certification.ts',
  'scripts/semantic-skill-ecosystem-certification-check.mjs',
  'src/sdk/semantic-skill-ecosystem-certification.ts',
  'tests/services/ZavorthSemanticSkillEcosystemCertificationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[semantic-skill-ecosystem-certification] ${prefix} ${name}: ${detail}`);
}

function read(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'S8 files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthSemanticSkillEcosystemCertificationContract.ts');
addCheck(
  'Contract captures semantic skill ecosystem claims',
  [
    'ZAVORTH_SEMANTIC_SKILL_ECOSYSTEM_CERTIFICATION_CONTRACT_VERSION',
    'ZavorthSemanticSkillEcosystemClaim',
    'manifest-coverage',
    'permission-profile-policy',
    'permission-evaluation-policy',
    'secretref-policy',
    'smoke-policy',
    'lifecycle-receipt-policy',
    'bridge-policy',
    'unsafe-skill-policy',
    'gapsBlockRelease',
  ].every((marker) => contract.includes(marker)),
  'contract includes manifest, profile, evaluation, SecretRef, smoke, receipt, bridge and unsafe policy vocabulary',
);

const service = read('src/services/ZavorthSemanticSkillEcosystemCertificationService.ts');
addCheck(
  'Service certifies guarded Phase 8 skill semantics',
  [
    'ZavorthSkillEcosystemPackService',
    'manifestClaim',
    'capabilityTagClaim',
    'profileClaim',
    'evaluationClaim',
    'secretRefClaim',
    'smokeClaim',
    'lifecycleReceiptClaim',
    'unsafeSkillClaims',
  ].every((marker) => service.includes(marker)),
  'service converts Phase 8 skill ecosystem evidence into behavior-level semantic claims',
);

const command = read('scripts/semantic-skill-ecosystem-certification.ts');
addCheck(
  'Command exposes text JSON root-dir and require-pass',
  ['--json', '--require-pass', '--root-dir', 'formatSnapshotText'].every((marker) => command.includes(marker)),
  'operator command supports text, JSON, root-dir and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes S8 scripts and SDK subpath',
  [
    'semantic-skill-ecosystem-certification',
    'semantic-skill-ecosystem-certification:json',
    'semantic-skill-ecosystem-certification:check',
    'qa:semantic-skill-ecosystem-certification',
    './sdk/semantic-skill-ecosystem-certification',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and public SDK export are registered',
);

const forbiddenWord = String.fromCharCode(111, 112, 101, 110, 99, 108, 97, 119);
const publicFiles = requiredFiles.filter((file) => !file.startsWith('docs/')).concat(['package.json']);
const forbiddenHits = publicFiles.filter((file) => read(file).toLowerCase().includes(forbiddenWord));
addCheck(
  'New public S8 files avoid forbidden source branding',
  forbiddenHits.length === 0,
  forbiddenHits.length === 0 ? 'no forbidden source branding in new public S8 files' : forbiddenHits.join(', '),
);

const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/semantic-skill-ecosystem-certification.ts',
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
    'Runtime S8 semantic receipt passes',
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
      'Runtime S8 semantic receipt passes',
      snapshot.status === 'passed'
        && snapshot.summary.gaps === 0
        && snapshot.summary.semanticClaims > 0
        && snapshot.summary.receiptBackedClaims === snapshot.summary.semanticClaims
        && snapshot.summary.manifestClaimsCertified === snapshot.summary.packManifests
        && snapshot.summary.permissionProfileClaimsCertified === snapshot.summary.packPermissionProfiles
        && snapshot.summary.smokeClaimsCertified >= snapshot.summary.packSmokeTests
        && snapshot.summary.lifecycleReceiptClaimsCertified === snapshot.summary.packReceipts
        && snapshot.summary.bridgeClaimsCertified >= 2
        && snapshot.summary.scenariosPassed === 4
        && snapshot.summary.enabledByDefault === false
        && snapshot.summary.liveSkillsRequireOwnerApproval === true
        && snapshot.summary.liveSkillsRequireSecretRef === true
        && snapshot.summary.nonDestructiveSmokeOnly === true
        && snapshot.summary.liveExternalIoPerformed === false
        && snapshot.summary.liveSecretsUsed === false
        && snapshot.summary.secretValuesSerialized === false
        && receiptIdsValid
        && claimIdsUnique,
      `status=${snapshot.status}, claims=${snapshot.summary.semanticClaims}, gaps=${snapshot.summary.gaps}, receiptIdsValid=${receiptIdsValid}, claimIdsUnique=${claimIdsUnique}, next=${snapshot.commands.nextPhase}`,
    );
  } catch (error) {
    addCheck('Runtime S8 semantic receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[semantic-skill-ecosystem-certification] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
