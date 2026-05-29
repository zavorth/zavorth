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
  runBatchPlanFixture(),
  runScaleGateFixture(),
  runApplyCanaryFixture(),
  runNoVisualMutationFixture(),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
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
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-universal-skill-scale-hardening] checking Certification matrix');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-universal-skill-scale-hardening] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthUniversalSkillScaleHardeningContract.ts',
    'src/services/UniversalSkillScaleHardeningService.ts',
    'scripts/zavorth-universal-skill-scale-hardening.ts',
    'scripts/zavorth-universal-skill-scale-hardening-check.mjs',
    'tests/services/UniversalSkillScaleHardeningService.test.ts',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'universal-skill-scale-hardening-files',
    label: 'Certification matrix files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'scale hardening contract, service, CLI, check, docs and tests are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthUniversalSkillScaleHardeningContract.ts', [
      'ZAVORTH_UNIVERSAL_SKILL_SCALE_HARDENING_CONTRACT_VERSION',
      'noVisualChangeWithoutOwnerApproval',
      'Intent model0 - Approved ZavorthControl Implementation and Live Scale Canary',
    ]],
    ['src/services/UniversalSkillScaleHardeningService.ts', [
      'zavorthControlControlsOnboardingIsAuthority',
      'buildZavorthControlReviewItems',
      'canaryBeforeBulkApply',
      'zavorthControlReviewDoesNotChangeVisuals',
      'buildBatches',
    ]],
    ['scripts/zavorth-universal-skill-scale-hardening.ts', [
      '--batch-size',
      '--scale-report',
      '--no-scale-report',
    ]],
    ['package.json', [
      'zavorth:universal-skill-scale-hardening',
      'zavorth:universal-skill-scale-hardening:check',
      'qa:zavorth-universal-skill-scale-hardening',
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
      if (!text.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: 'universal-skill-scale-hardening-markers',
    label: 'Certification matrix markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'scale hardening has batch, canary, zavorthControl review and no-visual-mutation markers',
    details: missing,
  };
}

function runBatchPlanFixture() {
  const fixture = createFixture(7);
  try {
    return runScaleRule({
      id: 'universal-skill-scale-hardening-batch-plan',
      label: 'Builds batch plan for larger libraries',
      target: '7 candidates with batch-size 3 produce 3 approval-gated batches and zavorthControl contract',
      args: [
        '--project-root', fixture.root,
        '--source', fixture.source,
        '--no-discover',
        '--batch-size', '3',
        '--large-threshold', '5',
        '--json',
      ],
      expect: (snapshot) => snapshot.status === 'passed'
        && snapshot.capacity.scaleBand === 'large'
        && snapshot.capacity.batchCount === 3
        && snapshot.batches.every((batch) => batch.approvalRequired === true)
        && snapshot.zavorthControlReview.contractOnly === true,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runScaleGateFixture() {
  const fixture = createFixture(7);
  try {
    return runScaleRule({
      id: 'universal-skill-scale-hardening-scale-gate',
      label: 'Blocks when lower phase scale gate blocks',
      target: 'max-candidates gate propagates blocked status into Certification matrix',
      args: [
        '--project-root', fixture.root,
        '--source', fixture.source,
        '--no-discover',
        '--max-candidates', '3',
        '--json',
      ],
      expect: (snapshot) => snapshot.status === 'blocked'
        && snapshot.gates.some((gate) => gate.id === 'zavorthControl-controls-onboarding' && gate.status === 'blocked')
        && snapshot.rollout.recommendedMode === 'hold',
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runApplyCanaryFixture() {
  const fixture = createFixture(2);
  try {
    return runScaleRule({
      id: 'universal-skill-scale-hardening-apply-canary',
      label: 'Apply mode recommends canary rollout',
      target: 'limited apply remains approval-gated and moves to canary recommendation',
      args: [
        '--project-root', fixture.root,
        '--source', fixture.source,
        '--no-discover',
        '--apply',
        '--allow-source',
        '--allow-all-candidates',
        '--json',
      ],
      expect: (snapshot) => snapshot.status === 'passed'
        && snapshot.onboarding.qa.expansion.summary.materialized === 2
        && snapshot.rollout.recommendedMode === 'canary-apply'
        && snapshot.policy.canaryBeforeBulkApply === true,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runNoVisualMutationFixture() {
  const fixture = createFixture(1);
  try {
    return runScaleRule({
      id: 'universal-skill-scale-hardening-no-visual-mutation',
      label: 'ZavorthControl review does not mutate visuals',
      target: 'review emits zavorthControl items while preserving owner approval requirement',
      args: [
        '--project-root', fixture.root,
        '--source', fixture.source,
        '--no-discover',
        '--json',
      ],
      expect: (snapshot) => snapshot.zavorthControlReview.approvedVisualChangesApplied === false
        && snapshot.zavorthControlReview.layoutMutationPerformed === false
        && snapshot.zavorthControlReview.items.length >= 5
        && snapshot.zavorthControlReview.items.every((item) => item.ownerApprovalRequired === true)
        && snapshot.policy.noVisualChangeWithoutOwnerApproval === true,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runScaleRule(input) {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-universal-skill-scale-hardening.ts',
    ...input.args,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

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
      observed: `status=${snapshot.status}, band=${snapshot.capacity?.scaleBand}, batches=${snapshot.capacity?.batchCount}, zavorthControl=${snapshot.zavorthControlReview?.items?.length}`,
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
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-usscale-'));
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
