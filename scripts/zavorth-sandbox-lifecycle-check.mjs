#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const rules = [
  filesExist(),
  markersExist(),
  fixtureStartDocker(),
  fixtureUseGvisor(),
  fixtureCleanupOwned(),
  fixtureCleanupUnownedBlocked(),
  fixtureExplicitUserOwnedStop(),
  fixtureListResources(),
  fixtureStopSpecificResource(),
  fixtureInspectDoesNotStart(),
];
const failed = rules.filter((rule) => rule.status === 'failed');

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ status: failed.length > 0 ? 'failed' : 'passed', rules }, null, 2));
} else {
  console.log('[zavorth-sandbox-lifecycle] checking natural sandbox lifecycle');
  for (const rule of rules) {
    console.log(`[zavorth-sandbox-lifecycle] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 10)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ZavorthSandboxLifecycleContract.ts',
    'src/services/ZavorthSandboxLifecycleManager.ts',
    'scripts/zavorth-sandbox-lifecycle.ts',
    'scripts/zavorth-sandbox-lifecycle-check.mjs',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', 'Lifecycle files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'all files present', missing);
}

function markersExist() {
  const checks = [
    ['src/contracts/ZavorthSandboxLifecycleContract.ts', ['noHiddenDaemonStart', 'noUserOwnedDaemonShutdown', 'userOwnedDaemonShutdownRequiresExplicitRequestAndApproval', 'onlyManageZavorthOwnedResources', 'explicitResourceTarget', 'list_runtime_resources', 'cleanupContainersOrVmsOnlyWhenZavorthOwned']],
    ['src/services/ZavorthSandboxLifecycleManager.ts', ['ZavorthSandboxLifecycleManager', 'never stop user-owned', 'explicitUserOwnedRuntimeRequest', 'targetResourceId', 'listDockerContainers', 'stop_user_runtime', 'startsOnRead', 'Start Docker Desktop', 'ZAVORTH_DOCKER_SANDBOX_RUNTIME=runsc']],
    ['scripts/zavorth-sandbox-lifecycle.ts', ['--owned-resource', '--approval-id', 'renderPlan']],
    ['package.json', ['zavorth:sandbox-lifecycle', 'zavorth:sandbox-lifecycle:check']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: ${needle}`);
    }
  }
  return rule('markers', 'Lifecycle safety markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'natural lifecycle and ownership safety markers', missing);
}

function fixtureStartDocker() {
  const result = runLifecycle(['--json', '--text', 'liga o docker para eu usar sandbox']);
  return jsonRule('start-docker', 'Start Docker requires scoped approval', result, (plan) =>
    plan.intent === 'start'
    && plan.selectedRuntime === 'docker'
    && plan.status === 'approval-required'
    && plan.safety.noHiddenDaemonStart === true
    && plan.actions.some((entry) => entry.kind === 'start_runtime' && entry.requiresApproval === true));
}

function fixtureUseGvisor() {
  const result = runLifecycle(['--json', '--text', 'use gvisor e crie uma coisa que teste javascript']);
  return jsonRule('use-gvisor', 'Use gVisor routes through lifecycle manager', result, (plan) =>
    plan.intent === 'use'
    && plan.selectedRuntime === 'gvisor'
    && plan.approval.required === true
    && plan.actions.some((entry) => entry.kind === 'execute_in_sandbox'));
}

function fixtureCleanupOwned() {
  const result = runLifecycle(['--json', '--text', 'derrube o que o zavorth subiu no docker', '--owned-resource', 'zavorth_container_123']);
  return jsonRule('cleanup-owned', 'Cleanup only touches owned resources', result, (plan) =>
    plan.intent === 'cleanup'
    && plan.status === 'approval-required'
    && plan.ownership.ownedResourceIds.includes('zavorth_container_123')
    && plan.notices.afterUse.includes('zavorth_container_123'));
}

function fixtureCleanupUnownedBlocked() {
  const result = runLifecycle(['--json', '--text', 'mate o docker inteiro']);
  return jsonRule('cleanup-unowned-blocked', 'Unowned daemon stop is blocked', result, (plan) =>
    plan.intent === 'cleanup'
    && plan.status === 'blocked'
    && plan.ownership.neverStopUserOwnedDaemonByDefault === true
    && plan.notices.blocked);
}

function fixtureExplicitUserOwnedStop() {
  const result = runLifecycle(['--json', '--text', 'desliga o docker que eu subi ontem']);
  return jsonRule('explicit-user-owned-stop', 'Explicit user-owned Docker stop is approval-gated', result, (plan) =>
    plan.intent === 'cleanup'
    && plan.selectedRuntime === 'docker'
    && plan.status === 'approval-required'
    && plan.ownership.explicitUserOwnedRuntimeRequest === true
    && plan.safety.userOwnedDaemonShutdownRequiresExplicitRequestAndApproval === true
    && plan.actions.some((entry) => entry.kind === 'stop_user_runtime' && entry.requiresApproval === true));
}

function fixtureListResources() {
  const result = runLifecycle(['--json', '--text', 'mostre todos os dockers ligados']);
  return jsonRule('list-resources', 'Runtime inventory is read-only and generic', result, (plan) =>
    plan.intent === 'list'
    && plan.selectedRuntime === 'docker'
    && plan.status === 'ready'
    && plan.inventory.readOnly === true
    && plan.inventory.canListWithoutStartingRuntime === true
    && plan.actions.some((entry) => entry.kind === 'list_runtime_resources'));
}

function fixtureStopSpecificResource() {
  const result = runLifecycle(['--json', '--text', 'derrube o container abc123def456']);
  return jsonRule('stop-specific-resource', 'Specific runtime target is approval-gated', result, (plan) =>
    plan.intent === 'cleanup'
    && plan.targetResourceId === 'abc123def456'
    && plan.status === 'approval-required'
    && plan.ownership.explicitResourceTarget === true
    && plan.actions.some((entry) => entry.kind === 'stop_user_runtime' && entry.requiresApproval === true));
}

function fixtureInspectDoesNotStart() {
  const result = runLifecycle(['--json', '--text', 'verifique se docker firecracker e gvisor estao prontos']);
  return jsonRule('inspect', 'Readiness inspection does not start heavy runtimes', result, (plan) =>
    plan.intent === 'inspect'
    && plan.status === 'ready'
    && plan.runtimeState.startsOnRead === false
    && plan.safety.noHiddenDaemonStart === true);
}

function runLifecycle(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-sandbox-lifecycle.ts',
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, label, result, expect) {
  if (result.status !== 0 && !result.stdout.trim()) {
    return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON', compact(result.stderr, result.stdout));
  }
  try {
    const plan = JSON.parse(result.stdout);
    const passed = Boolean(expect(plan));
    return rule(id, label, passed, `${plan.intent}/${plan.selectedRuntime}/${plan.status}`, 'expected lifecycle route', passed ? [] : [JSON.stringify(plan, null, 2)]);
  } catch (error) {
    return rule(id, label, false, 'invalid JSON', 'valid JSON', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function compact(...parts) {
  return parts.join('\n').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
