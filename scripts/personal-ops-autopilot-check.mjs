#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'personal-ops-autopilot-files',
    label: 'Wave 39 files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/PersonalOpsAutopilotService.ts',
      'src/cli/ZavorthCliPersonalOpsAutopilotRenderer.ts',
      'tests/runtime/agent/PersonalOpsAutopilotService.test.ts',
      'tests/runtime/agent/AgentRunServicePersonalOpsAutopilot.test.ts',
      'tests/cli/ZavorthCliPersonalOpsAutopilot.test.ts',
      'tests/ai-gateway/control/CommandCenterPersonalOpsAutopilot.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'personal-ops-autopilot-contract',
    label: 'Personal Ops Autopilot contract suggests governed fixes',
    target: 'PersonalOpsAutopilotSnapshot includes suggestions, receipts, policy and preview/approval guarantees',
    files: ['src/runtime/agent/PersonalOpsAutopilotService.ts'],
    needles: [
      'PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION',
      '2026-05-03.wave-39',
      'PersonalOpsAutopilotSuggestion',
      'PersonalOpsAutopilotReceipt',
      'noMutableActionExecuted',
      'noAutorepairStarted',
      'approvalsRequiredForMutation',
      'previewBeforeAutorepair',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-personal-ops-autopilot',
    label: 'Agent run publishes Personal Ops Autopilot',
    target: 'AgentRunService writes run.metadata.personalOpsAutopilot and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServicePersonalOpsAutopilot.test.ts',
    ],
    needles: [
      'PersonalOpsAutopilotService',
      'personalOpsAutopilot',
      'applyPersonalOpsAutopilot',
      'PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-personal-ops-autopilot',
    label: 'CLI exposes Personal Ops Autopilot',
    target: 'zavorth personal-ops renders governed suggestions in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliPersonalOpsAutopilotRenderer.ts',
      'tests/cli/ZavorthCliPersonalOpsAutopilot.test.ts',
    ],
    needles: [
      'personal-ops',
      'Personal Ops Autopilot - Wave 39',
      'resolvePersonalOpsAutopilotCliText',
      'formatPersonalOpsAutopilotSnapshot',
      'zavorth personal-ops',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-personal-ops-autopilot',
    label: 'Command Center projects Personal Ops Autopilot',
    target: '/control reads personalOpsAutopilot from run metadata and renders it in overview/config surfaces',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterPersonalOpsAutopilot.test.ts',
    ],
    needles: [
      'DashboardPersonalOpsAutopilotSnapshot',
      'personalOpsAutopilot',
      'buildPersonalOpsAutopilot',
      'mapPersonalOpsAutopilot',
      'Personal Ops Autopilot',
      'summary.suggestionCount',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-personal-ops-autopilot-gate',
    label: 'package exposes Wave 39 gate',
    target: 'local QA can run personal-ops-autopilot:check and qa:personal-ops-autopilot',
    files: ['package.json'],
    needles: [
      'personal-ops-autopilot:check',
      'qa:personal-ops-autopilot',
      'scripts/personal-ops-autopilot-check.mjs',
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
  console.log('[personal-ops-autopilot] checking Wave 39');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[personal-ops-autopilot] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
