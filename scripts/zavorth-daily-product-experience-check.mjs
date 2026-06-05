#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  filesExist(),
  markersPresent(),
  cliFixture(),
  languageFixture(),
  dashboardWire(),
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
  for (const rule of rules) {
    console.log(`[zavorth-daily-product-experience] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}
if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ZavorthDailyProductExperienceContract.ts',
    'src/services/ZavorthDailyProductExperienceService.ts',
    'scripts/zavorth-daily-product-experience.ts',
    'scripts/zavorth-daily-product-experience-check.mjs',
    'tests/services/ZavorthDailyProductExperienceService.test.ts',
    'docs/daily-use-trail.md',
    'docs/product-direction.md',
    'docs/web-zavorthControl.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', missing.length === 0, `${files.length - missing.length}/${files.length} files`, missing);
}

function markersPresent() {
  const checks = [
    ['src/services/ZavorthDailyProductExperienceService.ts', [
      'Start guided',
      'Daily loop',
      'Review center',
      'plain-product-language',
      'daily-product-experience',
      'projectionOnly',
      'approval fatigue',
    ]],
    ['src/sdk/contracts.ts', ['ZavorthDailyProductExperienceContract']],
    ['src/sdk/index.ts', ['ZavorthDailyProductExperienceService']],
    ['package.json', ['zavorth:daily-product-experience:check']],
    ['docs/daily-use-trail.md', ['zavorth:daily-product-experience']],
    ['docs/product-direction.md', ['zavorth:daily-product-experience:check']],
    ['docs/web-zavorthControl.md', ['daily-product-experience']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) if (!text.includes(needle)) missing.push(`${file}: ${needle}`);
  }
  return rule('markers', missing.length === 0, missing.length ? `${missing.length} missing` : 'all markers', missing);
}

function cliFixture() {
  const result = runTs('scripts/zavorth-daily-product-experience.ts', [
    '--json',
    '--profile=creator',
    '--target=safe-8gb-desktop',
    '--base-prompt=Use short answers. token=secret-token sk-test-123',
  ]);

  return jsonRule('cli-fixture', result, (snapshot) =>
    snapshot.version === 'daily-product-experience/v1'
    && snapshot.dashboardProjection?.route === '/control'
    && snapshot.dashboardProjection?.renderMode === 'daily-product-experience'
    && snapshot.dashboardProjection?.cards?.length === 5
    && snapshot.dashboardProjection?.cards?.every((card) => card.executionAuthority === false && card.mutatesState === false)
    && snapshot.firstRun?.steps?.length === 8
    && snapshot.dailyLoop?.steps?.length === 7
    && snapshot.reviewCenter?.items?.length === 6
    && snapshot.safety?.projectionOnly === true
    && snapshot.safety?.noLiveActionExecuted === true
    && !JSON.stringify(snapshot).includes('secret-token')
    && !JSON.stringify(snapshot).includes('sk-test-123'));
}

function languageFixture() {
  const result = runTs('scripts/zavorth-daily-product-experience.ts', [
    '--profile=personal',
    '--base-prompt=token=secret-token',
  ]);
  const text = `${result.stdout}\n${result.stderr}`;
  return rule(
    'language',
    result.status === 0
      && text.includes('Start guided')
      && text.includes('Daily loop')
      && text.includes('Review center')
      && !/transaction plane|policy broker|ledger|quarantine/i.test(text)
      && !text.includes('secret-token'),
    result.status === 0 ? 'plain product language' : `exit=${result.status}`,
    [text],
  );
}

function dashboardWire() {
  const files = [
    'src/ai-gateway/app/(zavorthControl)/control/TerminalInboxSector.tsx',
    'src/ai-gateway/app/(zavorthControl)/control/TerminalInboxSector.tsx',
    'apps/zavorth-control-vite-shell/public/styles/chat.css',
    'src/ai-gateway/public/zavorth-control-vite-shell/styles/chat.css',
  ];
  const missing = [];
  for (const file of files) {
    const text = read(file);
    const needles = file.endsWith('.css')
      ? ['.daily-product-experience-strip', '.daily-product-experience-card']
      : ['data-daily-product-experience', 'dailyProductExperienceCards', 'Start guided', 'Review center'];
    for (const needle of needles) if (!text.includes(needle)) missing.push(`${file}: ${needle}`);
  }
  return rule('dashboard-wire', missing.length === 0, missing.length ? `${missing.length} missing` : 'wired', missing);
}

function runTs(script, args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    script,
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, result, predicate) {
  if (!result.stdout.trim()) return rule(id, false, `empty output: ${result.stderr}`, []);
  try {
    const parsed = JSON.parse(result.stdout);
    return rule(id, Boolean(predicate(parsed)), `status=${parsed.status}`, []);
  } catch (error) {
    return rule(id, false, String(error), [result.stdout, result.stderr]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, passed, summary, details) {
  return { id, status: passed ? 'passed' : 'failed', summary, details };
}
