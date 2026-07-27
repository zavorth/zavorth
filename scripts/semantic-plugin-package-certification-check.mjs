import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthSemanticPluginPackageCertificationContract.ts',
  'src/services/ZavorthSemanticPluginPackageCertificationService.ts',
  'scripts/semantic-plugin-package-certification.ts',
  'scripts/semantic-plugin-package-certification-check.mjs',
  'src/sdk/semantic-plugin-package-certification.ts',
  'tests/services/ZavorthSemanticPluginPackageCertificationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[semantic-plugin-package-certification] ${prefix} ${name}: ${detail}`);
}

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'S1 files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthSemanticPluginPackageCertificationContract.ts');
addCheck(
  'Contract captures semantic package claims',
  [
    'ZAVORTH_SEMANTIC_PLUGIN_PACKAGE_CERTIFICATION_CONTRACT_VERSION',
    'ZavorthSemanticPluginPackageClaim',
    'package-presence',
    'export-family',
    'manifest-conversion',
    'lifecycle-policy',
    'gapsBlockRelease',
  ].every((marker) => contract.includes(marker)),
  'contract includes claims, priorities, lifecycle and release-blocking gaps',
);

const service = read('src/services/ZavorthSemanticPluginPackageCertificationService.ts');
addCheck(
  'Service maps packages, exports, manifests and lifecycle',
  [
    'packagePresenceClaim',
    'exportFamilyClaims',
    'manifestClaims',
    'lifecycleClaims',
    'runtimePolicyClaims',
    'SourcePluginOsAbsorptionService',
  ].every((marker) => service.includes(marker)),
  'service converts Intent model evidence into behavior-level semantic claims',
);

const command = read('scripts/semantic-plugin-package-certification.ts');
addCheck(
  'Command exposes text JSON and require-pass',
  ['--json', '--require-pass', '--source-root'].every((marker) => command.includes(marker)),
  'operator command supports text, JSON, source-root override and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes S1 scripts and SDK subpath',
  [
    'semantic-plugin-package-certification',
    'semantic-plugin-package-certification:json',
    'semantic-plugin-package-certification:check',
    'qa:semantic-plugin-package-certification',
    './sdk/semantic-plugin-package-certification',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and public SDK export are registered',
);

const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/semantic-plugin-package-certification.ts',
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
    'Runtime S1 semantic receipt passes',
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
    addCheck(
      'Runtime S1 semantic receipt passes',
      snapshot.status === 'passed'
        && snapshot.summary.gaps === 0
        && snapshot.summary.semanticClaims > 0
        && snapshot.summary.receiptBackedClaims === snapshot.summary.semanticClaims
        && receiptIdsValid,
      `status=${snapshot.status}, claims=${snapshot.summary.semanticClaims}, gaps=${snapshot.summary.gaps}, receiptIdsValid=${receiptIdsValid}, next=${snapshot.commands.nextAction}`,
    );
  } catch (error) {
    addCheck('Runtime S1 semantic receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[semantic-plugin-package-certification] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
