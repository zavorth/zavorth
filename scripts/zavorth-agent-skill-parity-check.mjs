#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleWorkspaceCheckIncludesNewGates(),
  runParityFixture(),
  runPracticalityCompletionFixture(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = { generatedAt: new Date().toISOString(), status: failed.length > 0 ? 'failed' : 'passed', rules };

if (asJson) console.log(JSON.stringify(snapshot, null, 2));
else {
  console.log('[zavorth-agent-skill-parity] checking Phase 9');
  printRules(rules, '[zavorth-agent-skill-parity]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/services/ZavorthAgentSkillParityCertificationService.ts',
    'src/contracts/ZavorthAgentPracticalityCompletionContract.ts',
    'src/services/ZavorthAgentPracticalityCompletionService.ts',
    'scripts/zavorth-agent-skill-parity.ts',
    'scripts/zavorth-agent-practicality-completion.ts',
    'scripts/zavorth-agent-skill-parity-check.mjs',
    'tests/domain/surface/AgentPracticalityCompletionService.test.ts',
    'docs/capability-plugins.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('parity-files', 'Parity files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'certification service and check present', missing);
}

function ruleWorkspaceCheckIncludesNewGates() {
  const text = read('package.json');
  const markers = [
    'zavorth:subagents:check',
    'zavorth:natural-invocation:check',
    'zavorth:skill-absorption-materialize:check',
    'zavorth:agent-skill-parity:check',
  ];
  const missing = markers.filter((marker) => !text.includes(marker));
  return rule('workspace-check-gates', 'workspace:check includes new gates', missing.length === 0, missing.length === 0 ? 'all gates' : `${missing.length} missing`, 'new checks are wired into package scripts', missing);
}

function runParityFixture() {
  const fixture = createFixture();
  try {
    const result = runTs('scripts/zavorth-agent-skill-parity.ts', ['--source', fixture.source, '--json']);
    return jsonRule('parity-fixture', 'Parity matrix passes with safe source', result, (snapshot) =>
      snapshot.status === 'passed'
      && snapshot.summary.features >= 15
      && snapshot.summary.blocked === 0
      && snapshot.smoke.explicitSubagentStatus === 'completed'
      && snapshot.smoke.materializationStatus === 'preview-only');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runPracticalityCompletionFixture() {
  const result = runTs('scripts/zavorth-agent-practicality-completion.ts', ['--json']);
  return jsonRule('agent-practicality-phase-6', 'Agent practicality Phase 6 passes', result, (snapshot) =>
    snapshot.status === 'passed'
    && snapshot.contractVersion === '2026-05-11.agent-practicality-phase-6'
    && snapshot.surfaceProjections?.length >= 7
    && snapshot.runtimeSurface?.commands?.includes('/agents status')
    && snapshot.commandCenterProjection?.noVisualMutation === true
    && snapshot.safety?.visualChangesRequireOwnerApproval === true
    && snapshot.nextArchitectureSuggestion?.shouldSuggestAfterPhase6 === true);
}

function createFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-parity-'));
  const source = path.join(base, 'source');
  const skill = path.join(source, 'safe-parity-skill');
  fs.mkdirSync(path.join(skill, 'references'), { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), [
    '---',
    'name: safe-parity-skill',
    'description: Safe parity fixture skill.',
    'license: MIT',
    '---',
    '',
    '# Safe Parity Skill',
    '',
    'Summarize local notes.',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(skill, 'references', 'notes.md'), '# Notes\n\nParity fixture.\n', 'utf8');
  return { root: base, source };
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
    const passed = snapshot.summary?.passed ?? snapshot.axes?.filter?.((axis) => axis.status === 'passed')?.length ?? 'n/a';
    return rule(id, label, pass, `status=${snapshot.status}; passed=${passed}`, 'expected parity certificate', pass ? [] : [JSON.stringify(snapshot, null, 2)]);
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
