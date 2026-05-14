#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'openshell-sandbox-parity-files',
    label: 'OpenShell sandbox parity files exist',
    target: 'Contract, adapters, services, tests, docs and package scripts are present',
    files: [
      'src/contracts/RemoteSandboxContract.ts',
      'src/adapters/sandbox/OpenShellConfigAdapter.ts',
      'src/adapters/sandbox/OpenShellCliAdapter.ts',
      'src/adapters/sandbox/OpenShellSandboxLifecycleAdapter.ts',
      'src/adapters/sandbox/OpenShellSshTransportAdapter.ts',
      'src/services/OpenShellRemoteSandboxService.ts',
      'src/services/OpenShellWorkspaceBridgeService.ts',
      'src/services/OpenShellReadinessService.ts',
      'tests/services/OpenShellRemoteSandboxService.test.ts',
      'scripts/openshell-sandbox-parity-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'remote-sandbox-contract',
    label: 'Contract defines remote sandbox vocabulary',
    target: 'Contract covers config, lifecycle, SSH, workspace bridge, readiness, artifacts and no-live-IO policy',
    files: ['src/contracts/RemoteSandboxContract.ts'],
    needles: [
      'ZAVORTH_REMOTE_SANDBOX_CONTRACT_VERSION',
      'RemoteSandboxMode',
      'artifact-first-mirror',
      'OpenShellRemoteSandboxConfig',
      'OpenShellLifecyclePlan',
      'OpenShellSshSessionPlan',
      'OpenShellWorkspaceSyncPlan',
      'OpenShellRemoteCommandPlan',
      'OpenShellReadinessSnapshot',
      'sandbox.remote.receipt',
      'mirrorBackToHost: false',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'openshell-config-adapter',
    label: 'Config adapter normalizes Zavorth OpenShell profiles',
    target: 'Config adapter converts mirror into artifact-first mirror and validates managed remote roots',
    files: ['src/adapters/sandbox/OpenShellConfigAdapter.ts'],
    needles: [
      'OpenShellConfigAdapter',
      'artifact-first-mirror',
      'must stay under /sandbox or /agent',
      'normalizeProviders',
      'timeoutMs',
    ],
  }),
  ruleContainsAll({
    id: 'openshell-cli-adapter',
    label: 'CLI adapter builds redacted OpenShell invocations',
    target: 'CLI adapter exposes lifecycle commands, env filtering and no-live-IO plans',
    files: ['src/adapters/sandbox/OpenShellCliAdapter.ts'],
    needles: [
      'OpenShellCliAdapter',
      'sanitizeEnv',
      'blockedEnvKeys',
      'sandbox',
      'create',
      'delete',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'openshell-lifecycle-adapter',
    label: 'Lifecycle adapter builds deterministic sandbox runtime IDs',
    target: 'Lifecycle adapter emits get/create/delete plans with explicit delete',
    files: ['src/adapters/sandbox/OpenShellSandboxLifecycleAdapter.ts'],
    needles: [
      'OpenShellSandboxLifecycleAdapter',
      'buildRuntimeId',
      'deterministicRuntimeId: true',
      'deleteIsExplicit: true',
      'get',
      'create',
      'delete',
    ],
  }),
  ruleContainsAll({
    id: 'openshell-ssh-adapter',
    label: 'SSH adapter builds escaped remote command plans',
    target: 'SSH adapter models shell escaping, PTY, pipe-open stdin and env denylist',
    files: ['src/adapters/sandbox/OpenShellSshTransportAdapter.ts'],
    needles: [
      'OpenShellSshTransportAdapter',
      'shellEscape',
      'pipe-open',
      'blockedEnvKeys',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'openshell-runtime-service',
    label: 'Runtime service closes Worker 3 feature coverage',
    target: 'Service covers 11 OpenShell parity features and keeps mirror-back artifact-first',
    files: ['src/services/OpenShellRemoteSandboxService.ts'],
    needles: [
      'OpenShellRemoteSandboxService',
      'config-contract',
      'cli-adapter',
      'lifecycle-manager',
      'ssh-transport',
      'remote-execution',
      'filesystem-bridge',
      'artifact-first-mirror',
      'workspace-sync',
      'env-filter',
      'readiness-doctor',
      'security-behavior-tests',
      'Worker 4 - SDK/export closure',
    ],
  }),
  ruleContainsAll({
    id: 'workspace-bridge-artifact-first',
    label: 'Workspace bridge blocks direct host mirror-back',
    target: 'Bridge collects remote deltas as artifacts and requires Mutation Plane approval before host apply',
    files: ['src/services/OpenShellWorkspaceBridgeService.ts'],
    needles: [
      'mirrorBackToHost: false',
      'applyRequiresMutationApproval: true',
      'reject-symlink-parents',
      'reject-final-symlink',
      'reject-hardlink-alias',
      'artifact-first-output',
      'assertLocalPathContained',
    ],
  }),
  ruleContainsAll({
    id: 'openshell-normalization-target',
    label: 'Capability normalization points openshell at native remote sandbox plane',
    target: 'openshell remains 125/125 normalized and targets RemoteSandbox contract/service/adapters',
    files: ['src/services/CapabilityNormalizationService.ts'],
    needles: [
      'sandbox.remote',
      'runtimeStatus: \'native-contract\'',
      'src/contracts/RemoteSandboxContract.ts',
      'src/services/OpenShellRemoteSandboxService.ts',
      'src/adapters/sandbox',
      'openshell',
    ],
  }),
  ruleContainsAll({
    id: 'openshell-runtime-tests',
    label: 'Tests prove OpenShell sandbox parity behavior',
    target: 'Tests cover snapshot closure, normalization target, config guards, lifecycle flags, SSH, workspace bridge and env filtering',
    files: ['tests/services/OpenShellRemoteSandboxService.test.ts'],
    needles: [
      'closes OpenShell as a Zavorth-native remote sandbox runtime proof',
      'keeps openshell normalized to a native remote sandbox contract target',
      'resolves config defaults, provider dedupe and managed remote path guards',
      'builds deterministic lifecycle and CLI create flags without live IO',
      'builds SSH command plans with shell escaping, PTY and env denylist',
      'keeps workspace bridge artifact-first and rejects local path escape',
      'sanitizes secret-bearing CLI env keys',
      'features: 11',
      'nativeRuntimeProofs: 11',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-openshell-gates',
    label: 'package exposes OpenShell sandbox parity gates',
    target: 'local QA can run openshell-sandbox-parity check',
    files: ['package.json'],
    needles: [
      'openshell-sandbox-parity:check',
      'qa:openshell-sandbox-parity',
      'scripts/openshell-sandbox-parity-check.mjs',
    ],
  }),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[openshell-sandbox-parity] checking Worker 3');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[openshell-sandbox-parity] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist(input) {
  const missing = input.files.filter((file) => !exists(file));
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${input.files.length - missing.length}/${input.files.length} file(s) present`,
    target: input.target,
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsAll(input) {
  const missing = [];
  for (const file of input.files) {
    const contents = read(file);
    if (contents === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of input.needles) {
      if (!contents.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}
