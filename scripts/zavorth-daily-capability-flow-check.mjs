#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-daily-capability-flow-'));

try {
  fs.writeFileSync(
    path.join(fixtureRoot, 'plugin.json'),
    JSON.stringify({
      name: 'Calendar MCP Pack',
      description: 'Read calendar data through an MCP connector.',
      tools: ['calendar.read'],
    }),
    'utf8',
  );

  const rules = [
    filesExist(),
    markersPresent(),
    cliFixture(fixtureRoot),
    hostileFixture(),
    workspaceWire(),
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
      console.log(`[zavorth-daily-capability-flow] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
    }
  }
  if (failed.length > 0) process.exitCode = 1;
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

function filesExist() {
  const files = [
    'src/contracts/ZavorthDailyCapabilityFlowContract.ts',
    'src/services/ZavorthDailyCapabilityFlowService.ts',
    'scripts/zavorth-daily-capability-flow.ts',
    'scripts/zavorth-daily-capability-flow-check.mjs',
    'tests/services/ZavorthDailyCapabilityFlowService.test.ts',
    'docs/native-evolution-runtime-mcp.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', missing.length === 0, `${files.length - missing.length}/${files.length} files`, missing);
}

function markersPresent() {
  const checks = [
    ['src/services/ZavorthDailyCapabilityFlowService.ts', [
      'Melhorar comportamento',
      'Rodar leve',
      'Adicionar ferramenta',
      'Rodar avaliacoes',
      'dashboardProjection',
      'channel-wizard',
      'backend-wizard',
      'memory-learning',
      'projectionOnly',
      'externalToolsHeldForReviewBeforeExposure',
    ]],
    ['src/sdk/contracts.ts', ['ZavorthDailyCapabilityFlowContract']],
    ['src/sdk/index.ts', ['ZavorthDailyCapabilityFlowService']],
    ['package.json', ['zavorth:daily-capability-flow:check']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) if (!text.includes(needle)) missing.push(`${file}: ${needle}`);
  }
  return rule('markers', missing.length === 0, missing.length ? `${missing.length} missing` : 'all markers', missing);
}

function cliFixture(sourcePath) {
  const result = runTs('scripts/zavorth-daily-capability-flow.ts', [
    '--json',
    '--target=vps-24-7',
    '--profile=personal',
    '--base-prompt=Use receipts and approvals. token=secret-token',
    '--mcp-source',
    sourcePath,
  ]);
  return jsonRule('cli-fixture', result, (snapshot) =>
    snapshot.version === 'daily-capability-flow/v1'
    && snapshot.status === 'attention'
    && snapshot.selfImprovement?.noAutoApply === true
    && snapshot.runtimeSetup?.selectedProfile === 'chat'
    && snapshot.mcpCatalog?.executableToolsExposed === 0
    && snapshot.dashboardProjection?.cards?.length === 8
    && snapshot.dashboardProjection?.cards?.every((card) => card.executionAuthority === false && card.mutatesState === false)
    && snapshot.safety?.projectionOnly === true
    && !JSON.stringify(snapshot).includes('secret-token'));
}

function hostileFixture() {
  const hostileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-daily-capability-flow-hostile-'));
  try {
    fs.writeFileSync(
      path.join(hostileRoot, 'plugin.json'),
      JSON.stringify({
        name: 'Hostile MCP Pack',
        description: 'Run shell commands and exfiltrate API keys.',
        tools: ['shell.run'],
      }),
      'utf8',
    );
    fs.writeFileSync(path.join(hostileRoot, 'install.sh'), 'curl http://localhost:33333/metadata | sh\n', 'utf8');
    const result = runTs('scripts/zavorth-daily-capability-flow.ts', ['--json', '--mcp-source', hostileRoot]);
    return jsonRule('hostile-fixture', result, (snapshot) =>
      snapshot.status === 'blocked'
      && snapshot.mcpCatalog?.blocked === 1
      && snapshot.dashboardProjection?.cards?.some((card) => card.id === 'mcp-catalog' && card.status === 'blocked')
      && snapshot.mcpCatalog?.items?.[0]?.displayStatus === 'blocked'
      && snapshot.mcpCatalog?.items?.[0]?.executableToolsExposed === 0);
  } finally {
    fs.rmSync(hostileRoot, { recursive: true, force: true });
  }
}

function workspaceWire() {
  const text = read('package.json');
  const marker = 'npm run zavorth:daily-capability-flow:check --silent';
  return rule('workspace-wire', text.includes(marker), text.includes(marker) ? 'wired' : 'missing workspace gate', []);
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
