#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [];
const requiredFiles = [
  'src/contracts/ZavorthSensitiveActionFlowContract.ts',
  'src/services/ZavorthSensitiveActionFlowService.ts',
  'scripts/zavorth-sensitive-action-flow.ts',
  'tests/services/ZavorthSensitiveActionFlowService.test.ts',
];

for (const file of requiredFiles) {
  rules.push({
    id: `file:${file}`,
    status: fs.existsSync(path.join(root, file)) ? 'passed' : 'failed',
    summary: `${file} exists`,
  });
}

const mutation = runFlow('edit src/index.ts and run npm test', []);
const approved = runFlow('edit src/index.ts', ['--decision=approve', '--sandbox-ready']);
const denied = runFlow('delete secrets.txt', ['--decision=deny']);
const readOnly = runFlow('review this repository', []);

if (mutation) {
  assertRule('mutation:needs-approval', mutation.status === 'needs_approval', 'Mutation preview requires approval');
  assertRule('mutation:receipt', mutation.receipt?.redaction?.rawSecretsPresent === false, 'Mutation flow emits redacted receipt');
  assertRule('mutation:rollback', mutation.rollback?.requiredBeforeApply === true, 'Mutation flow requires rollback before apply');
  assertRule('mutation:no-zavorthControl-authority', mutation.zavorthControlProjection?.executionAuthority === false, 'ZavorthControl has no execution authority');
}
if (approved) {
  assertRule('approved:sandbox-ready', approved.status === 'approved_ready', 'Approved mutation with sandbox becomes ready for governed executor');
  assertRule('approved:not-executed', approved.execution?.executed === false, 'Projection does not execute live action itself');
}
if (denied) {
  assertRule('denied:blocked', denied.status === 'denied', 'Denied action stays blocked');
}
if (readOnly) {
  assertRule('readonly:ready', readOnly.status === 'read_only_ready', 'Read-only request is ready without approval');
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
  console.log('[sensitive-action-flow] certification');
  for (const rule of rules) {
    console.log(`[sensitive-action-flow] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runFlow(request, extraArgs) {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-sensitive-action-flow.ts', '--json', `--request=${request}`, ...extraArgs]
      : ['tsx', 'scripts/zavorth-sensitive-action-flow.ts', '--json', `--request=${request}`, ...extraArgs];
    const output = execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(output);
  } catch (error) {
    rules.push({
      id: `script:${request}`,
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
