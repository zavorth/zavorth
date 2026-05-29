#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const rules = [
  ruleFilesExist(),
  ruleContainsMarkers(),
  rulePackageScripts(),
  ruleWorkspaceCheck(),
  ruleSnapshot(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: { rules: rules.length, passed: rules.length - failed.length, failed: failed.length },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-perception-device-control-completion] checking Intent model0');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-perception-device-control-completion] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 20)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthPerceptionDeviceControlCompletionContract.ts',
    'src/services/ZavorthPerceptionDeviceControlCompletionService.ts',
    'scripts/zavorth-perception-device-control-completion.ts',
    'scripts/zavorth-perception-device-control-completion-check.mjs',
    'tests/services/ZavorthPerceptionDeviceControlCompletionService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule(
    'checkpoint-10-files',
    'Intent model0 files exist',
    missing.length === 0,
    `${files.length - missing.length}/${files.length}`,
    'contract, service, CLI, check and tests are present',
    missing,
  );
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthPerceptionDeviceControlCompletionContract.ts', [
      'ZAVORTH_PERCEPTION_DEVICE_CONTROL_COMPLETION_CONTRACT_VERSION',
      'pcScreenshotReadOnlyReady',
      'browserControlPolicyGated',
      'androidControlPolicyGated',
      'visualArtifactsInReceipts',
      'rawSecretsSerialized: false',
    ]],
    ['src/services/ZavorthPerceptionDeviceControlCompletionService.ts', [
      'look at my screen',
      'check this website visually',
      'look at my connected phone',
      'tap/type on my phone to fix this',
      'blocked-terminal-automation',
      'blocked-secrets-screen',
      'approval-required-tap-type-click',
      'noLiveDeviceMutationDuringCertification',
    ]],
    ['tests/services/ZavorthPerceptionDeviceControlCompletionService.test.ts', [
      'PC screenshot/read-only vision',
      'Android ADB observe/read-only evidence',
      'tap/type/click/install/zavorthControl',
    ]],
  ];
  const missing = [];
  for (const [file, markers] of checks) {
    const text = read(file);
    if (text === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const marker of markers) {
      if (!text.includes(marker)) missing.push(`${file}: missing ${marker}`);
    }
  }
  return rule(
    'checkpoint-10-markers',
    'Intent model0 markers are wired',
    missing.length === 0,
    missing.length === 0 ? 'all markers' : `${missing.length} missing`,
    'PC/browser/Android/natural command/artifact/safety markers exist',
    missing,
  );
}

function rulePackageScripts() {
  const pkg = JSON.parse(read('package.json') || '{}');
  const scripts = pkg.scripts || {};
  const required = [
    'zavorth:perception-device-control-completion',
    'zavorth:perception-device-control-completion:json',
    'zavorth:perception-device-control-completion:check',
    'qa:zavorth-perception-device-control-completion',
  ];
  const missing = required.filter((script) => !scripts[script]);
  return rule(
    'package-scripts',
    'Package scripts are wired',
    missing.length === 0,
    missing.length === 0 ? 'all scripts' : `${missing.length} missing`,
    required.join(', '),
    missing,
  );
}

function ruleWorkspaceCheck() {
  const text = read('package.json') || '';
  const marker = 'zavorth:perception-device-control-completion:check';
  return rule(
    'workspace-check',
    'workspace:check includes Intent model0 gate',
    text.includes(marker),
    text.includes(marker) ? 'wired' : 'missing',
    marker,
    [],
  );
}

function ruleSnapshot() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-perception-device-control-completion.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return rule('snapshot', 'Completion snapshot runs', false, `exit=${result.status}`, 'status=passed', [
      result.error?.message || result.stderr || result.stdout || 'no output',
    ]);
  }
  const data = parseJson(result.stdout);
  const pass = data
    && data.contractVersion === '2026-05-14.checkpoint-10-perception-device-control-completion'
    && data.status === 'passed'
    && data.summary?.pcScreenshotReadOnlyReady === true
    && data.summary?.browserViewReady === true
    && data.summary?.browserControlPolicyGated === true
    && data.summary?.androidObserveReady === true
    && data.summary?.androidControlPolicyGated === true
    && data.summary?.naturalRoutingReady === true
    && data.summary?.visualArtifactsInReceipts === true
    && data.summary?.rawSecretsSerialized === false
    && data.summary?.workspaceMutationPerformed === false
    && data.summary?.externalIoPerformed === false
    && data.safety?.terminalAutomationBypassBlocked === true
    && data.safety?.secretScreenAutomationBlocked === true
    && data.safety?.noLiveDeviceMutationDuringCertification === true;
  return rule(
    'snapshot',
    'Completion snapshot runs',
    pass,
    data ? `status=${data.status}; entries=${data.summary?.entries}` : 'invalid json',
    'perception/device completion with no unsafe default mutation',
    pass ? [] : [result.stdout],
  );
}

function rule(id, label, passed, observed, target, details = []) {
  return {
    id,
    label,
    status: passed ? 'passed' : 'failed',
    observed,
    target,
    details,
  };
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return null;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
