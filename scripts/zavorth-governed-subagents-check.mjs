#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'governed-subagents-files',
    label: 'Preview engine files exist',
    target: 'Contract, service, CLI, tests and docs are present',
    files: [
      'src/contracts/ZavorthGovernedSubagentContract.ts',
      'src/services/ZavorthGovernedSubagentService.ts',
      'scripts/zavorth-governed-subagents.ts',
      'tests/services/ZavorthGovernedSubagentService.test.ts',
      'docs/capability-plugins.md',
    ],
  }),
  ruleContainsAll({
    id: 'governed-subagents-contract',
    label: 'Contract defines governed subagent guarantees',
    target: 'Snapshot includes profiles, prepared roles, receipts and launch boundary guarantees',
    files: ['src/contracts/ZavorthGovernedSubagentContract.ts'],
    needles: [
      'ZAVORTH_GOVERNED_SUBAGENT_CONTRACT_VERSION',
      '2026-05-10.governed-subagent-checkpoint-2',
      'ZavorthGovernedSubagentProfile',
      'ZavorthGovernedSubagentPreparedRole',
      'SecurityPolicyBrokerReceipt',
      'SubagentResultReceipt',
      'noSubagentsLaunched',
      'launchRequiresPolicyBroker',
    ],
  }),
  ruleContainsAll({
    id: 'governed-subagents-service',
    label: 'Service binds native skills to policy and subagent receipts',
    target: 'Every prepared role is backed by native skills, Policy Broker and subagent receipt boundaries',
    files: ['src/services/ZavorthGovernedSubagentService.ts'],
    needles: [
      'ZavorthNativeIntelligencePackService',
      'decideSecurityPolicy',
      'createSubagentCapabilityScope',
      'createSubagentBudget',
      'createSubagentApprovalBoundary',
      'createSubagentResultReceipt',
      'prepare-governed-subagent',
      'noWorkspaceMutation',
    ],
  }),
  ruleContainsAll({
    id: 'governed-subagents-cli',
    label: 'CLI exposes preview and JSON',
    target: 'Operator can preview governed roles by preset, task and role filters',
    files: ['scripts/zavorth-governed-subagents.ts'],
    needles: [
      '--preset',
      '--task',
      '--role',
      '--max-roles',
      '--security-profile',
      'formatSnapshotText',
    ],
  }),
  ruleContainsAll({
    id: 'governed-subagents-package',
    label: 'package exposes Preview engine commands',
    target: 'Local QA can run governed subagent preview and check scripts',
    files: ['package.json'],
    needles: [
      'zavorth:governed-subagents',
      'zavorth:governed-subagents:json',
      'zavorth:governed-subagents:check',
      'qa:zavorth-governed-subagents',
    ],
  }),
  ruleContainsAll({
    id: 'governed-subagents-tests',
    label: 'Tests cover governance boundaries',
    target: 'Tests verify no launch, no tool execution, approvals and native skill backing',
    files: ['tests/services/ZavorthGovernedSubagentService.test.ts'],
    needles: [
      'noSubagentsLaunched',
      'noToolsInvoked',
      'workspaceMutationPerformed',
      'approval-required',
      'nativeSkillsBackEveryRole',
    ],
  }),
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
  console.log('[zavorth-governed-subagents] checking Preview engine');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-governed-subagents] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
