import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthSemanticProviderMeshCertificationContract.ts',
  'src/services/ZavorthSemanticProviderMeshCertificationService.ts',
  'scripts/semantic-provider-mesh-certification.ts',
  'scripts/semantic-provider-mesh-certification-check.mjs',
  'src/sdk/semantic-provider-mesh-certification.ts',
  'tests/services/ZavorthSemanticProviderMeshCertificationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[semantic-provider-mesh-certification] ${prefix} ${name}: ${detail}`);
}

function read(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'S3 files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthSemanticProviderMeshCertificationContract.ts');
addCheck(
  'Contract captures semantic Provider Mesh claims',
  [
    'ZAVORTH_SEMANTIC_PROVIDER_MESH_CERTIFICATION_CONTRACT_VERSION',
    'ZavorthSemanticProviderMeshClaim',
    'package-coverage',
    'adapter-runtime',
    'credential-route',
    'factory-route',
    'local-model-policy',
    'network-policy',
    'provider-bypass-policy',
    'gapsBlockRelease',
  ].every((marker) => contract.includes(marker)),
  'contract includes package, adapter, credential, factory, local, network and release-blocking vocabulary',
);

const service = read('src/services/ZavorthSemanticProviderMeshCertificationService.ts');
addCheck(
  'Service certifies Provider Mesh runtime and route semantics',
  [
    'SourceProviderMeshExpansionService',
    'SourceProviderCredentialRouteService',
    'packageClaim',
    'adapterClaim',
    'credentialRouteClaim',
    'factoryRouteClaim',
    'localModelClaims',
    'networkClaims',
    'providerBypassClaims',
  ].every((marker) => service.includes(marker)),
  'service converts Provider Mesh evidence into behavior-level semantic claims',
);

const command = read('scripts/semantic-provider-mesh-certification.ts');
addCheck(
  'Command exposes text JSON source-root and require-pass',
  ['--json', '--require-pass', '--source-root', '--zavorth-root'].every((marker) => command.includes(marker)),
  'operator command supports text, JSON, source-root, zavorth-root and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes S3 scripts and SDK subpath',
  [
    'semantic-provider-mesh-certification',
    'semantic-provider-mesh-certification:json',
    'semantic-provider-mesh-certification:check',
    'qa:semantic-provider-mesh-certification',
    './sdk/semantic-provider-mesh-certification',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and public SDK export are registered',
);

const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/semantic-provider-mesh-certification.ts',
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
    'Runtime S3 semantic receipt passes',
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
    const adapterStatuses = snapshot.summary?.adapterStatuses || {};
    addCheck(
      'Runtime S3 semantic receipt passes',
      snapshot.status === 'passed'
        && snapshot.summary.gaps === 0
        && snapshot.summary.semanticClaims > 0
        && snapshot.summary.receiptBackedClaims === snapshot.summary.semanticClaims
        && snapshot.summary.liveIoPerformed === false
        && snapshot.summary.enabledByDefault === false
        && snapshot.summary.secretValuesSerialized === false
        && adapterStatuses['anthropic-direct'] !== 'missing'
        && adapterStatuses['google-genai'] !== 'missing'
        && receiptIdsValid
        && claimIdsUnique,
      `status=${snapshot.status}, claims=${snapshot.summary.semanticClaims}, gaps=${snapshot.summary.gaps}, receiptIdsValid=${receiptIdsValid}, claimIdsUnique=${claimIdsUnique}, next=${snapshot.commands.nextPhase}`,
    );
  } catch (error) {
    addCheck('Runtime S3 semantic receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[semantic-provider-mesh-certification] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
