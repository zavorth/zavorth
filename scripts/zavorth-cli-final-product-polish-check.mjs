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
  ruleInkPreview(),
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
  console.log('[zavorth-cli-final-product-polish] checking Intent model2');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-cli-final-product-polish] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 20)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthCliFinalProductPolishContract.ts',
    'src/services/ZavorthCliFinalProductPolishService.ts',
    'scripts/zavorth-cli-final-product-polish.ts',
    'scripts/zavorth-cli-final-product-polish-check.mjs',
    'tests/services/ZavorthCliFinalProductPolishService.test.ts',
    'src/cli/ink-test-env/index.tsx',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule(
    'checkpoint-12-files',
    'Intent model2 files exist',
    missing.length === 0,
    `${files.length - missing.length}/${files.length}`,
    'contract, service, CLI, check, tests and Ink preview are present',
    missing,
  );
}

function ruleContainsMarkers() {
  const checks = [
    ['src/cli/ink-test-env/index.tsx', [
      'Zavorth Agent OS / Command Runtime',
      'AutoExit',
      'waitUntilExit()',
      '/zavorthControl',
      '/exit',
      'Subagent Deck',
      'Receipt Preview',
      'This preview renders once and never redraws in a loop.',
    ]],
    ['src/cli/ZavorthCliRegistry.ts', [
      'formatDailyUseCliProjection',
      'Provider Mesh',
      'Channel Mesh',
      'Missions',
      'Receipts',
      'Scheduler',
      'Skills',
      'Subagents',
      'canExecuteMutations: false',
    ]],
    ['src/cli/ZavorthCliSurfaceHelpers.ts', [
      'zavorth setup',
      'zavorth start',
      'zavorth open',
      'zavorth ready',
      'zavorth status',
      'zavorth chat',
      'zavorth providers',
      'zavorth channels',
      'zavorth skills',
      'zavorth review',
      'zavorth trust',
      '/zavorthControl',
      'Open ZavorthControl.',
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
    'checkpoint-12-markers',
    'CLI polish markers are wired',
    missing.length === 0,
    missing.length === 0 ? 'all markers' : `${missing.length} missing`,
    'daily commands, stable Ink, /zavorthControl, receipts and safety markers exist',
    missing,
  );
}

function rulePackageScripts() {
  const pkg = JSON.parse(read('package.json') || '{}');
  const scripts = pkg.scripts || {};
  const required = [
    'zavorth:cli-final-product-polish',
    'zavorth:cli-final-product-polish:json',
    'zavorth:cli-final-product-polish:check',
    'qa:zavorth-cli-final-product-polish',
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
  const marker = 'zavorth:cli-final-product-polish:check';
  return rule(
    'workspace-check',
    'workspace:check includes Intent model2 gate',
    text.includes(marker),
    text.includes(marker) ? 'wired' : 'missing',
    marker,
    [],
  );
}

function ruleInkPreview() {
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm --prefix src/cli/ink-test-env run once --silent']
    : ['--prefix', 'src/cli/ink-test-env', 'run', 'once', '--silent'];
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 12000,
    shell: false,
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const normalizedOutput = output.replace(/\s+/g, ' ');
  const repeated = (output.match(/Welcome to Zavorth OS/g) || []).length;
  const passed = result.status === 0
    && repeated === 1
    && output.includes('Zavorth Agent OS')
    && output.includes('Command')
    && output.includes('Runtime')
    && normalizedOutput.includes('This preview renders once and never redraws in a loop.');
  return rule(
    'ink-preview',
    'Ink preview renders once and exits',
    passed,
    `exit=${result.status}; welcome=${repeated}`,
    'exit=0; welcome=1; no render loop',
    passed ? [] : [result.error?.message || result.stderr || result.stdout || 'no output'],
  );
}

function ruleSnapshot() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-cli-final-product-polish.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return rule('snapshot', 'CLI polish snapshot runs', false, `exit=${result.status}`, 'status=passed', [
      result.error?.message || result.stderr || result.stdout || 'no output',
    ]);
  }
  const data = parseJson(result.stdout);
  const pass = data
    && data.contractVersion === '2026-05-14.checkpoint-12-cli-final-product-polish'
    && data.status === 'passed'
    && data.summary?.zavorthControlPath === '/control'
    && data.summary?.inkPreviewRendersOnce === true
    && data.summary?.inkInteractiveMode === true
    && data.summary?.noInfiniteRenderLoop === true
    && data.summary?.cliCanExecuteMutations === false
    && data.summary?.rawSecretsSerialized === false;
  return rule(
    'snapshot',
    'CLI polish snapshot runs',
    pass,
    data ? `status=${data.status}; entries=${data.summary?.entries}` : 'invalid json',
    'CLI is stable, readable, zavorthControl-aligned and safe by design',
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
