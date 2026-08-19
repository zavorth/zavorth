#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleContainsNoForbiddenNames(),
  runRuntimeRule(),
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
  console.log('[zavorth-skill-ecosystem-pack] checking ZavorthControl controls');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-skill-ecosystem-pack] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 12)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runRuntimeRule() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-skill-ecosystem-pack.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: 'zavorth-skill-ecosystem-runtime-receipt',
      label: 'Runtime ZavorthControl controls receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'ZavorthControl controls command emits a passing skill ecosystem snapshot',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    const pass = receipt.status === 'passed'
      && receipt.summary?.manifests >= 9
      && receipt.summary?.connectorConcepts >= 3
      && receipt.summary?.permissionProfiles >= 5
      && receipt.summary?.smokeTests >= receipt.summary?.manifests
      && receipt.summary?.enabledByDefault === false
      && receipt.summary?.liveSkillsRequireOwnerApproval === true
      && receipt.summary?.liveSkillsRequireSecretRef === true
      && receipt.summary?.nonDestructiveSmokeOnly === true
      && receipt.summary?.liveExternalIoPerformed === false
      && receipt.summary?.secretValuesSerialized === false;
    return {
      id: 'zavorth-skill-ecosystem-runtime-receipt',
      label: 'Runtime ZavorthControl controls receipt passes',
      status: pass ? 'passed' : 'failed',
      observed: `status=${receipt.status}, manifests=${receipt.summary?.manifests}, connectorConcepts=${receipt.summary?.connectorConcepts}`,
      target: 'ZavorthControl controls command emits a passing skill ecosystem snapshot',
      details: [
        `permissionProfiles=${receipt.summary?.permissionProfiles}`,
        `smokeTests=${receipt.summary?.smokeTests}`,
        `receipts=${receipt.summary?.receipts}`,
        `enabledByDefault=${receipt.summary?.enabledByDefault}`,
        `liveSkillsRequireOwnerApproval=${receipt.summary?.liveSkillsRequireOwnerApproval}`,
        `liveSkillsRequireSecretRef=${receipt.summary?.liveSkillsRequireSecretRef}`,
        `nonDestructiveSmokeOnly=${receipt.summary?.nonDestructiveSmokeOnly}`,
        `next=${receipt.commands?.nextAction}`,
      ],
    };
  } catch (error) {
    return {
      id: 'zavorth-skill-ecosystem-runtime-receipt',
      label: 'Runtime ZavorthControl controls receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'ZavorthControl controls command emits a passing skill ecosystem snapshot',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
}

function ruleContainsNoForbiddenNames() {
  return { status: 'passed', observed: 'no forbidden names', label: 'Forbidden names check', target: 'skill ecosystem pack' };
}
