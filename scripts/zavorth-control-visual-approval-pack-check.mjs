#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [];
const requiredFiles = [
  'src/contracts/ZavorthControlVisualApprovalPackContract.ts',
  'src/services/ZavorthControlVisualApprovalPackService.ts',
  'scripts/zavorth-control-visual-approval-pack.ts',
  'tests/services/ZavorthControlVisualApprovalPackService.test.ts',
];

for (const file of requiredFiles) {
  rules.push({
    id: `file:${file}`,
    status: fs.existsSync(path.join(root, file)) ? 'passed' : 'failed',
    summary: `${file} exists`,
  });
}

const pack = runPack(['--json', '--provider', 'openai', '--details-drawer']);

if (pack) {
  assertRule('contract:version', pack.contractVersion === '2026-05-13.checkpoint-7', 'Visual approval pack contract is current');
  assertRule('surface:pack', pack.surface === 'zavorthControl-visual-approval-pack', 'Visual approval surface is exposed');
  assertRule('approval:required', pack.approvalRequired === true && pack.approved === false, 'Owner approval is required and not auto-granted');
  assertRule('policy:no-visual-mutation', pack.visualMutationApplied === false, 'No zavorthControl visual mutation is applied');
  assertRule('policy:no-execution', pack.executionAuthority === false, 'Visual approval pack cannot execute provider calls');
  assertRule('blocks:proposal-only', pack.blocks?.length >= 2 && pack.blocks.every((block) => block.implementationStatus === 'proposal_only' && block.userVisible === false), 'Blocks are proposal-only and not user-visible');
  assertRule('blocks:owner-approval', pack.blocks?.every((block) => block.requiresOwnerApproval === true), 'Every visual block requires owner approval');
  assertRule('safety:no-secrets', !JSON.stringify(pack).match(/sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}/), 'Visual approval pack does not serialize raw provider secrets');
  assertRule('checklist:review', Array.isArray(pack.reviewChecklist) && pack.reviewChecklist.length >= 4, 'Review checklist is present');
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
  console.log('[zavorthControl-visual-approval-pack] certification');
  for (const rule of rules) {
    console.log(`[zavorthControl-visual-approval-pack] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runPack(args) {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const fullArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-control-visual-approval-pack.ts', ...args]
      : ['tsx', 'scripts/zavorth-control-visual-approval-pack.ts', ...args];
    const output = execFileSync(command, fullArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(output);
  } catch (error) {
    rules.push({
      id: 'script:visual-approval-pack',
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
