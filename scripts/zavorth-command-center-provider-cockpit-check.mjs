#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [];
const requiredFiles = [
  'src/contracts/ZavorthCommandCenterProviderCockpitContract.ts',
  'src/services/ZavorthCommandCenterProviderCockpitService.ts',
  'scripts/zavorth-command-center-provider-cockpit.ts',
  'tests/services/ZavorthCommandCenterProviderCockpitService.test.ts',
];

for (const file of requiredFiles) {
  rules.push({
    id: `file:${file}`,
    status: fs.existsSync(path.join(root, file)) ? 'passed' : 'failed',
    summary: `${file} exists`,
  });
}

const projection = runCockpit(['--json']);

if (projection) {
  assertRule('contract:version', projection.contractVersion === '2026-05-13.checkpoint-6', 'Command Center provider cockpit contract is current');
  assertRule('surface:cockpit', projection.surface === 'command-center-provider-cockpit', 'Provider cockpit projection surface is exposed');
  assertRule('policy:no-execution', projection.executionAuthority === false, 'Command Center provider cockpit cannot execute provider calls');
  assertRule('policy:no-visual-mutation', projection.visualMutationApplied === false, 'Provider cockpit does not mutate dashboard visuals without approval');
  assertRule('cards:present', Array.isArray(projection.cards) && projection.cards.length > 0, 'Provider cockpit cards are projected');
  assertRule('actions:projected', projection.actions?.some((entry) => entry.id === 'providers:live-selected'), 'Provider live action is projected');
  assertRule('actions:no-dashboard-execute', projection.actions?.every((entry) => entry.dashboardCanExecute === false) && projection.cards?.every((card) => card.actions.every((entry) => entry.dashboardCanExecute === false)), 'Projected actions are not dashboard execution authority');
  assertRule('safety:no-secrets', !JSON.stringify(projection).match(/sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}/), 'Provider cockpit does not serialize raw provider secrets');
  assertRule('projection:visual-approval', projection.commandCenterProjection?.visualApprovalRequired === true, 'Visual rendering remains approval-gated');
}

const failed = rules.filter((rule) => rule.status === 'failed');
const result = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('[command-center-provider-cockpit] certification');
  for (const rule of rules) {
    console.log(`[command-center-provider-cockpit] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runCockpit(args) {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const fullArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-command-center-provider-cockpit.ts', ...args]
      : ['tsx', 'scripts/zavorth-command-center-provider-cockpit.ts', ...args];
    const output = execFileSync(command, fullArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(output);
  } catch (error) {
    rules.push({
      id: 'script:provider-cockpit',
      status: 'failed',
      summary: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function assertRule(id, condition, summary) {
  rules.push({
    id,
    status: condition ? 'passed' : 'failed',
    summary,
  });
}
