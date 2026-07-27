#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const checks = [
  filesExist(),
  markerCheck(),
  statusFixture(),
  clickApprovalFixture(),
  privateTargetFixture(),
  computerPlanFixture(),
];

const failed = checks.filter((entry) => entry.status === 'failed');
const snapshot = {
  contractVersion: 'zavorth-native-browser-computer-use-check/1',
  generatedAt: new Date().toISOString(),
  status: failed.length ? 'failed' : 'passed',
  checks,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  for (const entry of checks) {
    console.log(`[native-browser-computer-use] ${entry.status === 'passed' ? 'ok' : 'fail'} ${entry.id}: ${entry.summary}`);
  }
}

if (failed.length) {
  process.exitCode = 1;
}

function filesExist() {
  const files = [
    'src/contracts/ZavorthNativeBrowserComputerUseContract.ts',
    'src/services/ZavorthNativeBrowserComputerUseService.ts',
    'scripts/zavorth-native-browser-computer-use.ts',
    'scripts/zavorth-native-browser-computer-use-check.mjs',
    'tests/services/ZavorthNativeBrowserComputerUseService.test.ts',
    'docs/runtime-engines-zcanvas.md',
  ];
  const missing = files.filter((file) => !existsSync(join(root, file)));
  return rule('files', missing.length === 0, `${files.length ? missing.length}/${files.length} files present`, missing);
}

function markerCheck() {
  const markers = [
    ['src/contracts/ZavorthNativeBrowserComputerUseContract.ts', [
      'browser.screenshot',
      'browser.click',
      'browser.type',
      'browser.extract',
      'policyByDomainOrSite',
      'visualReceiptsRequired',
    ]],
    ['src/services/ZavorthNativeBrowserComputerUseService.ts', [
      'RuntimeBrowserSidecarService',
      'ZavorthComputerControlPlaneService',
      'assertPublicHttpTargetAllowed',
      'noClickOrTypeWithoutApproval',
      'receiptsForVisualInteractions',
    ]],
    ['src/mcp/tools/AutomaticBrowserTool.ts', [
      'browser_screenshot',
      'browser_click',
      'browser_type',
      'browser_extract',
      'requireMutationApproval',
    ]],
    ['src/services/RuntimeBrowserSidecarService.ts', [
      'browser_screenshot',
      'browser_click',
      'browser_type',
      'browser_extract',
    ]],
    ['package.json', [
      'zavorth:native-browser-computer-use:check',
    ]],
    ['scripts/zavorth-product-readiness-gate.mjs', [
      'native-browser-computer-use',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of markers) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) {
        missing.push(`${file}: ${needle}`);
      }
    }
  }
  return rule('markers', missing.length === 0, missing.length ? `${missing.length} missing` : 'all markers found', missing);
}

function statusFixture() {
  const result = runTs(['--json', '--action', 'status']);
  return jsonRule('status-fixture', result, (snapshot) =>
    snapshot.contractVersion === '2026-05-24.native-browser-computer-use-phase-5'
    && snapshot.safety?.screenshotClickTypeExtractAreNative === true
    && snapshot.safety?.computerUseAdapterIsGoverned === true
    && snapshot.capabilities?.length >= 3);
}

function clickApprovalFixture() {
  const result = runTs([
    '--json',
    '--action', 'browser.click',
    '--url', 'https://example.com',
    '--selector', '#ok',
  ]);
  return jsonRule('click-approval-fixture', result, (snapshot) =>
    snapshot.status === 'approval-required'
    && snapshot.policy?.decision === 'require-owner-approval'
    && snapshot.safety?.noClickOrTypeWithoutApproval === true
    && snapshot.visualReceipts?.some((entry) => entry.kind === 'click' && entry.status === 'approval-required'));
}

function privateTargetFixture() {
  const result = runTs([
    '--json',
    '--action', 'browser.extract',
    '--url', 'http://127.0.0.1:9922/private',
  ]);
  return jsonRule('private-target-fixture', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.policy?.decision === 'deny'
    && snapshot.target?.domainPolicy === 'blocked'
    && snapshot.safety?.noPrivateNetworkByDefault === true,
  { allowNonZero: true });
}

function computerPlanFixture() {
  const result = runTs([
    '--json',
    '--action', 'computer.plan',
    '--target-kind', 'browser-tab',
    '--window', 'Example Browser',
    '--objective', 'click the visible button after approval',
  ]);
  return jsonRule('computer-plan-fixture', result, (snapshot) =>
    snapshot.computerUse?.adapter === 'ComputerUseAgent'
    && snapshot.computerUse?.controlPlane === 'ZavorthComputerControlPlaneService'
    && snapshot.receipts?.some((entry) => entry.kind === 'computer-use')
    && snapshot.safety?.receiptsForVisualInteractions === true);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-native-browser-computer-use.ts',
    ...args,
  ], {
    cwd: root,
    encoding: 'utf8',
  });
}

function jsonRule(id, result, predicate, options = {}) {
  if (result.status !== 0 && !options.allowNonZero) {
    return rule(id, false, result.stderr || result.stdout || `exit ${result.status}`, []);
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return rule(id, Boolean(predicate(parsed, result.stdout)), 'fixture output matches contract', parsed);
  } catch (error) {
    return rule(id, false, error instanceof Error ? error.message : String(error), {
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
}

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

function rule(id, ok, summary, detail) {
  return {
    id,
    status: ok ? 'passed' : 'failed',
    summary,
    detail,
  };
}
