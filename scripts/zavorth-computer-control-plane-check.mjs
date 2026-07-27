#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runObserveFixture(),
  runPlanApprovalFixture(),
  runTerminalBlockFixture(),
  runPasswordManagerBlockFixture(),
  runRedactionFixture(),
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
  console.log('[zavorth-computer-control-plane] checking Approval gate');
  printRules(rules, '[zavorth-computer-control-plane]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthComputerControlPlaneContract.ts',
    'src/services/ZavorthComputerControlPlaneService.ts',
    'scripts/zavorth-computer-control-plane.ts',
    'scripts/zavorth-computer-control-plane-check.mjs',
    'tests/domain/surface/ComputerControlPlaneService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('computer-control-files', 'Computer control plane files exist', missing.length === 0, `${files.length ? missing.length}/${files.length}`, 'all Approval gate files present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthComputerControlPlaneContract.ts', ['computer.observe', 'computer.plan', 'computer.approve', 'terminalAutomationBlocked', 'runDialogBlocked', 'previewBeforeClickOrTyping', 'liveMutationPerformed: false']],
    ['src/services/ZavorthComputerControlPlaneService.ts', ['ComputerUseWatchModeService', 'terminal', 'password-manager', 'file-manager-outside-workspace', 'banking-or-payment', 'seed-phrase-or-wallet', 'mfa-or-auth', 'preview before click or typing']],
    ['src/domain/surface/presentation/shared-surface/SharedSurfaceEcosystemCommandPack.ts', ['ZavorthComputerControlPlaneService', 'handleComputer', 'parseComputerCommand', 'ZavorthPerceptionInvocationRouter', '/computer']],
    ['src/services/SharedSurfaceCommandContract.ts', ["discordSlashName: 'computer'", 'desktop computer control plane governado']],
    ['package.json', ['node scripts/zavorth-computer-control-plane-check.mjs']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('computer-control-markers', 'Computer control markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service and shared commands are wired', missing);
}

function runObserveFixture() {
  const result = runTs('scripts/zavorth-computer-control-plane.ts', [
    '--json',
    '--action', 'observe',
    '--window', 'Notepad',
    '--screen', 'Normal screen without secrets',
  ]);
  return jsonRule('computer-observe-fixture', 'Observe is read-only and mutation-free', result, (snapshot) =>
    ['ready', 'watch-mode-ready'].includes(snapshot.status)
    && snapshot.policy?.decision === 'allow_readonly'
    && snapshot.plan?.steps?.some((step) => step.kind === 'screenshot')
    && snapshot.plan?.mutationRequested === false
    && snapshot.safety?.liveMutationPerformed === false);
}

function runPlanApprovalFixture() {
  const result = runTs('scripts/zavorth-computer-control-plane.ts', [
    '--json',
    '--action', 'plan',
    '--window', 'Notepad',
    '--target-text', 'Salvar',
    'click the button salvar',
  ]);
  return jsonRule('computer-plan-approval-fixture', 'Click/type/key plans require approval', result, (snapshot) =>
    snapshot.status === 'approval-required'
    && snapshot.policy?.decision === 'require_owner_approval'
    && snapshot.plan?.approvalRequired === true
    && snapshot.plan?.steps?.some((step) => step.kind === 'click-element')
    && snapshot.safety?.previewBeforeClickOrTyping === true
    && snapshot.safety?.liveMutationPerformed === false);
}

function runTerminalBlockFixture() {
  const result = runTs('scripts/zavorth-computer-control-plane.ts', [
    '--json',
    '--action', 'observe',
    '--window', 'Windows PowerShell',
  ]);
  return jsonRule('computer-terminal-block-fixture', 'Terminal and shell windows are blocked', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.policy?.decision === 'deny'
    && snapshot.hardBlocks?.risks?.includes('terminal')
    && snapshot.safety?.terminalAutomationBlocked === true,
  { allowNonZero: true });
}

function runPasswordManagerBlockFixture() {
  const result = runTs('scripts/zavorth-computer-control-plane.ts', [
    '--json',
    '--action', 'plan',
    '--window', 'Bitwarden',
    'clique para copiar senha',
  ]);
  return jsonRule('computer-password-manager-block-fixture', 'Password manager surfaces are blocked', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.policy?.decision === 'deny'
    && snapshot.hardBlocks?.risks?.includes('password-manager')
    && snapshot.safety?.passwordManagersBlocked === true,
  { allowNonZero: true });
}

function runRedactionFixture() {
  const secret = 'sk-' + 'computerControlSecret999';
  const result = runTs('scripts/zavorth-computer-control-plane.ts', [
    '--json',
    '--action', 'observe',
    '--window', 'Notepad',
    '--screen', `token=abc123456789 ${secret}`,
  ]);
  return jsonRule('computer-redaction-fixture', 'Screen evidence is redacted before serialization', result, (snapshot, raw) =>
    snapshot.status === 'redacted'
    && snapshot.policy?.decision === 'allow_with_redaction'
    && snapshot.vision?.redaction?.applied === true
    && !raw.includes(secret)
    && !raw.includes('token=abc123456789')
    && raw.includes('[redacted-secret]'));
}

function runTs(script, args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    script,
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, label, result, expect, options = {}) {
  if (result.status !== 0 && !options.allowNonZero) {
    return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr, result.stdout));
  }
  try {
    const fixture = JSON.parse(result.stdout);
    const passed = expect(fixture, result.stdout);
    return rule(id, label, passed, `status=${fixture.status}; decision=${fixture.policy?.decision}`, 'expected safe Approval gate behavior', passed ? [] : [JSON.stringify(fixture, null, 2), ...compact(result.stderr)]);
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
