#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'ask-before-assumption-files',
    label: 'Channel mesh2 files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/AskBeforeAssumptionPolicyService.ts',
      'src/cli/ZavorthCliAskBeforeAssumptionPolicyRenderer.ts',
      'tests/runtime/agent/AskBeforeAssumptionPolicyService.test.ts',
      'tests/runtime/agent/AgentRunServiceAskBeforeAssumptionPolicy.test.ts',
      'tests/cli/ZavorthCliAskBeforeAssumptionPolicy.test.ts',
      'tests/ai-gateway/control/CommandCenterAskBeforeAssumptionPolicy.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'ask-before-assumption-contract',
    label: 'Ask Before Assumption contract blocks unsafe assumptions',
    target: 'AskBeforeAssumptionPolicySnapshot includes assumptions, questions, receipts and no-mutation policy',
    files: ['src/runtime/agent/AskBeforeAssumptionPolicyService.ts'],
    needles: [
      'ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION',
      '2026-05-03.track-42',
      'AskBeforeAssumption',
      'AskBeforeAssumptionQuestion',
      'noAssumptionActedOn',
      'asksBeforeMutation',
      'previewBeforeRiskyAction',
      'naturalLanguageDoesNotBypassPolicy',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-ask-before-assumption',
    label: 'Agent run publishes Ask Before Assumption Policy',
    target: 'AgentRunService writes run.metadata.askBeforeAssumptionPolicy and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceAskBeforeAssumptionPolicy.test.ts',
    ],
    needles: [
      'AskBeforeAssumptionPolicyService',
      'askBeforeAssumptionPolicy',
      'applyAskBeforeAssumptionPolicy',
      'ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-ask-before-assumption',
    label: 'CLI exposes Ask Before Assumption Policy',
    target: 'zavorth assumptions renders pending questions in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliAskBeforeAssumptionPolicyRenderer.ts',
      'tests/cli/ZavorthCliAskBeforeAssumptionPolicy.test.ts',
    ],
    needles: [
      'assumptions',
      'Ask Before Assumption Policy - Channel mesh2',
      'resolveAskBeforeAssumptionPolicyCliText',
      'formatAskBeforeAssumptionPolicySnapshot',
      'zavorth assumptions',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-ask-before-assumption',
    label: 'Command Center projects Ask Before Assumption Policy',
    target: '/control reads askBeforeAssumptionPolicy from run metadata and renders it in overview/config surfaces',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterAskBeforeAssumptionPolicy.test.ts',
    ],
    needles: [
      'DashboardAskBeforeAssumptionPolicySnapshot',
      'askBeforeAssumptionPolicy',
      'buildAskBeforeAssumptionPolicy',
      'mapAskBeforeAssumptionPolicy',
      'Ask Before Assumption',
      'summary.questionCount',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-ask-before-assumption-gate',
    label: 'package exposes Channel mesh2 gate',
    target: 'local QA can run ask-before-assumption:check and qa:ask-before-assumption',
    files: ['package.json'],
    needles: [
      'ask-before-assumption:check',
      'qa:ask-before-assumption',
      'scripts/ask-before-assumption-check.mjs',
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
  console.log('[ask-before-assumption] checking Channel mesh2');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[ask-before-assumption] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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

function ruleContainsAcross(input) {
  const contentsByFile = input.files.map((file) => ({
    file,
    contents: read(file),
  }));
  const missingFiles = contentsByFile
    .filter((entry) => entry.contents === null)
    .map((entry) => `missing ${entry.file}`);
  const missingNeedles = input.needles
    .filter((needle) => !contentsByFile.some((entry) => entry.contents?.includes(needle)))
    .map((needle) => `missing ${needle}`);
  const missing = [...missingFiles, ...missingNeedles];
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present across files',
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
