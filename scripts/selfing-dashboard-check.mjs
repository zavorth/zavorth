#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'selfing-dashboard-files',
    label: 'Selfing Dashboard files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/SelfingDashboardService.ts',
      'src/cli/ZavorthCliSelfingDashboardRenderer.ts',
      'tests/runtime/agent/SelfingDashboardService.test.ts',
      'tests/runtime/agent/AgentRunServiceSelfingDashboard.test.ts',
      'tests/cli/ZavorthCliSelfingDashboard.test.ts',
      'tests/ai-gateway/control/CommandCenterSelfingDashboard.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'selfing-dashboard-contract',
    label: 'Selfing Dashboard contract explains identity and memory',
    target: 'SelfingDashboardSnapshot includes cards, suggestions, receipts, policy and no-mutation guarantees',
    files: ['src/runtime/agent/SelfingDashboardService.ts'],
    needles: [
      'SELFING_DASHBOARD_CONTRACT_VERSION',
      '2026-05-03.selfing-dashboard',
      'SelfingDashboardCard',
      'SelfingDashboardSuggestion',
      'SelfingDashboardReceipt',
      'readOnlySnapshot',
      'noIdentityChanged',
      'changesRequirePreview',
      'changesAreVersioned',
      'memoryCorrectionsUseReceipts',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-selfing-dashboard',
    label: 'Agent run publishes Selfing Dashboard',
    target: 'AgentRunService writes run.metadata.selfingDashboard and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceSelfingDashboard.test.ts',
    ],
    needles: [
      'SelfingDashboardService',
      'selfingDashboard',
      'applySelfingDashboard',
      'SELFING_DASHBOARD_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-selfing-dashboard',
    label: 'CLI exposes Selfing Dashboard',
    target: 'zavorth selfing renders identity/memory cards in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliSelfingDashboardRenderer.ts',
      'tests/cli/ZavorthCliSelfingDashboard.test.ts',
    ],
    needles: [
      'selfing',
      'Selfing Dashboard - Selfing Dashboard',
      'resolveSelfingDashboardCliText',
      'formatSelfingDashboardSnapshot',
      'zavorth selfing',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-selfing-dashboard',
    label: 'Command Center projects Selfing Dashboard',
    target: '/control reads selfingDashboard from run metadata and renders it in dreams sector',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterSelfingDashboard.test.ts',
    ],
    needles: [
      'DashboardSelfingDashboardSnapshot',
      'selfingDashboard',
      'buildSelfingDashboard',
      'mapSelfingDashboard',
      'Selfing',
      'summary.cardCount',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-selfing-dashboard-gate',
    label: 'package exposes Selfing Dashboard gate',
    target: 'local QA can run selfing-dashboard:check and qa:selfing-dashboard',
    files: ['package.json'],
    needles: [
      'selfing-dashboard:check',
      'qa:selfing-dashboard',
      'scripts/selfing-dashboard-check.mjs',
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
  console.log('[selfing-dashboard] checking Selfing Dashboard');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[selfing-dashboard] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
