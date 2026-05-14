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
  runScreenshotPlanFixture(),
  runMutationApprovalFixture(),
  runInstallBlockFixture(),
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
  console.log('[zavorth-android-adb-bridge] checking Phase 4');
  printRules(rules, '[zavorth-android-adb-bridge]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthAndroidAdbBridgeContract.ts',
    'src/services/ZavorthAndroidAdbBridgeService.ts',
    'scripts/zavorth-android-adb-bridge.ts',
    'scripts/zavorth-android-adb-bridge-check.mjs',
    'tests/domain/surface/AndroidAdbBridgeService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('android-adb-files', 'Android ADB bridge files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'all Phase 4 files present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthAndroidAdbBridgeContract.ts', ['device.screenshot', 'device.ui_dump', 'device.plan', 'tapSwipeTextKeyRequireApproval', 'installUninstallBlockedByDefault', 'liveMutationPerformed: false']],
    ['src/services/ZavorthAndroidAdbBridgeService.ts', ['adb devices -l', 'exec-out', 'screencap', '-p', 'uiautomator', 'logcat', '-d', '-t', 'destructive ADB blocked']],
    ['src/domain/surface/application/shared-surface/SharedSurfaceEcosystemCommandPack.ts', ['ZavorthAndroidAdbBridgeService', 'handleDevice', 'parseDeviceCommand', 'ZavorthPerceptionInvocationRouter', '/device']],
    ['src/services/SharedSurfaceCommandContract.ts', ["discordSlashName: 'device'", 'Android ADB/device bridge governado']],
    ['package.json', ['node scripts/zavorth-android-adb-bridge-check.mjs']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('android-adb-markers', 'Android ADB markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service and shared commands are wired', missing);
}

function runObserveFixture() {
  const result = runTs('scripts/zavorth-android-adb-bridge.ts', [
    '--json',
    '--action', 'observe',
    '--screen', 'Tela do app aberta sem segredo',
    '--ui-xml', '<hierarchy><node text="CHECK" /></hierarchy>',
  ]);
  return jsonRule('android-observe-fixture', 'Observe is read-only and safe', result, (snapshot) =>
    snapshot.status === 'ready'
    && snapshot.policy?.decision === 'allow_readonly'
    && snapshot.plan?.mutationRequested === false
    && snapshot.safety?.readOnlyAdbOnlyWithoutApproval === true
    && snapshot.safety?.liveMutationPerformed === false);
}

function runScreenshotPlanFixture() {
  const result = runTs('scripts/zavorth-android-adb-bridge.ts', [
    '--json',
    '--action', 'screenshot',
    '--screen', 'Tela normal',
  ]);
  return jsonRule('android-screenshot-fixture', 'Screenshot is artifact-ref oriented', result, (snapshot) =>
    snapshot.status === 'ready'
    && snapshot.plan?.steps?.some((step) => step.kind === 'capture-screenshot')
    && snapshot.safety?.screenshotArtifactRefOnly === true
    && snapshot.safety?.noRawImageSerialized === true);
}

function runMutationApprovalFixture() {
  const result = runTs('scripts/zavorth-android-adb-bridge.ts', [
    '--json',
    '--action', 'plan',
    '--target-text', 'CHECK',
    '--payload', 'texto aprovado',
    'toque no botao e digite o texto',
  ]);
  return jsonRule('android-mutation-approval-fixture', 'Tap/type/key plans require approval', result, (snapshot) =>
    snapshot.status === 'approval-required'
    && snapshot.policy?.decision === 'require_owner_approval'
    && snapshot.plan?.approvalRequired === true
    && snapshot.plan?.steps?.some((step) => step.kind === 'tap')
    && snapshot.plan?.steps?.some((step) => step.kind === 'type-text')
    && snapshot.safety?.tapSwipeTextKeyRequireApproval === true
    && snapshot.safety?.liveMutationPerformed === false);
}

function runInstallBlockFixture() {
  const result = runTs('scripts/zavorth-android-adb-bridge.ts', [
    '--json',
    '--action', 'plan',
    '--package', 'com.example.app',
    'instalar apk no celular',
  ]);
  return jsonRule('android-install-block-fixture', 'Install/uninstall is blocked by default', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.policy?.decision === 'deny'
    && snapshot.hardBlocks?.risks?.includes('install-uninstall')
    && snapshot.safety?.installUninstallBlockedByDefault === true,
  { allowNonZero: true });
}

function runRedactionFixture() {
  const secret = 'sk-' + 'androidAdbBridgeSecret999';
  const result = runTs('scripts/zavorth-android-adb-bridge.ts', [
    '--json',
    '--action', 'observe',
    '--screen', `token=abc123456789 ${secret}`,
    '--ui-xml', '<hierarchy><node text="status" /></hierarchy>',
  ]);
  return jsonRule('android-redaction-fixture', 'Android evidence is redacted before serialization', result, (snapshot, raw) =>
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
    return rule(id, label, passed, `status=${fixture.status}; decision=${fixture.policy?.decision}`, 'expected safe Phase 4 behavior', passed ? [] : [JSON.stringify(fixture, null, 2), ...compact(result.stderr)]);
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
