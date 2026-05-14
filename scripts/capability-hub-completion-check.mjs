#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const staticRules = [
  ruleFilesExist({
    id: 'capability-hub-completion-files',
    label: 'Capability Hub Completion Phase 12 files exist',
    target: 'contract, service, API facade, dynamic gate, tests and docs are present',
    files: [
      'src/contracts/CapabilityHubCompletionContract.ts',
      'src/services/ZavorthCapabilityHubCompletionService.ts',
      'src/services/ZavorthCapabilityHubCompletionApiService.ts',
      'scripts/capability-hub-completion-gate.ts',
      'scripts/capability-hub-completion-check.mjs',
      'tests/services/ZavorthCapabilityHubCompletionService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-hub-completion-contract',
    label: 'Completion contract captures phase matrix and journey assertions',
    target: 'contract exposes phases, journeys, no-live and no-secret acceptance',
    files: ['src/contracts/CapabilityHubCompletionContract.ts'],
    needles: [
      'CAPABILITY_HUB_COMPLETION_CONTRACT_VERSION',
      'CapabilityHubCompletionPhase',
      'CapabilityHubCompletionJourney',
      'rawSecretsSerialized: false',
      'liveActivationApplied: false',
      'ownerApprovalBeforeLive: true',
    ],
  }),
  ruleContainsAll({
    id: 'capability-hub-completion-service-runs-journeys',
    label: 'Completion service runs natural journeys',
    target: 'service seeds a ready ticket and verifies console, setup, readiness and activation guard journeys',
    files: ['src/services/ZavorthCapabilityHubCompletionService.ts'],
    needles: [
      'journey-create-slack-ticket',
      'journey-approval-guard',
      'journey-controlled-request',
      'seedReadyTicket',
      'approvalRequiredWhenExecuting',
      'liveViolations',
    ],
  }),
  ruleContainsAll({
    id: 'capability-hub-completion-workspace-gate',
    label: 'Completion gate is wired directly into workspace check',
    target: 'workspace check calls direct node gate without adding public script names',
    files: ['package.json'],
    needles: [
      'capability-console',
      'node scripts/capability-hub-completion-check.mjs',
    ],
  }),
];

const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const dynamic = spawnSync(process.execPath, [tsxCli, 'scripts/capability-hub-completion-gate.ts', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
const dynamicRule = {
  id: 'capability-hub-completion-dynamic-gate',
  label: 'Completion dynamic gate passes',
  status: dynamic.status === 0 ? 'passed' : 'failed',
  observed: dynamic.status === 0 ? 'dynamic acceptance passed' : `dynamic acceptance failed (${dynamic.status})`,
  target: 'phase matrix and natural journeys pass with no live or secret violations',
  details: dynamic.status === 0 ? [] : [
    dynamic.error ? String(dynamic.error.message || dynamic.error) : '',
    dynamic.stdout,
    dynamic.stderr,
  ].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 20),
};
const rules = [...staticRules, dynamicRule];
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
  console.log('[capability-hub-completion] checking Phase 12');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-hub-completion] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist(input) {
  const missing = input.files.filter((file) => !exists(file));
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${input.files.length - missing.length}/${input.files.length} file(s) present`,
    target: input.target,
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsAll(input) {
  const missing = [];
  for (const file of input.files) {
    const contents = read(file);
    if (contents === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of input.needles) {
      if (!contents.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}
