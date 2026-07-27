#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runSubagentRouteFixture(),
  runImplicitAutoSubagentRouteFixture(),
  runAbsorptionRouteFixture(),
  runSandboxInventoryRouteFixture(),
  runSandboxTargetStopRouteFixture(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = { generatedAt: new Date().toISOString(), status: failed.length > 0 ? 'failed' : 'passed', rules };

if (asJson) console.log(JSON.stringify(snapshot, null, 2));
else {
  console.log('[zavorth-natural-invocation] checking Credential vault/7');
  printRules(rules, '[zavorth-natural-invocation]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthNaturalInvocationContract.ts',
    'src/contracts/ZavorthSubagentAutoInvocationContract.ts',
    'src/contracts/ZavorthSandboxLifecycleContract.ts',
    'src/services/ZavorthNaturalInvocationRouter.ts',
    'src/services/ZavorthSubagentAutoInvocationPolicyService.ts',
    'src/services/ZavorthSandboxLifecycleManager.ts',
    'scripts/zavorth-natural-invocation.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('natural-files', 'Natural invocation files exist', missing.length === 0, `${files.length ? missing.length}/${files.length}`, 'contract service CLI present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthNaturalInvocationContract.ts', ['telegram', 'imessage']],
    ['src/contracts/ZavorthNaturalInvocationContract.ts', ['sandbox_lifecycle', 'ZavorthSandboxLifecyclePlan']],
    ['src/services/ZavorthNaturalInvocationRouter.ts', ['/agents spawn', '/skills absorb', '/sandbox', '/invoke']],
    ['src/services/ZavorthNaturalInvocationRouter.ts', ['use a melhor skill', 'quebre', 'spawn_team', 'buildSurfaceCommands']],
    ['src/services/ZavorthNaturalInvocationRouter.ts', ['ZavorthSandboxLifecycleManager', 'looksLikeSandboxLifecycleRequest', 'looksLikeSandboxLifecycleMutation']],
    ['src/services/ZavorthSubagentAutoInvocationPolicyService.ts', ['invoke_live_subagents', 'workspaceMutationRequiresApproval', 'Direct mode skips implicit subagent auto-routing', 'publicRationale', 'noRawChainOfThought']],
    ['src/domain/surface/presentation/shared-surface/SharedSurfaceEcosystemCommandPack.ts', ['case \'/sandbox\'', 'looksLikeSandboxLifecycleRequest']],
    ['scripts/zavorth-natural-invocation.ts', ['--dry-live', '--no-auto-live-subagents']],
    ['package.json', ['zavorth:natural-invocation', 'zavorth:natural-invocation:json', 'zavorth:natural-invocation:check']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('natural-markers', 'Natural route markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'semantic phrases and shared commands present', missing);
}

function runSubagentRouteFixture() {
  const result = runTs('scripts/zavorth-natural-invocation.ts', [
    '--text', 'ask one agent to research and another to review locally',
    '--execute',
    '--dry-live',
    '--json',
  ]);
  return jsonRule('natural-subagent-route', 'Natural request spawns team route', result, (snapshot) =>
    snapshot.primaryAction === 'spawn_team'
    && snapshot.execution.subagentRuntime
    && snapshot.execution.subagentRuntime.summary.liveRuns >= 1
    && snapshot.surfaceCommands.some((command) => command.command === '/agents spawn <task>'));
}

function runImplicitAutoSubagentRouteFixture() {
  const result = runTs('scripts/zavorth-natural-invocation.ts', [
    '--text', 'perform a deep audit across Zavorth, look for failures, compare risks, and validate findings',
    '--execute',
    '--dry-live',
    '--json',
  ]);
  return jsonRule('natural-auto-live-subagent-route', 'Complex read-only request auto-selects live subagents', result, (snapshot) =>
    snapshot.primaryAction === 'spawn_team'
    && snapshot.execution.subagentRuntime
    && snapshot.execution.subagentRuntime.runs.at(-1).executionMode === 'dry-live'
    && snapshot.execution.subagentRuntime.autoInvocationTelemetry.latest.selectedBy === 'implicit-complexity');
}

function runAbsorptionRouteFixture() {
  const result = runTs('scripts/zavorth-natural-invocation.ts', [
    '--text', 'quebre essa biblioteca grande em partes',
    '--source', 'C:/tmp/skills',
    '--json',
  ]);
  return jsonRule('natural-absorption-route', 'Natural request routes large absorption', result, (snapshot) =>
    snapshot.primaryAction === 'large_absorption'
    && snapshot.sourcePath === 'C:/tmp/skills'
    && snapshot.surfaceCommands.some((command) => command.command === '/skills batches'));
}

function runSandboxInventoryRouteFixture() {
  const result = runTs('scripts/zavorth-natural-invocation.ts', [
    '--text', 'mostre todos os containers docker ligados',
    '--json',
  ]);
  return jsonRule('natural-sandbox-inventory-route', 'Natural request routes sandbox inventory read-only', result, (snapshot) =>
    snapshot.primaryAction === 'sandbox_lifecycle'
    && snapshot.execution.sandboxLifecycle
    && snapshot.execution.sandboxLifecycle.intent === 'list'
    && snapshot.execution.sandboxLifecycle.inventory.readOnly === true
    && snapshot.surfaceCommands.some((command) => command.command === '/sandbox list'));
}

function runSandboxTargetStopRouteFixture() {
  const result = runTs('scripts/zavorth-natural-invocation.ts', [
    '--text', 'derrube o container abc123def456',
    '--json',
  ]);
  return jsonRule('natural-sandbox-target-stop-route', 'Natural request routes specific sandbox stop through approval', result, (snapshot) =>
    snapshot.primaryAction === 'ask_approval'
    && snapshot.actions.includes('sandbox_lifecycle')
    && snapshot.execution.sandboxLifecycle
    && ['cleanup', 'stop'].includes(snapshot.execution.sandboxLifecycle.intent)
    && snapshot.execution.sandboxLifecycle.targetResourceId === 'abc123def456'
    && snapshot.execution.sandboxLifecycle.approval.required === true);
}

function runTs(script, args) {
  return spawnSync(process.execPath, [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
}

function jsonRule(id, label, result, expect) {
  if (result.status !== 0) return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr, result.stdout));
  try {
    const snapshot = JSON.parse(result.stdout);
    const pass = expect(snapshot);
    return rule(id, label, pass, `action=${snapshot.primaryAction}; status=${snapshot.status}`, 'expected natural route', pass ? [] : [JSON.stringify(snapshot, null, 2)]);
  } catch (error) {
    return rule(id, label, false, 'invalid JSON', 'valid JSON fixture', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function printRules(items, prefix) {
  for (const item of items) {
    console.log(`${prefix} ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 12)) console.log(`  - ${detail}`);
  }
}

function compact(...parts) {
  return parts.join('\n').split(/\r...\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
