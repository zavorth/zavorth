#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'blueprint-completion-files',
    label: 'Blueprint completion files exist',
    target: 'Runtime, CLI, Dashboard, tests and docs are present',
    files: [
      'src/runtime/agent/BlueprintCompletionGateService.ts',
      'src/cli/ZavorthCliBlueprintCompletionRenderer.ts',
      'tests/runtime/agent/BlueprintCompletionGateService.test.ts',
      'tests/runtime/agent/AgentRunServiceBlueprintCompletionGate.test.ts',
      'tests/cli/ZavorthCliBlueprintCompletion.test.ts',
      'tests/ai-gateway/dashboard/DashboardBlueprintCompletion.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'blueprint-completion-contract',
    label: 'Blueprint completion contract exists',
    target: 'Final gate closes pre-canary, rollout, execution, canary promotion and release decision with safeguards',
    files: ['src/runtime/agent/BlueprintCompletionGateService.ts'],
    needles: [
      'BLUEPRINT_COMPLETION_GATE_CONTRACT_VERSION',
      '2026-05-04.blueprint-complete',
      'ReleaseCandidatePreCanaryGateService',
      'CapabilityAutopilotReleaseRolloutPlanService',
      'CapabilityAutopilotReleaseExecutionGateService',
      'CapabilityAutopilotCanaryMonitoringPromotionGateService',
      'CapabilityAutopilotReleaseDecisionService',
      'blueprintCompletionGate',
      'noUngovernedDeploy: true',
      'manualPromotionRequired: true',
      'noAutoExecute: true',
      'noGlobalRolloutByDefault: true',
      'noSkipCanary: true',
      'noSkipApproval: true',
      'rollbackPathRequired: true',
      'auditReceiptsRequired: true',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-publishes-blueprint-completion',
    label: 'Agent run publishes blueprint completion',
    target: 'AgentRunService writes run.metadata.blueprintCompletionGate after releaseCandidatePreCanaryGate and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceBlueprintCompletionGate.test.ts',
    ],
    needles: [
      'BlueprintCompletionGateService',
      'blueprintCompletionGate',
      'applyBlueprintCompletionGate',
      'BLUEPRINT_COMPLETION_GATE_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-blueprint-completion',
    label: 'CLI exposes blueprint completion',
    target: 'zavorth blueprint-completion renders final blueprint status in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliBlueprintCompletionRenderer.ts',
      'tests/cli/ZavorthCliBlueprintCompletion.test.ts',
    ],
    needles: [
      'blueprint-completion',
      'blueprint-complete',
      'final-gate',
      'Blueprint Completion Gate - Final',
      'resolveBlueprintCompletionCliText',
      'formatBlueprintCompletionSnapshot',
    ],
  }),
  ruleContainsAcross({
    id: 'dashboard-projects-blueprint-completion',
    label: 'Dashboard projects blueprint completion',
    target: '/dashboard reads blueprintCompletionGate and renders final gates and safeguards',
    files: [
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/dashboardDashboardContracts.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/index.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/dashboardRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardControlShell.tsx',
      'tests/ai-gateway/dashboard/DashboardBlueprintCompletion.test.ts',
    ],
    needles: [
      'DashboardBlueprintCompletionGateSnapshot',
      'blueprintCompletionGate',
      'buildBlueprintCompletionGate',
      'mapBlueprintCompletionGate',
      'Blueprint Completion',
      'policy.noAutoExecute',
      'policy.noSkipApproval',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-blueprint-completion',
    label: 'package exposes final gate',
    target: 'local QA can run blueprint-completion:check and qa:blueprint-completion',
    files: ['package.json'],
    needles: [
      'blueprint-completion:check',
      'qa:blueprint-completion',
      'scripts/blueprint-completion-check.mjs',
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
  console.log('[blueprint-completion] checking final gate');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[blueprint-completion] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
