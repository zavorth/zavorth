import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthSemanticChannelMeshCertificationContract.ts',
  'src/services/ZavorthSemanticChannelMeshCertificationService.ts',
  'scripts/semantic-channel-mesh-certification.ts',
  'scripts/semantic-channel-mesh-certification-check.mjs',
  'src/sdk/semantic-channel-mesh-certification.ts',
  'tests/services/ZavorthSemanticChannelMeshCertificationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[semantic-channel-mesh-certification] ${prefix} ${name}: ${detail}`);
}

function read(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'S4 files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthSemanticChannelMeshCertificationContract.ts');
addCheck(
  'Contract captures semantic Channel Mesh claims',
  [
    'ZAVORTH_SEMANTIC_CHANNEL_MESH_CERTIFICATION_CONTRACT_VERSION',
    'ZavorthSemanticChannelMeshClaim',
    'package-coverage',
    'pack-runtime',
    'secret-policy',
    'allowlist-policy',
    'simulator-action',
    'webhook-policy',
    'patch-risk-policy',
    'unsafe-channel-policy',
    'gapsBlockRelease',
  ].every((marker) => contract.includes(marker)),
  'contract includes package, pack, secret, allowlist, simulator, webhook, patch risk and release-blocking vocabulary',
);

const service = read('src/services/ZavorthSemanticChannelMeshCertificationService.ts');
addCheck(
  'Service certifies Channel Mesh runtime and safety semantics',
  [
    'SourceChannelMeshExpansionService',
    'SourceChannelSecretPolicyService',
    'packageClaim',
    'packClaim',
    'secretPolicyClaim',
    'allowlistClaim',
    'simulatorClaims',
    'webhookClaim',
    'patchRiskClaims',
    'unsafeChannelClaims',
  ].every((marker) => service.includes(marker)),
  'service converts Channel Mesh evidence into behavior-level semantic claims',
);

const command = read('scripts/semantic-channel-mesh-certification.ts');
addCheck(
  'Command exposes text JSON source-root and require-pass',
  ['--json', '--require-pass', '--source-root', '--zavorth-root'].every((marker) => command.includes(marker)),
  'operator command supports text, JSON, source-root, zavorth-root and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes S4 scripts and SDK subpath',
  [
    'semantic-channel-mesh-certification',
    'semantic-channel-mesh-certification:json',
    'semantic-channel-mesh-certification:check',
    'qa:semantic-channel-mesh-certification',
    './sdk/semantic-channel-mesh-certification',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and public SDK export are registered',
);

const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/semantic-channel-mesh-certification.ts',
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
    'Runtime S4 semantic receipt passes',
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
    const packStatuses = snapshot.summary?.packStatuses || {};
    addCheck(
      'Runtime S4 semantic receipt passes',
      snapshot.status === 'passed'
        && snapshot.summary.gaps === 0
        && snapshot.summary.semanticClaims > 0
        && snapshot.summary.receiptBackedClaims === snapshot.summary.semanticClaims
        && snapshot.summary.liveIoPerformed === false
        && snapshot.summary.enabledByDefault === false
        && snapshot.summary.secretValuesSerialized === false
        && packStatuses.slack !== 'missing'
        && packStatuses['whatsapp-baileys'] === 'owner_decision_required'
        && receiptIdsValid
        && claimIdsUnique,
      `status=${snapshot.status}, claims=${snapshot.summary.semanticClaims}, gaps=${snapshot.summary.gaps}, receiptIdsValid=${receiptIdsValid}, claimIdsUnique=${claimIdsUnique}, next=${snapshot.commands.nextAction}`,
    );
  } catch (error) {
    addCheck('Runtime S4 semantic receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[semantic-channel-mesh-certification] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
