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
  runDiscoveryFixture(),
  runApplyHistoryFixture(),
  runRegressionFixture(),
  runMissingSourceFixture(),
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
  console.log('[zavorth-universal-skill-real-source-onboarding] checking Phase 8');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-universal-skill-real-source-onboarding] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
    'src/contracts/ZavorthUniversalSkillRealSourceOnboardingContract.ts',
    'src/services/UniversalSkillRealSourceOnboardingService.ts',
    'scripts/zavorth-universal-skill-real-source-onboarding.ts',
    'scripts/zavorth-universal-skill-real-source-onboarding-check.mjs',
    'tests/services/UniversalSkillRealSourceOnboardingService.test.ts',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'universal-skill-real-source-onboarding-files',
    label: 'Phase 8 files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'real source onboarding contract, service, CLI, check, docs and tests are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthUniversalSkillRealSourceOnboardingContract.ts', [
      'ZAVORTH_UNIVERSAL_SKILL_REAL_SOURCE_ONBOARDING_CONTRACT_VERSION',
      'historyContainsAggregateOnly',
      'Phase 9 - Real Library Scale Hardening and Dashboard Review',
    ]],
    ['src/services/UniversalSkillRealSourceOnboardingService.ts', [
      'ZAVORTH_SKILL_SOURCE_PATHS',
      'buildFindings',
      'persistHistory',
      'sourceDiscoveryIsWorkspaceBounded',
      'noRawSecretsSerialized',
    ]],
    ['scripts/zavorth-universal-skill-real-source-onboarding.ts', [
      '--history',
      '--no-discover',
      '--no-qa-report',
    ]],
    ['package.json', [
      'zavorth:universal-skill-real-source-onboarding',
      'zavorth:universal-skill-real-source-onboarding:check',
      'qa:zavorth-universal-skill-real-source-onboarding',
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
    id: 'universal-skill-real-source-onboarding-markers',
    label: 'Phase 8 markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'onboarding has discovery, history, regression and no-execution markers',
    details: missing,
  };
}

function runDiscoveryFixture() {
  const fixture = createFixture();
  try {
    return runOnboardingRule({
      id: 'universal-skill-real-source-onboarding-discovery',
      label: 'Discovers workspace real sources and persists history',
      target: 'default discovery includes existing workspace skill-library and writes aggregate history',
      args: [
        '--project-root', fixture.root,
        '--channel', 'telegram',
        '--json',
      ],
      expect: (snapshot) => snapshot.status === 'passed'
        && snapshot.sources.summary.includedInQa >= 1
        && snapshot.history.persisted === true
        && snapshot.history.entries.length === 1
        && snapshot.policy.historyContainsAggregateOnly === true,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runApplyHistoryFixture() {
  const fixture = createFixture();
  try {
    return runOnboardingRule({
      id: 'universal-skill-real-source-onboarding-apply-history',
      label: 'Tracks limited apply as continuous baseline',
      target: 'apply with explicit allow imports clean skills and records aggregate current entry',
      args: [
        '--project-root', fixture.root,
        '--source', fixture.clean,
        '--no-discover',
        '--apply',
        '--allow-source',
        '--allow-all-candidates',
        '--json',
      ],
      expect: (snapshot) => snapshot.status === 'passed'
        && snapshot.qa.expansion.summary.materialized === 2
        && snapshot.history.currentEntry.materialized === 2
        && snapshot.history.currentEntry.bridgeReady >= 2,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runRegressionFixture() {
  const fixture = createFixture();
  const historyPath = path.join(fixture.root, '.zavorth', 'reports', 'history.json');
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.writeFileSync(historyPath, JSON.stringify({
    contractVersion: '2026-05-10.phase-8',
    updatedAt: '2026-05-10T00:00:00.000Z',
    entries: [{
      runId: 'previous',
      generatedAt: '2026-05-10T00:00:00.000Z',
      status: 'passed',
      qaStatus: 'passed',
      candidateSourceCount: 1,
      selectedSourceCount: 1,
      includedSourceCount: 1,
      candidates: 9,
      materialized: 4,
      bridgeReady: 4,
      blockedCandidates: 0,
      denied: 0,
      recommendedMode: 'dry-run-rollout',
    }],
  }, null, 2), 'utf8');

  try {
    return runOnboardingRule({
      id: 'universal-skill-real-source-onboarding-regression',
      label: 'Detects regression against aggregate baseline',
      target: 'candidate/materialized/bridge drops produce warning findings and attention status',
      args: [
        '--project-root', fixture.root,
        '--source', fixture.clean,
        '--no-discover',
        '--history', historyPath,
        '--json',
      ],
      expect: (snapshot) => snapshot.status === 'attention'
        && snapshot.regression.baselineAvailable === true
        && snapshot.regression.findings.some((finding) => finding.id === 'bridge-ready-drop')
        && snapshot.history.entries.length === 2,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runMissingSourceFixture() {
  const fixture = createFixture();
  try {
    return runOnboardingRule({
      id: 'universal-skill-real-source-onboarding-missing-source',
      label: 'Blocks missing explicit source',
      target: 'missing operator-declared source is not silently treated as healthy',
      args: [
        '--project-root', fixture.root,
        '--source', path.join(fixture.root, 'missing-source'),
        '--no-discover',
        '--json',
      ],
      expect: (snapshot) => snapshot.status === 'blocked'
        && snapshot.sources.summary.missingSelected === 1
        && snapshot.regression.findings.some((finding) => finding.id === 'missing-selected-source'),
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runOnboardingRule(input) {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-universal-skill-real-source-onboarding.ts',
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
      observed: `status=${snapshot.status}, sources=${snapshot.sources?.summary?.includedInQa}, findings=${snapshot.regression?.findings?.length}, history=${snapshot.history?.entries?.length}`,
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

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-usrs-'));
  const skillLibrary = path.join(rootDir, 'skill-library');
  const clean = path.join(rootDir, 'clean-source');
  fs.mkdirSync(skillLibrary, { recursive: true });
  fs.mkdirSync(clean, { recursive: true });
  writeSkill(skillLibrary, 'research-pack', 'Research local documents and produce evidence notes.', 'Read local notes.');
  writeSkill(clean, 'research-pack', 'Research local documents and produce evidence notes.', 'Read local notes.');
  writeSkill(clean, 'writing-pack', 'Draft concise operator updates from trusted notes.', 'Write concise notes.');
  return { root: rootDir, skillLibrary, clean };
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
