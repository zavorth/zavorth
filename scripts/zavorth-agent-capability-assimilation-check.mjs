#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runMatrixFixture(),
  runFilteredFixture(),
  ruleWorkspaceCheck(),
  ruleNoPublicExternalNames(),
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
  console.log('[zavorth-agent-capability-assimilation] checking Intent model');
  printRules(rules, '[zavorth-agent-capability-assimilation]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthAgentCapabilityAssimilationContract.ts',
    'src/services/ZavorthAgentCapabilityAssimilationService.ts',
    'scripts/zavorth-agent-capability-assimilation.ts',
    'scripts/zavorth-agent-capability-assimilation-check.mjs',
    'tests/domain/agent/AgentCapabilityAssimilationService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('assimilation-files', 'Intent model files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthAgentCapabilityAssimilationContract.ts', ['ZAVORTH_AGENT_CAPABILITY_ASSIMILATION_CONTRACT_VERSION', 'noExternalSourceCodeCopied', 'noRawChainOfThoughtPolicy', 'zavorthControlVisualChangesRequireOwnerApproval']],
    ['src/services/ZavorthAgentCapabilityAssimilationService.ts', ['Compact Governed Plan', 'Natural Tool Router', 'Governed Subagent Runtime', 'Universal Skill Intake', 'Perception Control Plane', 'Trust Plane Governance']],
    ['scripts/zavorth-agent-capability-assimilation.ts', ['--category', '--status', '--json']],
    ['src/sdk/contracts.ts', ['ZavorthAgentCapabilityAssimilationContract']],
    ['src/sdk/index.ts', ['ZavorthAgentCapabilityAssimilationService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('assimilation-markers', 'Intent model markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'matrix contract, service, SDK and CLI markers exist', missing);
}

function runMatrixFixture() {
  const result = runTs('scripts/zavorth-agent-capability-assimilation.ts', ['--json']);
  return jsonRule('assimilation-matrix-fixture', 'Assimilation matrix builds', result, (snapshot) =>
    snapshot.contractVersion === '2026-05-11.agent-capability-assimilation-checkpoint-1'
    && snapshot.status === 'attention'
    && snapshot.summary.items >= 10
    && snapshot.summary.categoriesCovered === 9
    && snapshot.summary.externalProductNamesInPublicCore === 0
    && snapshot.guarantees.noExternalSourceCodeCopied === true
    && snapshot.guarantees.noExternalPromptsCopied === true
    && snapshot.matrix.every((item) =>
      item.publicNaming.usesExternalProductName === false
      && item.implementationBoundary.copyExternalCode === false
      && item.implementationBoundary.copyExternalPrompts === false
      && item.implementationBoundary.absorbPatternOnly === true));
}

function runFilteredFixture() {
  const result = runTs('scripts/zavorth-agent-capability-assimilation.ts', ['--json', '--category=security-governance', '--status=rejected']);
  return jsonRule('assimilation-filter-fixture', 'Assimilation CLI filters matrix', result, (snapshot) =>
    snapshot.matrix.length === 1
    && snapshot.matrix[0].id === 'raw-reasoning-copy'
    && snapshot.matrix[0].risk.level === 'forbidden');
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-agent-capability-assimilation-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes assimilation gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function ruleNoPublicExternalNames() {
  const files = [
    'src/contracts/ZavorthAgentCapabilityAssimilationContract.ts',
    'src/services/ZavorthAgentCapabilityAssimilationService.ts',
    'scripts/zavorth-agent-capability-assimilation.ts',
  ];
  const forbidden = [
    'ThirdPartyAgent',
    'Claude Code',
    'ZavorthBridge',
  ];
  const hits = [];
  for (const file of files) {
    const text = read(file);
    for (const word of forbidden) {
      if (text.includes(word)) hits.push(`${file}: ${word}`);
    }
  }
  return rule('no-public-external-names', 'Public core uses neutral reference profiles', hits.length === 0, hits.length === 0 ? 'neutral' : `${hits.length} hit(s)`, 'no external product names in public core files', hits);
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
    const snapshot = JSON.parse(result.stdout);
    const passed = expect(snapshot);
    return rule(id, label, passed, `status=${snapshot.status}; items=${snapshot.summary?.items ?? snapshot.matrix?.length ?? 'n/a'}`, 'expected Intent model matrix', passed ? [] : [JSON.stringify(snapshot, null, 2)]);
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
