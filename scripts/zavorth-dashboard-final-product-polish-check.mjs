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
  console.log('[zavorth-dashboard-final-product-polish] checking Intent model1');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-dashboard-final-product-polish] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 20)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthDashboardFinalProductPolishContract.ts',
    'src/services/ZavorthDashboardFinalProductPolishService.ts',
    'scripts/zavorth-dashboard-final-product-polish.ts',
    'scripts/zavorth-dashboard-final-product-polish-check.mjs',
    'tests/services/ZavorthDashboardFinalProductPolishService.test.ts',
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
    ['src/zavorth-control/app/(dashboard)/dashboard/page.tsx', [
      'HomePageClient',
    ]],
    ['src/zavorth-control/app/(dashboard)/dashboard/HomePageClient.tsx', [
      'providerSignal',
      'approvalsSignal',
      'runtimeGuidedFixes',
      '/api/runtime/readiness',
      '/api/system/version',
      'Approvals appear here',
      'swarmSnapshot',
    ]],
    ['src/zavorth-control/shared/constants/sidebarVisibility.ts', [
      'href: "/dashboard"',
      'href: "/dashboard/providers"',
      'href: "/dashboard/skills"',
    ]],
    ['src/contracts/ZavorthDashboardFinalProductPolishContract.ts', [
      'ZAVORTH_DASHBOARD_FINAL_PRODUCT_POLISH_CONTRACT_VERSION',
      'chatFirstHome',
      'advancedModeCollapsed',
      'dashboardCanExecute: false',
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
    'Dashboard polish markers are wired',
    missing.length === 0,
    missing.length === 0 ? 'all markers' : `${missing.length} missing`,
    'chat-first, next actions, approvals, receipts, timeline, advanced and responsive markers exist',
    missing,
  );
}

function rulePackageScripts() {
  const pkg = JSON.parse(read('package.json') || '{}');
  const scripts = pkg.scripts || {};
  const required = [
    'zavorth:dashboard-final-product-polish',
    'zavorth:dashboard-final-product-polish:json',
    'zavorth:dashboard-final-product-polish:check',
    'qa:zavorth-dashboard-final-product-polish',
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
  const marker = 'zavorth:dashboard-final-product-polish:check';
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
    'scripts/zavorth-dashboard-final-product-polish.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return rule('snapshot', 'Dashboard polish snapshot runs', false, `exit=${result.status}`, 'status=passed', [
      result.error?.message || result.stderr || result.stdout || 'no output',
    ]);
  }
  const data = parseJson(result.stdout);
  const pass = data
    && data.contractVersion === '2026-05-14.checkpoint-11-dashboard-final-product-polish'
    && data.status === 'passed'
    && data.summary?.dashboardPath === '/dashboard'
    && data.summary?.chatFirstHome === true
    && data.summary?.nextActionsReady === true
    && data.summary?.readinessSummaryReady === true
    && data.summary?.approvalsInboxReady === true
    && data.summary?.receiptsViewerReady === true
    && data.summary?.missionTimelineReady === true
    && data.summary?.advancedModeCollapsed === true
    && data.summary?.mobileResponsive === true
    && data.summary?.noControlSurfaceByDefault === true
    && data.summary?.dashboardCanExecute === false
    && data.summary?.rawSecretsSerialized === false;
  return rule(
    'snapshot',
    'Dashboard polish snapshot runs',
    pass,
    data ? `status=${data.status}; entries=${data.summary?.entries}` : 'invalid json',
    'daily-use /dashboard is simple by default and safe by design',
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
