#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist(),
  ruleContainsMarkers(),
  runZavorthControlModelFixture(),
  runDryRunCanaryFixture(),
  runLiveApprovalRequiredFixture(),
  runLivePreparedFixture(),
  runBlockedGateFixture(),
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
  console.log('[zavorth-universal-skill-approved-zavorthControl-canary] checking Intent model0');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-universal-skill-approved-zavorthControl-canary] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthUniversalSkillApprovedZavorthControlCanaryContract.ts',
    'src/services/UniversalSkillApprovedZavorthControlCanaryService.ts',
    'scripts/zavorth-universal-skill-approved-zavorthControl-canary.ts',
    'scripts/zavorth-universal-skill-approved-zavorthControl-canary-check.mjs',
    'tests/services/UniversalSkillApprovedZavorthControlCanaryService.test.ts',
    'docs/README.md',
    'src/zavorth-control/app/api/skills/scale-hardening/route.ts',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'universal-skill-approved-zavorthControl-canary-files',
    label: 'Intent model0 files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'approved zavorthControl canary contract, service, CLI, check, docs, endpoint and tests are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthUniversalSkillApprovedZavorthControlCanaryContract.ts', [
      'ZAVORTH_UNIVERSAL_SKILL_APPROVED_ZAVORTH_CONTROL_CANARY_CONTRACT_VERSION',
      'endpointRequiresManagementAuth',
      'Intent model1 - ZavorthControl Visual Rendering Approval and Canary Monitoring',
    ]],
    ['src/services/UniversalSkillApprovedZavorthControlCanaryService.ts', [
      'certificationMatrixScaleHardeningIsAuthority',
      'noLayoutMutationPerformed',
      'liveCanaryRequiresApprovalId',
      'canaryPreparationDoesNotExecuteSkills',
      'buildCanary',
    ]],
    ['scripts/zavorth-universal-skill-approved-zavorthControl-canary.ts', [
      '--canary',
      '--approval-id',
      '--zavorthControl-items',
    ]],
    ['src/zavorth-control/app/api/skills/scale-hardening/route.ts', [
      'requireManagementAuth',
      'UniversalSkillApprovedZavorthControlCanaryService',
      'persistCanaryReport: false',
    ]],
    ['package.json', [
      'zavorth:universal-skill-approved-zavorthControl-canary',
      'zavorth:universal-skill-approved-zavorthControl-canary:check',
      'qa:zavorth-universal-skill-approved-zavorthControl-canary',
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
    id: 'universal-skill-approved-zavorthControl-canary-markers',
    label: 'Intent model0 markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'zavorthControl endpoint, approval gate, canary and no-execution markers are present',
    details: missing,
  };
}

