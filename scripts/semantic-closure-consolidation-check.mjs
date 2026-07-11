import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthSemanticClosureConsolidationContract.ts',
  'src/services/ZavorthSemanticClosureConsolidationService.ts',
  'scripts/semantic-closure-consolidation.ts',
  'scripts/semantic-closure-consolidation-check.mjs',
  'src/sdk/semantic-closure-consolidation.ts',
  'tests/services/ZavorthSemanticClosureConsolidationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[semantic-closure-consolidation] ${prefix} ${name}: ${detail}`);
}

function read(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'Consolidation files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthSemanticClosureConsolidationContract.ts');
addCheck(
  'Contract captures S1-S9 consolidated release gate',
  [
    'ZAVORTH_SEMANTIC_CLOSURE_CONSOLIDATION_CONTRACT_VERSION',
    'ZavorthSemanticClosurePhaseReceipt',
    'ZavorthSemanticClosureReleaseGate',
    'semanticScope: \'S1-S9\'',
    'everySemanticPhaseMustPass',
    'everyClaimMustHaveReceipt',
    'releaseGateBlocksAnyRegression',
  ].every((marker) => contract.includes(marker)),
  'contract includes gate receipts, release gate, S1-S9 scope and regression-blocking policy',
);

const service = read('src/services/ZavorthSemanticClosureConsolidationService.ts');
addCheck(
  'Service aggregates every semantic certification phase',
  [
    'ZavorthSemanticPluginPackageCertificationService',
    'ZavorthSemanticAgentRuntimeCertificationService',
    'ZavorthSemanticProviderMeshCertificationService',
    'ZavorthSemanticChannelMeshCertificationService',
    'ZavorthSemanticMemoryDocumentTerminalCertificationService',
    'ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService',
    'ZavorthSemanticQaSecurityReleaseCertificationService',
    'ZavorthSemanticSkillEcosystemCertificationService',
    'ZavorthSemanticFunctionalClosureCertificationService',
    'buildReleaseGate',
  ].every((marker) => service.includes(marker)),
  'service calls S1-S9 certifiers and builds one release gate',
);

const command = read('scripts/semantic-closure-consolidation.ts');
addCheck(
  'Command exposes text JSON release-gate roots and require-pass',
  ['--json', '--require-pass', '--release-gate', '--root-dir', '--source-root', '--zavorth-root'].every((marker) => command.includes(marker)),
  'operator command supports text, JSON, release-gate, roots and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes consolidation scripts and SDK subpath',
  [
    'semantic-closure-consolidation',
    'semantic-closure-consolidation:json',
    'semantic-closure-consolidation:check',
    'qa:semantic-closure-consolidation',
    './sdk/semantic-closure-consolidation',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and public SDK export are registered',
);

const sdkIndex = read('src/sdk/index.ts');
const sdkContracts = read('src/sdk/contracts.ts');
addCheck(
  'SDK index and contract exports include consolidation',
  sdkIndex.includes('./semantic-closure-consolidation.js')
    && sdkIndex.includes('../services/ZavorthSemanticClosureConsolidationService.js')
    && sdkContracts.includes('../contracts/ZavorthSemanticClosureConsolidationContract.js'),
  'SDK central exports expose the consolidation service and contract',
);


const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/semantic-closure-consolidation.ts',
    '--json',
    '--require-pass',
  ],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
  },
);

if (runtime.status !== 0) {
  addCheck(
    'Runtime S1-S9 consolidated receipt passes',
    false,
    `command exited ${runtime.status}; ${runtime.stderr || runtime.stdout}`.slice(0, 2000),
  );
} else {
  try {
    const snapshot = JSON.parse(runtime.stdout);
    const phases = snapshot.phaseReceipts.map((receipt) => receipt.stage).join(',');
    addCheck(
      'Runtime S1-S9 consolidated receipt passes',
      snapshot.status === 'passed'
        && snapshot.semanticScope === 'S1-S9'
        && snapshot.summary.phases === 9
        && snapshot.summary.passed === 9
        && snapshot.summary.failed === 0
        && snapshot.summary.gaps === 0
        && snapshot.summary.semanticClaims > 0
        && snapshot.summary.receiptBackedClaims === snapshot.summary.semanticClaims
        && snapshot.releaseGate.releaseAllowed === true
        && snapshot.releaseGate.allClaimsReceiptBacked === true
        && snapshot.releaseGate.allPhaseClaimIdsUnique === true
        && snapshot.releaseGate.allReceiptIdsValid === true
        && snapshot.releaseGate.machineReadableClosurePassed === true
        && snapshot.releaseGate.functionalReleaseAllowed === true
        && snapshot.releaseGate.noLiveExternalIo === true
        && snapshot.releaseGate.noSecretValuesSerialized === true
        && phases === 'S1,S2,S3,S4,S5,S6,S7,S8,S9',
      `status=${snapshot.status}, phases=${phases}, claims=${snapshot.summary.semanticClaims}, gaps=${snapshot.summary.gaps}, blockers=${snapshot.summary.releaseBlockers}, next=${snapshot.commands.nextStep}`,
    );
  } catch (error) {
    addCheck('Runtime S1-S9 consolidated receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[semantic-closure-consolidation] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
