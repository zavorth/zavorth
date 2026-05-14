import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthSemanticAgentRuntimeCertificationContract.ts',
  'src/services/ZavorthSemanticAgentRuntimeCertificationService.ts',
  'scripts/semantic-agent-runtime-certification.ts',
  'scripts/semantic-agent-runtime-certification-check.mjs',
  'src/sdk/semantic-agent-runtime-certification.ts',
  'tests/services/ZavorthSemanticAgentRuntimeCertificationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[semantic-agent-runtime-certification] ${prefix} ${name}: ${detail}`);
}

function read(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'S2 files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthSemanticAgentRuntimeCertificationContract.ts');
addCheck(
  'Contract captures semantic agent runtime claims',
  [
    'ZAVORTH_SEMANTIC_AGENT_RUNTIME_CERTIFICATION_CONTRACT_VERSION',
    'ZavorthSemanticAgentRuntimeClaim',
    'runtime-adapter',
    'tool-policy',
    'permission-guard',
    'cwd-sandbox',
    'bridge-policy',
    'noAnthropicApiImpersonation',
    'gapsBlockRelease',
  ].every((marker) => contract.includes(marker)),
  'contract includes runtime, tool policy, cwd, bridge, provider and release-blocking vocabulary',
);

const service = read('src/services/ZavorthSemanticAgentRuntimeCertificationService.ts');
addCheck(
  'Service certifies bridge package policy and runtime semantics',
  [
    'SourceAgentRuntimeBridgeService',
    'SourceAgentRuntimeToolPolicyService',
    'packageUsageClaim',
    'runtimeAdapterClaims',
    'bridgePolicyClaims',
    'toolPolicyClaims',
    'providerRouteClaims',
    'receiptAndExecutionClaims',
  ].every((marker) => service.includes(marker)),
  'service converts bridge evidence into behavior-level semantic claims',
);

const command = read('scripts/semantic-agent-runtime-certification.ts');
addCheck(
  'Command exposes text JSON source-root and require-pass',
  ['--json', '--require-pass', '--source-root', '--zavorth-root'].every((marker) => command.includes(marker)),
  'operator command supports text, JSON, source-root, zavorth-root and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes S2 scripts and SDK subpath',
  [
    'semantic-agent-runtime-certification',
    'semantic-agent-runtime-certification:json',
    'semantic-agent-runtime-certification:check',
    'qa:semantic-agent-runtime-certification',
    './sdk/semantic-agent-runtime-certification',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and public SDK export are registered',
);

const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/semantic-agent-runtime-certification.ts',
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
    'Runtime S2 semantic receipt passes',
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
    const bridgeStatuses = snapshot.summary?.bridgeStatuses || {};
    addCheck(
      'Runtime S2 semantic receipt passes',
      snapshot.status === 'passed'
        && snapshot.summary.gaps === 0
        && snapshot.summary.semanticClaims > 0
        && snapshot.summary.receiptBackedClaims === snapshot.summary.semanticClaims
        && snapshot.summary.liveExecutionPerformed === false
        && snapshot.summary.enabledByDefault === false
        && snapshot.summary.bypassPermissionsAllowed === false
        && bridgeStatuses['claude-agent-sdk'] === 'ready'
        && receiptIdsValid
        && claimIdsUnique,
      `status=${snapshot.status}, claims=${snapshot.summary.semanticClaims}, gaps=${snapshot.summary.gaps}, receiptIdsValid=${receiptIdsValid}, claimIdsUnique=${claimIdsUnique}, next=${snapshot.commands.nextPhase}`,
    );
  } catch (error) {
    addCheck('Runtime S2 semantic receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[semantic-agent-runtime-certification] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
