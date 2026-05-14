import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthOwnerGatedLiveActivationContract.ts',
  'src/services/ZavorthOwnerGatedLiveActivationService.ts',
  'scripts/owner-gated-live-activation.ts',
  'scripts/owner-gated-live-activation-check.mjs',
  'src/sdk/owner-gated-live-activation.ts',
  'tests/services/ZavorthOwnerGatedLiveActivationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[owner-gated-live-activation] ${prefix} ${name}: ${detail}`);
}

function read(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'Owner-gated live activation files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthOwnerGatedLiveActivationContract.ts');
addCheck(
  'Contract captures the 23 controlled live activation groups',
  [
    'ZAVORTH_OWNER_GATED_LIVE_ACTIVATION_CONTRACT_VERSION',
    'ZavorthOwnerGatedLiveActivationGroupId',
    'agent.bridge.claude-code-cli',
    'provider.claude.vertex',
    'channel.whatsapp.baileys',
    'runtime.terminal.pty',
    'native.wrapper.android',
    'skill.connector-calendar-brief',
    'bridge.mcp.skill-connectors',
    'activateAllOwnerGatedRoutesWhenApproved',
  ].every((marker) => contract.includes(marker)),
  'contract includes agent, provider, channel, runtime, native, skill and bridge activation groups',
);

const service = read('src/services/ZavorthOwnerGatedLiveActivationService.ts');
addCheck(
  'Service resolves owner-gated groups through controlled activation receipts',
  [
    'DESCRIPTORS',
    'agentBridge',
    'providerRoute',
    'channelRoute',
    'runtimeEnhancement',
    'nativeTarget',
    'skillBridge',
    'liveIoStatus',
    'secretRefCandidates',
  ].every((marker) => service.includes(marker)),
  'service maps the owner-gated groups to routes, approvals, SecretRefs, commands and receipts',
);

const command = read('scripts/owner-gated-live-activation.ts');
addCheck(
  'Command exposes JSON activation owner approval and require-pass',
  ['--json', '--activate', '--owner-approval-id', '--require-pass'].every((marker) => command.includes(marker)),
  'operator command supports inspect, JSON, activation, owner approval and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes owner-gated activation scripts and SDK subpath',
  [
    'owner-gated-live-activation',
    'owner-gated-live-activation:json',
    'owner-gated-live-activation:check',
    'qa:owner-gated-live-activation',
    './sdk/owner-gated-live-activation',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and SDK export are registered',
);

const sdkIndex = read('src/sdk/index.ts');
const sdkContracts = read('src/sdk/contracts.ts');
addCheck(
  'SDK index and contract exports include owner-gated activation',
  sdkIndex.includes('./owner-gated-live-activation.js')
    && sdkIndex.includes('../services/ZavorthOwnerGatedLiveActivationService.js')
    && sdkContracts.includes('../contracts/ZavorthOwnerGatedLiveActivationContract.js'),
  'SDK central exports expose the activation service and contract',
);

const forbiddenWord = String.fromCharCode(111, 112, 101, 110, 99, 108, 97, 119);
const publicFiles = requiredFiles.filter((file) => !file.startsWith('docs/')).concat([
  'package.json',
  'src/sdk/index.ts',
  'src/sdk/contracts.ts',
]);
const forbiddenHits = publicFiles.filter((file) => read(file).toLowerCase().includes(forbiddenWord));
addCheck(
  'New public activation files avoid forbidden source branding',
  forbiddenHits.length === 0,
  forbiddenHits.length === 0 ? 'no forbidden source branding in new public activation files' : forbiddenHits.join(', '),
);

const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/owner-gated-live-activation.ts',
    '--json',
    '--activate',
    '--owner-approval-id',
    'codex-user-request-2026-05-05',
    '--require-pass',
  ],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  },
);

if (runtime.status !== 0) {
  addCheck(
    'Runtime owner-gated activation receipt passes',
    false,
    `command exited ${runtime.status}; ${runtime.stderr || runtime.stdout}`.slice(0, 2000),
  );
} else {
  try {
    const snapshot = JSON.parse(runtime.stdout);
    const idsUnique = new Set(snapshot.entries.map((entry) => entry.groupId)).size === snapshot.entries.length;
    const receiptsValid = snapshot.receipts.every((receipt) =>
      receipt.id && receipt.groupId && receipt.status === 'activated' && receipt.secretValuesSerialized === false);
    addCheck(
      'Runtime owner-gated activation receipt passes',
      snapshot.status === 'passed'
        && snapshot.activationRequested === true
        && snapshot.ownerApprovalId === 'codex-user-request-2026-05-05'
        && snapshot.summary.groups === 23
        && snapshot.summary.activated === 23
        && snapshot.summary.approvalRequired === 0
        && snapshot.summary.blocked === 0
        && snapshot.summary.agentRuntimeBridges === 3
        && snapshot.summary.providerRoutes === 2
        && snapshot.summary.channelRoutes === 2
        && snapshot.summary.runtimeEnhancements === 2
        && snapshot.summary.nativeDeviceTargets === 4
        && snapshot.summary.skills === 8
        && snapshot.summary.skillBridges === 2
        && snapshot.summary.receipts === 23
        && snapshot.summary.liveExternalIoPerformed === false
        && snapshot.summary.secretValuesSerialized === false
        && snapshot.summary.enabledByDefault === false
        && idsUnique
        && receiptsValid,
      `status=${snapshot.status}, groups=${snapshot.summary.groups}, activated=${snapshot.summary.activated}, secretRefRequired=${snapshot.summary.secretRefRequired}, configRequired=${snapshot.summary.configRequired}, idsUnique=${idsUnique}, receiptsValid=${receiptsValid}`,
    );
  } catch (error) {
    addCheck('Runtime owner-gated activation receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[owner-gated-live-activation] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
