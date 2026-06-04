import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthSemanticNativeCompanionDeviceCapabilityCertificationContract.ts',
  'src/services/ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService.ts',
  'scripts/semantic-native-companion-device-capability-certification.ts',
  'scripts/semantic-native-companion-device-capability-certification-check.mjs',
  'src/sdk/semantic-native-companion-device-capability-certification.ts',
  'tests/services/ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[semantic-native-companion-device-capability-certification] ${prefix} ${name}: ${detail}`);
}

function read(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'S6 files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthSemanticNativeCompanionDeviceCapabilityCertificationContract.ts');
addCheck(
  'Contract captures semantic native companion/device claims',
  [
    'ZAVORTH_SEMANTIC_NATIVE_COMPANION_DEVICE_CAPABILITY_CERTIFICATION_CONTRACT_VERSION',
    'ZavorthSemanticNativeCompanionDeviceCapabilityClaim',
    'target-coverage',
    'capability-coverage',
    'pwa-bridge',
    'desktop-bridge',
    'wrapper-owner-gate',
    'permission-policy',
    'unsafe-native-policy',
    'gapsBlockRelease',
  ].every((marker) => contract.includes(marker)),
  'contract includes target, capability, bridge, wrapper gate, permission and unsafe policy vocabulary',
);

const service = read('src/services/ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService.ts');
addCheck(
  'Service certifies guarded Runtime gateway runtime semantics',
  [
    'ZavorthNativeCompanionDevicePackService',
    'targetClaim',
    'capabilityClaim',
    'pwaBridgeClaim',
    'desktopBridgeClaim',
    'optionalRuntimeClaim',
    'wrapperGateClaim',
    'permissionPolicyClaims',
    'unsafeNativeClaims',
  ].every((marker) => service.includes(marker)),
  'service converts Runtime gateway native companion/device pack evidence into behavior-level semantic claims',
);

const command = read('scripts/semantic-native-companion-device-capability-certification.ts');
addCheck(
  'Command exposes text JSON and require-pass',
  ['--json', '--require-pass', 'formatSnapshotText'].every((marker) => command.includes(marker)),
  'operator command supports text, JSON and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes S6 scripts and SDK subpath',
  [
    'semantic-native-companion-device-capability-certification',
    'semantic-native-companion-device-capability-certification:json',
    'semantic-native-companion-device-capability-certification:check',
    'qa:semantic-native-companion-device-capability-certification',
    './sdk/semantic-native-companion-device-capability-certification',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and public SDK export are registered',
);


const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/semantic-native-companion-device-capability-certification.ts',
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
    'Runtime S6 semantic receipt passes',
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
      'Runtime S6 semantic receipt passes',
      snapshot.status === 'passed'
        && snapshot.summary.gaps === 0
        && snapshot.summary.semanticClaims > 0
        && snapshot.summary.receiptBackedClaims === snapshot.summary.semanticClaims
        && snapshot.summary.targetClaimsCertified === 7
        && snapshot.summary.capabilityClaimsCertified >= 13
        && snapshot.summary.bridgeClaimsCertified >= 3
        && snapshot.summary.wrapperGateClaimsCertified === 3
        && snapshot.summary.scenariosPassed === 4
        && snapshot.summary.liveExternalIoPerformed === false
        && snapshot.summary.enabledByDefault === false
        && snapshot.summary.processSpawnedByDefault === false
        && snapshot.summary.secretValuesSerialized === false
        && receiptIdsValid
        && claimIdsUnique,
      `status=${snapshot.status}, claims=${snapshot.summary.semanticClaims}, gaps=${snapshot.summary.gaps}, receiptIdsValid=${receiptIdsValid}, claimIdsUnique=${claimIdsUnique}, next=${snapshot.commands.nextStage}`,
    );
  } catch (error) {
    addCheck('Runtime S6 semantic receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[semantic-native-companion-device-capability-certification] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
