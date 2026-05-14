#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runCertificationFixture(),
  runProjectionFixture(),
  runTextFixture(),
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
  console.log('[zavorth-perception-certification] checking Phase 6');
  printRules(rules, '[zavorth-perception-certification]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthPerceptionCrossSurfaceCertificationContract.ts',
    'src/services/ZavorthPerceptionCrossSurfaceCertificationService.ts',
    'scripts/zavorth-perception-certification.ts',
    'scripts/zavorth-perception-certification-check.mjs',
    'tests/domain/surface/PerceptionCrossSurfaceCertificationService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('perception-certification-files', 'Perception certification files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'all Phase 6 files present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthPerceptionCrossSurfaceCertificationContract.ts', ['pc-screenshot', 'browser-dom', 'adb-ui-dump', 'ZavorthPerceptionCommandCenterProjection', 'visualMutationApplied: false']],
    ['src/services/ZavorthPerceptionCrossSurfaceCertificationService.ts', ['ZavorthPerceptionCrossSurfaceCertificationService', 'Command Center projection carries read-only targets', 'live canary exige flag', 'REQUIRED_COMMANDS']],
    ['scripts/zavorth-perception-certification.ts', ['--json', 'formatSnapshotText']],
    ['src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts', ['perceptionControl']],
    ['src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts', ['mapPerceptionControlProjection', 'perceptionControl']],
    ['package.json', ['node scripts/zavorth-perception-certification-check.mjs']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('perception-certification-markers', 'Perception certification markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service, projection and workspace gate markers', missing);
}

function runCertificationFixture() {
  const result = runTs('scripts/zavorth-perception-certification.ts', ['--json']);
  return jsonRule('perception-certification-fixture', 'Certification matrix passes all mock-safe scenarios', result, (snapshot) => {
    const ids = snapshot.certificationMatrix?.map((row) => row.id) || [];
    return snapshot.status === 'passed'
      && ids.includes('pc-screenshot')
      && ids.includes('browser-dom')
      && ids.includes('browser-screenshot')
      && ids.includes('adb-screenshot')
      && ids.includes('adb-ui-dump')
      && ids.includes('blocked-terminal-automation')
      && ids.includes('blocked-secrets-screen')
      && ids.includes('approval-required-tap-type-click')
      && ids.includes('cancel-pause')
      && ids.includes('receipts-retention')
      && snapshot.certificationMatrix.every((row) => row.status === 'passed');
  });
}

function runProjectionFixture() {
  const result = runTs('scripts/zavorth-perception-certification.ts', ['--json']);
  return jsonRule('perception-command-center-projection-fixture', 'Command Center/API projection exposes targets, approvals and redacted artifacts', result, (snapshot) =>
    snapshot.commandCenterProjection?.surface?.visualMutationApplied === false
    && snapshot.commandCenterProjection.targets.length >= 4
    && snapshot.commandCenterProjection.pendingPlans.some((plan) => plan.status === 'approval-required')
    && snapshot.commandCenterProjection.approvals.length >= 1
    && snapshot.commandCenterProjection.artifacts.every((artifact) => artifact.redacted === true && artifact.rawContentStored === false)
    && snapshot.commandCenterProjection.liveSafetyStatus.explicitApprovalRequired === true
    && snapshot.liveCanary.enabled === false);
}

function runTextFixture() {
  const result = runTs('scripts/zavorth-perception-certification.ts', []);
  const output = `${result.stdout}\n${result.stderr}`;
  const passed = result.status === 0
    && output.includes('Zavorth Perception Cross-Surface Certification - Phase 6')
    && output.includes('/vision status')
    && output.includes('/computer approve <plan>')
    && output.includes('/device screenshot');
  return rule('perception-certification-text-fixture', 'CLI renders dense text command table', passed, passed ? 'dense text rendered' : `exit ${result.status ?? 'unknown'}`, 'operator text includes table and commands', passed ? [] : compact(output));
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
    const parsed = JSON.parse(result.stdout);
    const passed = expect(parsed);
    return rule(id, label, passed, `status=${parsed.status}; matrix=${parsed.certificationMatrix?.length ?? 0}`, 'expected Phase 6 certification behavior', passed ? [] : [JSON.stringify(parsed, null, 2)]);
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
