#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runPreviewFixture(),
  runApplyFixture(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = { generatedAt: new Date().toISOString(), status: failed.length > 0 ? 'failed' : 'passed', rules };

if (asJson) console.log(JSON.stringify(snapshot, null, 2));
else {
  console.log('[zavorth-skill-absorption-materialize] checking Phase 6/8');
  printRules(rules, '[zavorth-skill-absorption-materialize]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthSkillAbsorptionMaterializationContract.ts',
    'src/services/ZavorthSkillAbsorptionMaterializationService.ts',
    'scripts/zavorth-skill-absorption-materialize.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('materialize-files', 'Materialization files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'contract service CLI present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthSkillAbsorptionMaterializationContract.ts', ['rollback', 'supportFilesAreNotExecutableTools', 'bridgeHandoffIsDryRunByDefault']],
    ['src/services/ZavorthSkillAbsorptionMaterializationService.ts', ['UniversalSkillTrustImportService', 'UniversalSkillBridgeRuntimeService', 'sourceAllowlistRequired', 'skillAllowlistRequired']],
    ['package.json', ['zavorth:skill-absorption-materialize', 'zavorth:skill-absorption-materialize:check']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('materialize-markers', 'Materialization markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'import, provenance, rollback and bridge markers', missing);
}

function runPreviewFixture() {
  const fixture = createFixture();
  try {
    const result = runTs('scripts/zavorth-skill-absorption-materialize.ts', ['--source', fixture.source, '--target-root', fixture.target, '--no-bridge', '--json']);
    return jsonRule('materialize-preview', 'Preview does not mutate workspace', result, (snapshot) =>
      snapshot.status === 'preview-only'
      && snapshot.summary.workspaceMutationPerformed === false
      && snapshot.summary.skillsSelected === 1);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runApplyFixture() {
  const fixture = createFixture();
  try {
    const result = runTs('scripts/zavorth-skill-absorption-materialize.ts', [
      '--source', fixture.source,
      '--target-root', fixture.target,
      '--apply',
      '--approval-id', 'approval-test',
      '--allow-source',
      '--allow-all-skills',
      '--no-bridge',
      '--json',
    ]);
    return jsonRule('materialize-apply', 'Apply materializes safe imported skill', result, (snapshot) =>
      snapshot.status === 'materialized'
      && snapshot.summary.skillsMaterialized === 1
      && snapshot.summary.filesWritten >= 3
      && snapshot.rollback.available === true
      && fs.existsSync(path.join(fixture.target, 'safe-review-skill', 'ORIGIN.json'))
      && fs.existsSync(path.join(fixture.target, 'safe-review-skill', 'ATTRIBUTION.md')));
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function createFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-materialize-'));
  const source = path.join(base, 'source');
  const target = path.join(base, 'imported');
  const skill = path.join(source, 'safe-review-skill');
  fs.mkdirSync(path.join(skill, 'references'), { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), [
    '---',
    'name: safe-review-skill',
    'description: Safe local review skill for materialization fixture.',
    'license: MIT',
    '---',
    '',
    '# Safe Review Skill',
    '',
    'Review local notes and summarize evidence without executing tools.',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(skill, 'references', 'notes.md'), '# Notes\n\nFixture evidence.\n', 'utf8');
  return { root: base, source, target };
}

function runTs(script, args) {
  return spawnSync(process.execPath, [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
}

function jsonRule(id, label, result, expect) {
  if (result.status !== 0) return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr, result.stdout));
  try {
    const snapshot = JSON.parse(result.stdout);
    const pass = expect(snapshot);
    return rule(id, label, pass, `status=${snapshot.status}; materialized=${snapshot.summary?.skillsMaterialized}`, 'expected materialization behavior', pass ? [] : [JSON.stringify(snapshot, null, 2)]);
  } catch (error) {
    return rule(id, label, false, 'invalid JSON', 'valid JSON fixture', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function printRules(items, prefix) {
  for (const item of items) {
    console.log(`${prefix} ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 12)) console.log(`  - ${detail}`);
  }
}

function compact(...parts) {
  return parts.join('\n').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
