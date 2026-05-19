#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist(),
  ruleContainsMarkers(),
  ruleNativeSkillAssets(),
  runNativePackFixture(),
  runDeveloperActivationFixture(),
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
  console.log('[zavorth-native-intelligence-pack] checking Intent model');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-native-intelligence-pack] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthNativeIntelligencePackContract.ts',
    'src/services/ZavorthNativeIntelligencePackService.ts',
    'scripts/zavorth-native-intelligence-pack.ts',
    'scripts/zavorth-native-intelligence-pack-check.mjs',
    'tests/services/ZavorthNativeIntelligencePackService.test.ts',
    'docs/capability-plugins.md',
    'config/skill-sources.json',
    'config/skill-allowlist.json',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'native-intelligence-pack-files',
    label: 'Intent model files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs, config and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthNativeIntelligencePackContract.ts', [
      'ZAVORTH_NATIVE_INTELLIGENCE_PACK_CONTRACT_VERSION',
      'ZavorthNativeSkillPresetId',
      'noExecutionByDefault',
      'Preview engine - Governed Subagent Model',
    ]],
    ['src/services/ZavorthNativeIntelligencePackService.ts', [
      'ZAVORTH_NATIVE_SKILL_DEFINITIONS',
      'large-skill-absorption',
      'agent-orchestrator',
      'zavorth-native',
      'noDirectToolUseByDefault',
    ]],
    ['config/skill-sources.json', [
      'zavorth-native',
      'skill-library/native',
      'zavorth:native-intelligence-pack',
    ]],
    ['config/skill-allowlist.json', [
      'zavorth-native',
      'Official Zavorth-owned native intelligence pack.',
    ]],
    ['package.json', [
      'zavorth:native-intelligence-pack',
      'zavorth:native-intelligence-pack:check',
      'qa:zavorth-native-intelligence-pack',
      'skill-library/native/',
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
    id: 'native-intelligence-pack-markers',
    label: 'Intent model markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'native source, presets, no-execution and package markers are present',
    details: missing,
  };
}

function ruleNativeSkillAssets() {
  const expected = [
    'task-planning',
    'agent-orchestrator',
    'large-skill-absorption',
    'security-audit',
    'prompt-injection-defense',
    'code-review',
    'repo-map',
    'document-analysis',
    'web-research-governed',
    'provider-doctor',
    'channel-response-design',
    'dashboard-ops',
    'memory-curator',
    'incident-triage',
    'user-onboarding',
  ];
  const missing = [];
  for (const id of expected) {
    const dir = path.join(root, 'skill-library', 'native', id);
    const skillFile = path.join(dir, 'SKILL.md');
    const manifestFile = path.join(dir, 'ZAVORTH_NATIVE_SKILL.json');
    if (!fs.existsSync(skillFile)) missing.push(`${id}: missing SKILL.md`);
    if (!fs.existsSync(manifestFile)) {
      missing.push(`${id}: missing manifest`);
      continue;
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      if (manifest.id !== id) missing.push(`${id}: manifest id mismatch`);
      if (manifest.native !== true) missing.push(`${id}: manifest native not true`);
      if (manifest.noExecutionByDefault !== true) missing.push(`${id}: execution default not false`);
    } catch (error) {
      missing.push(`${id}: invalid manifest JSON ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    id: 'native-intelligence-pack-assets',
    label: 'Native skill assets are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${expected.length - new Set(missing.map((entry) => entry.split(':')[0])).size}/${expected.length} native skill(s) clean`,
    target: 'all native skills have SKILL.md and matching no-execution manifests',
    details: missing,
  };
}

function runNativePackFixture() {
  return runPackRule({
    id: 'native-pack-list',
    label: 'Lists native pack without external sources',
    target: 'snapshot passes with 15 native skills, 6 presets and no execution',
    args: ['--json'],
    expect: (snapshot) => snapshot.status === 'passed'
      && snapshot.summary.nativeSkills >= 15
      && snapshot.summary.presets === 6
      && snapshot.summary.executionPerformed === false
      && snapshot.summary.directToolUsePerformed === false
      && snapshot.catalog.sourceConfigured === true
      && snapshot.catalog.policyAllowsSource === true,
  });
}

function runDeveloperActivationFixture() {
  return runPackRule({
    id: 'native-pack-developer-activation',
    label: 'Prepares developer preset activation',
    target: 'developer preset activation prepares receipts but performs no execution',
    args: ['--json', '--preset', 'developer', '--activate'],
    expect: (snapshot) => snapshot.status === 'passed'
      && snapshot.selectedPreset === 'developer'
      && snapshot.activationPlan.requested === true
      && snapshot.activationPlan.readySkillIds.includes('large-skill-absorption')
      && snapshot.activationPlan.readySkillIds.includes('code-review')
      && snapshot.activationPlan.noExecutionPerformed === true
      && snapshot.activationPlan.noDirectToolUsePerformed === true,
  });
}

function runPackRule(input) {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-native-intelligence-pack.ts',
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
      observed: `status=${snapshot.status}, skills=${snapshot.summary?.nativeSkills}, presets=${snapshot.summary?.presets}, ready=${snapshot.activationPlan?.readySkillIds?.length}`,
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
