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
  runProvidedDiffFixture(),
  runApprovalGateFixture(),
  runCliAliasFixture(),
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
  console.log('[zavorth-agent-review] checking official Agent Review feature');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-agent-review] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/services/ZavorthAgentReviewService.ts',
    'scripts/zavorth-agent-review.ts',
    'scripts/zavorth-agent-review-check.mjs',
    'tests/services/ZavorthAgentReviewService.test.ts',
    'src/runtime/review/GovernedReviewService.ts',
    'src/runtime/review/GovernedReviewZavorthControlPresenter.ts',
    'package.json',
    'src/zavorth-cli.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'files-exist',
    label: 'Agent Review files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'service, CLI, check, tests and governed review kernel are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/services/ZavorthAgentReviewService.ts', [
      'zavorth-agent-review/1',
      'buildGovernedReviewZavorthControlSnapshot',
      'Read-only by default',
      'approvalRequiredFor',
      'heuristicFindingsGenerated',
      'review-board',
      'patchApplyMode',
    ]],
    ['scripts/zavorth-agent-review.ts', [
      'Zavorth Agent Review',
      '--post-comment',
      '--approval=<id>',
      'Read-only by default',
    ]],
    ['package.json', [
      'zavorth:agent-review',
      'zavorth:agent-review:check',
    ]],
    ['src/zavorth-cli.ts', [
      'runAgentReview',
      'agent-review',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    if (text === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return {
    id: 'markers',
    label: 'Agent Review safety markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'official feature stays read-only and approval-gated',
    details: missing,
  };
}

function runProvidedDiffFixture() {
  const fixture = path.join(root, 'tmp', 'zavorth-agent-review-fixture.diff');
  fs.mkdirSync(path.dirname(fixture), { recursive: true });
  fs.writeFileSync(fixture, [
    'diff --git a/src/auth.ts b/src/auth.ts',
    '@@ -1 +1 @@',
    '+console.log("token", token)',
  ].join('\n'));
  const result = runCli(['--json', '--target', 'provided', '--diff-file', fixture, '--objective', 'review auth token handling']);
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.surface === 'zavorth-agent-review'
    && snapshot?.command?.readOnlyDefault === true
    && snapshot?.evidence?.heuristicFindingsGenerated >= 1
    && snapshot?.visual?.layout === 'review-board'
    && snapshot?.visual?.patchApplyMode === 'approval-gated'
    && snapshot?.review?.verification?.acceptedFindingCount >= 1
    && snapshot?.review?.policy?.noMutationApplied === true;
  return {
    id: 'provided-diff-fixture',
    label: 'Agent Review reads provided diff and produces file findings',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, findings=${snapshot.review.verification.acceptedFindingCount}` : `exit ${result.status}`,
    target: 'diff review creates governed findings without mutation',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runApprovalGateFixture() {
  const fixture = path.join(root, 'tmp', 'zavorth-agent-review-approval.diff');
  fs.mkdirSync(path.dirname(fixture), { recursive: true });
  fs.writeFileSync(fixture, [
    'diff --git a/src/ui.tsx b/src/ui.tsx',
    '@@ -1 +1 @@',
    '+div.innerHTML = userHtml',
  ].join('\n'));
  const result = runCli(['--json', '--target', 'provided', '--diff-file', fixture, '--post-comment']);
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.review?.status === 'waiting_approval'
    && snapshot?.review?.execution?.status === 'approval-required'
    && snapshot?.review?.policy?.externalEgressNotPerformed === true
    && snapshot?.zavorthControl?.actions?.some((action) => action.id === 'comment-on-pr' && action.requiresApproval === true);
  return {
    id: 'approval-gate-fixture',
    label: 'Agent Review blocks PR comment without approval',
    status: ok ? 'passed' : 'failed',
    observed: ok ? snapshot.review.execution.status : `exit ${result.status}`,
    target: 'external comment path requires approval id and performs no egress',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runCliAliasFixture() {
  const result = spawnSync(process.execPath, [tsxCli, 'src/zavorth-cli.ts', 'agent-review', '--json', '--target', 'provided', '--objective', 'empty read-only review'], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.surface === 'zavorth-agent-review'
    && snapshot?.command?.aliases?.includes('zavorth review');
  return {
    id: 'cli-alias-fixture',
    label: 'Zavorth CLI exposes agent-review',
    status: ok ? 'passed' : 'failed',
    observed: ok ? snapshot.command.primary : `exit ${result.status}`,
    target: 'zavorth agent-review works through the product CLI',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runCli(args) {
  return spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-agent-review.ts', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
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
