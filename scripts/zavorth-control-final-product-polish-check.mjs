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
  console.log('[zavorth-control-final-product-polish] checking Intent model1');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-control-final-product-polish] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 20)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthControlFinalProductPolishContract.ts',
    'src/services/ZavorthControlFinalProductPolishService.ts',
    'scripts/zavorth-control-final-product-polish.ts',
    'scripts/zavorth-control-final-product-polish-check.mjs',
    'tests/services/ZavorthControlFinalProductPolishService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule(
    'checkpoint-11-files',
    'Intent model1 files exist',
    missing.length === 0,
    `${files.length - missing.length}/${files.length}`,
    'contract, service, CLI, check and tests are present',
    missing,
  );
}

function ruleContainsMarkers() {
  const checks = [
    ['src/zavorth-control/app/(zavorthControl)/control/page.tsx', [
      'ControlPageClient',
      'force-dynamic',
    ]],
    ['src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlControlShell.tsx', [
      'activeSectorId === "chat"',
      'ZavorthControlChatSurface',
      'handleSelectSector',
      'sectorId === "instances"',
      'sectorId === "config"',
      'sectorId === "docs"',
    ]],
    ['src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlChatSurface.tsx', [
      'bcc-compose',
      'onResolveApproval',
      'Message for Zavorth',
      'bcc-event-stream',
    ]],
    ['src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlContextRail.tsx', [
      'ZavorthControlTaskTimeline',
      'Aguardando sua revisao',
      'View receipt',
      'projection-only',
    ]],
    ['src/zavorth-control/app/(zavorthControl)/control/zavorth-control/styles/zavorthControl.css', [
      'bcc-control-grid--chat',
      '@media (max-width: 700px)',
      'bcc-dock',
    ]],
    ['src/zavorth-control/proxy.ts', [
      'redirectZavorthControlPathToControl',
      'zavorthControlSectorForPath',
    ]],
    ['src/contracts/ZavorthControlFinalProductPolishContract.ts', [
      'ZAVORTH_CONTROL_FINAL_PRODUCT_POLISH_CONTRACT_VERSION',
      'chatFirstHome',
      'advancedModeCollapsed',
      'zavorthControlCanExecute: false',
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
    'checkpoint-11-markers',
    'ZavorthControl native polish markers are wired',
    missing.length === 0,
    missing.length === 0 ? 'all markers' : `${missing.length} missing`,
    'Zavorth Control native route, shell, chat, approvals, receipts, config, docs and responsive markers exist',
    missing,
  );
}

function rulePackageScripts() {
  const pkg = JSON.parse(read('package.json') || '{}');
  const scripts = pkg.scripts || {};
  const required = [
    'zavorth:zavorthControl-final-product-polish',
    'zavorth:zavorthControl-final-product-polish:json',
    'zavorth:zavorthControl-final-product-polish:check',
    'qa:zavorth-control-final-product-polish',
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
  const marker = 'zavorth:zavorthControl-final-product-polish:check';
  return rule(
    'workspace-check',
    'workspace:check includes Intent model1 gate',
    text.includes(marker),
    text.includes(marker) ? 'wired' : 'missing',
    marker,
    [],
  );
}

function ruleSnapshot() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-control-final-product-polish.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return rule('snapshot', 'ZavorthControl polish snapshot runs', false, `exit=${result.status}`, 'status=passed', [
      result.error?.message || result.stderr || result.stdout || 'no output',
    ]);
  }
  const data = parseJson(result.stdout);
  const pass = data
    && data.contractVersion === '2026-05-14.checkpoint-11-zavorthControl-final-product-polish'
    && data.status === 'passed'
    && data.summary?.zavorthControlPath === '/control'
    && data.summary?.chatFirstHome === true
    && data.summary?.nextActionsReady === true
    && data.summary?.readinessSummaryReady === true
    && data.summary?.approvalsInboxReady === true
    && data.summary?.receiptsViewerReady === true
    && data.summary?.missionTimelineReady === true
    && data.summary?.advancedModeCollapsed === true
    && data.summary?.mobileResponsive === true
    && data.summary?.noControlSurfaceByDefault === true
    && data.summary?.zavorthControlCanExecute === false
    && data.summary?.rawSecretsSerialized === false;
  return rule(
    'snapshot',
    'ZavorthControl polish snapshot runs',
    pass,
    data ? `status=${data.status}; entries=${data.summary?.entries}` : 'invalid json',
    'daily-use /control Zavorth Control is simple by default and safe by design',
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
