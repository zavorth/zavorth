#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runAndroidFixture(),
  runVisionFixture(),
  runSubagentFixture(),
  runApprovalFixture(),
  runDenyFixture(),
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
  console.log('[zavorth-perception-invocation] checking Credential vault');
  printRules(rules, '[zavorth-perception-invocation]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthPerceptionInvocationContract.ts',
    'src/services/ZavorthPerceptionInvocationRouter.ts',
    'scripts/zavorth-perception-invocation.ts',
    'scripts/zavorth-perception-invocation-check.mjs',
    'tests/domain/surface/PerceptionInvocationRouter.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('perception-files', 'Perception invocation files exist', missing.length === 0, `${files.length ? missing.length}/${files.length}`, 'all Credential vault files present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthPerceptionInvocationContract.ts', ['subagent_perception', 'observer', 'ui-navigator', 'safety-reviewer', 'evidence-summarizer', 'factsObserved', 'actionsBlocked', 'normalUserDoesNotNeedManualCommand', 'setupShownOnlyWhenCapabilityMissing']],
    ['src/services/ZavorthPerceptionInvocationRouter.ts', ['ZavorthPerceptionInvocationRouter', 'buildSurfaceResponse', 'buildSubagentTask', 'read-only perception subagents', 'Fatos observados', 'Actions blocked', 'buildActivationHints', 'android-adb-setup']],
    ['src/domain/surface/presentation/shared-surface/SharedSurfaceEcosystemCommandPack.ts', ['ZavorthPerceptionInvocationRouter', 'perceptionInvocationRouter', 'subagent_perception', 'perception-readonly']],
    ['scripts/zavorth-perception-invocation.ts', ['--text', '--approval-id', 'formatPlanText']],
    ['package.json', ['node scripts/zavorth-perception-invocation-check.mjs']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('perception-markers', 'Perception invocation markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'router, contracts, commands and safety markers are wired', missing);
}

function runAndroidFixture() {
  const result = runTs('scripts/zavorth-perception-invocation.ts', [
    '--json',
    '--text', 'olhe meu celular e tell se passou',
  ]);
  return jsonRule('perception-android-fixture', 'Natural Android request routes to /device', result, (plan) =>
    plan.primaryRoute === 'android'
    && plan.commands.android?.action === 'device.observe'
    && plan.commands.android?.live === true
    && plan.activation?.normalUserDoesNotNeedManualCommand === true
    && plan.surfaceCommands.some((command) => command.command === '/device inspect'));
}

function runVisionFixture() {
  const result = runTs('scripts/zavorth-perception-invocation.ts', [
    '--json',
    '--text', 'visually confirm the result',
  ]);
  return jsonRule('perception-vision-fixture', 'Generic visual request routes to vision', result, (plan) =>
    plan.primaryRoute === 'vision'
    && plan.commands.vision?.action === 'vision.inspect'
    && plan.explanation.actionsExecuted.includes('No live mutation was executed by the router.'));
}

function runSubagentFixture() {
  const result = runTs('scripts/zavorth-perception-invocation.ts', [
    '--json',
    '--text', 'use delegated review for what appears on screen',
  ]);
  return jsonRule('perception-subagent-fixture', 'Explicit subagent perception routes read-only workers', result, (plan) =>
    plan.primaryRoute === 'subagent_perception'
    && plan.commands.subagent?.readOnlyOnly === true
    && plan.commands.subagent?.perceptionRoles.includes('observer')
    && plan.commands.subagent?.perceptionRoles.includes('evidence-summarizer')
    && plan.commands.subagent?.perceptionRoles.includes('safety-reviewer'));
}

function runApprovalFixture() {
  const result = runTs('scripts/zavorth-perception-invocation.ts', [
    '--json',
    '--text', 'resolva esse problema no app Notepad mas me peca confirmation before clicar',
  ]);
  return jsonRule('perception-approval-fixture', 'Mutating desktop request requires approval', result, (plan) =>
    plan.status === 'approval-required'
    && plan.primaryRoute === 'computer'
    && plan.commands.computer?.action === 'computer.plan'
    && plan.approval.required === true);
}

function runDenyFixture() {
  const result = runTs('scripts/zavorth-perception-invocation.ts', [
    '--json',
    '--text', 'inspect the banking screen and click to confirm the payment',
  ]);
  return jsonRule('perception-deny-fixture', 'Sensitive visual control request is denied', result, (plan) =>
    plan.status === 'denied'
    && plan.primaryRoute === 'deny'
    && plan.explanation.actionsBlocked.some((entry) => entry.includes('Sensitive screen')));
}

function runTs(script, args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    script,
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, label, result, expect) {
  if (result.status !== 0) return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr, result.stdout));
  try {
    const plan = JSON.parse(result.stdout);
    const passed = expect(plan);
    return rule(id, label, passed, `route=${plan.primaryRoute}; status=${plan.status}`, 'expected Credential vault route', passed ? [] : [JSON.stringify(plan, null, 2)]);
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