function runZavorthControlModelFixture() {
  const fixture = createFixture(4);
  try {
    return runLiveCandidateRule({
      id: 'approved-zavorthControl-model',
      label: 'Builds approved zavorthControl view model',
      target: 'zavorthControl-only returns endpoint, cards, table, filters and no visual mutation',
      args: ['--project-root', fixture.root, '--source', fixture.source, '--no-discover', '--batch-size', '2', '--json'],
      expect: (snapshot) => snapshot.status === 'passed'
        && snapshot.zavorthControlImplementation.endpoint === '/api/skills/scale-hardening'
        && snapshot.zavorthControlImplementation.cards.length >= 5
        && snapshot.zavorthControlImplementation.table.rows.length === 2
        && snapshot.zavorthControlImplementation.visualFilesChanged === false
        && snapshot.policy.noLayoutMutationPerformed === true,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runDryRunCanaryFixture() {
  const fixture = createFixture(3);
  try {
    return runLiveCandidateRule({
      id: 'dry-run-canary',
      label: 'Prepares dry-run canary without execution',
      target: 'dry-run canary prepares receipt and keeps execution false',
      args: ['--project-root', fixture.root, '--source', fixture.source, '--no-discover', '--batch-size', '2', '--canary', 'dry-run', '--json'],
      expect: (snapshot) => snapshot.status === 'passed'
        && snapshot.canary.status === 'dry-run-ready'
        && snapshot.canary.dryRunPrepared === true
        && snapshot.canary.liveExecutionPerformed === false
        && snapshot.canary.upstreamExecutionPerformed === false,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runLiveApprovalRequiredFixture() {
  const fixture = createFixture(2);
  try {
    return runLiveCandidateRule({
      id: 'live-approval-required',
      label: 'Requires approval for live canary',
      target: 'live canary without approval returns attention and approval-required',
      args: ['--project-root', fixture.root, '--source', fixture.source, '--no-discover', '--canary', 'live', '--json'],
      expect: (snapshot) => snapshot.status === 'attention'
        && snapshot.canary.status === 'approval-required'
        && snapshot.canary.livePrepared === false
        && snapshot.rollout.readyForLiveCanary === false,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runLivePreparedFixture() {
  const fixture = createFixture(2);
  try {
    return runLiveCandidateRule({
      id: 'live-prepared',
      label: 'Prepares live canary with explicit approval',
      target: 'live canary with approval prepares live envelope but still does not execute',
      args: ['--project-root', fixture.root, '--source', fixture.source, '--no-discover', '--canary', 'live', '--approval-id', 'approval-test-123', '--json'],
      expect: (snapshot) => snapshot.status === 'passed'
        && snapshot.canary.status === 'live-prepared'
        && snapshot.canary.livePrepared === true
        && snapshot.canary.approvalId === 'approval-test-123'
        && snapshot.canary.liveExecutionPerformed === false,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runBlockedGateFixture() {
  const fixture = createFixture(5);
  try {
    return runLiveCandidateRule({
      id: 'blocked-gate',
      label: 'Propagates blocked scale gate',
      target: 'lower scale gate blocks zavorthControl/canary readiness',
      args: ['--project-root', fixture.root, '--source', fixture.source, '--no-discover', '--max-candidates', '2', '--canary', 'dry-run', '--json'],
      expect: (snapshot) => snapshot.status === 'blocked'
        && snapshot.canary.status === 'blocked'
        && snapshot.rollout.readyForZavorthControlUse === false,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runLiveCandidateRule(input) {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-universal-skill-approved-zavorthControl-canary.ts',
    ...input.args,
  ], { cwd: root, encoding: 'utf8', env: process.env });

  if (result.status !== 0) {
    return {
      id: input.id,
      label: input.label,
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: input.target,
      details: compact(result.stderr, result.stdout),
    };
  }

  try {
    const snapshot = JSON.parse(result.stdout);
    const pass = input.expect(snapshot);
    return {
      id: input.id,
      label: input.label,
      status: pass ? 'passed' : 'failed',
      observed: `status=${snapshot.status}, canary=${snapshot.canary?.status}, cards=${snapshot.zavorthControlImplementation?.cards?.length}, rows=${snapshot.zavorthControlImplementation?.table?.rows?.length}`,
      target: input.target,
      details: pass ? [] : [JSON.stringify(snapshot, null, 2)],
    };
  } catch (error) {
    return {
      id: input.id,
      label: input.label,
      status: 'failed',
      observed: 'invalid JSON',
      target: input.target,
      details: [error instanceof Error ? error.message : String(error), ...compact(result.stderr, result.stdout)],
    };
  }
}

function createFixture(skillCount) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-intent-model0-'));
  const source = path.join(rootDir, 'skill-source');
  fs.mkdirSync(source, { recursive: true });
  for (let index = 1; index <= skillCount; index += 1) {
    writeSkill(source, `skill-${String(index).padStart(2, '0')}`, `Useful governed skill number ${index}.`, 'Read local notes and summarize evidence.');
  }
  return { root: rootDir, source };
}

function writeSkill(rootDir, name, description, body) {
  const skillDir = path.join(rootDir, name);
  fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    'license: MIT',
    '---',
    '',
    `# ${name}`,
    '',
    body,
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(skillDir, 'references', 'notes.md'), '# Notes\n', 'utf8');
}

function read(relativePath) {
  const target = path.join(root, relativePath);
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
}

function compact(...values) {
  return values
    .flatMap((value) => String(value || '').split(/\r?\n/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
