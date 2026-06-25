#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runSpawnFixture(),
  runLiveWorkerFixture(),
  runApprovalFixture(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-subagents] checking Connector registry');
  printRules(rules, '[zavorth-subagents]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthSubagentRuntimeContract.ts',
    'src/contracts/ZavorthInvocationReceiptContract.ts',
    'src/agents/ZavorthSubagentRuntimeService.ts',
    'src/services/ZavorthLiveSubagentExecutionService.ts',
    'src/services/ZavorthSubagentInvocationGatewayService.ts',
    'scripts/zavorth-subagents.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('subagent-files', 'Subagent runtime files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'all runtime files present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthSubagentRuntimeContract.ts', ['subagents.spawn', 'subagents.wait', 'thread-bound', 'explicitUserSubagentsCanRunReadOnly', 'readOnlyToolsRequirePolicyBroker', 'subagentToolCallsAreLimited', 'liveWorkersAreConcurrent', 'autoInvocationTelemetry']],
    ['src/agents/ZavorthSubagentRuntimeService.ts', ['ZavorthGovernedSubagentService', 'ZavorthLiveSubagentExecutionService', 'createSubagentResultReceipt', 'Policy Broker', 'maxSpawnDepth', 'public-readonly-research-precleared', 'Auto subagent decision']],
    ['src/services/ZavorthLiveSubagentExecutionService.ts', ['subagent-readonly-tool-call', 'workspace-readonly-tool-allowed', 'mutating-or-unknown-tool-blocked', 'Tool policy: requested=']],
    ['src/services/ZavorthSubagentInvocationGatewayService.ts', ['invokeFromCron', 'invokeFromSkill', 'invokeFromPlugin', 'sourceSurface']],
    ['scripts/zavorth-subagents.ts', ['--explicit-subagents', '--mock-live', '--no-persist', 'subagents.spawn']],
    ['src/telegram/commandCatalog.ts', ['/subagent', '/sessions_spawn', 'agents']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('subagent-markers', 'Subagent markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'runtime contract, policy and CLI markers', missing);
}

function runSpawnFixture() {
  const result = runTs('scripts/zavorth-subagents.ts', [
    'spawn',
    '--task', 'use subagentes e analise localmente',
    '--explicit',
    '--no-persist',
    '--json',
  ]);
  return jsonRule('subagent-spawn-fixture', 'Read-only explicit spawn completes', result, (snapshot) =>
    snapshot.status === 'completed'
    && snapshot.summary.workspaceMutationPerformed === false
    && snapshot.summary.externalIoPerformed === false
    && snapshot.receipts.length > 0);
}

function runLiveWorkerFixture() {
  const result = runTs('scripts/zavorth-subagents.ts', [
    'spawn',
    '--task', 'use subagentes e analise localmente',
    '--roles', 'planner,qa',
    '--explicit',
    '--mock-live',
    '--max-live-workers', '2',
    '--no-persist',
    '--json',
  ]);
  return jsonRule('subagent-live-worker-fixture', 'Mock live workers run concurrently under the same contract', result, (snapshot) =>
    snapshot.status === 'completed'
    && snapshot.summary.liveRuns === 1
    && snapshot.summary.workerResults === 2
    && snapshot.runs?.[0]?.executionMode === 'mock-live'
    && snapshot.runs?.[0]?.workerResults?.length === 2);
}

function runApprovalFixture() {
  const result = runTs('scripts/zavorth-subagents.ts', [
    'spawn',
    '--task', 'use subagentes e edite arquivos do workspace',
    '--explicit',
    '--no-persist',
    '--json',
  ]);
  return jsonRule('subagent-approval-fixture', 'Mutating spawn requires approval', result, (snapshot) =>
    snapshot.status === 'approval-required'
    && snapshot.receipts.some((entry) => entry.status === 'approval-required'));
}

function runTs(script, args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    script,
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, label, result, expect) {
  if (result.status !== 0) {
    return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr, result.stdout));
  }
  try {
    const snapshot = JSON.parse(result.stdout);
    return rule(id, label, expect(snapshot), `status=${snapshot.status}`, 'expected safe fixture behavior', expect(snapshot) ? [] : [JSON.stringify(snapshot, null, 2)]);
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
  return parts.join('\n').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
