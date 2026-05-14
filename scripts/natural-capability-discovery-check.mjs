#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'natural-capability-discovery-files',
    label: 'Wave 29 files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/NaturalCapabilityDiscoveryService.ts',
      'src/cli/ZavorthCliCapabilityDiscoveryRenderer.ts',
      'tests/runtime/agent/NaturalCapabilityDiscoveryService.test.ts',
      'tests/runtime/agent/AgentRunServiceNaturalCapabilityDiscovery.test.ts',
      'tests/cli/ZavorthCliCapabilityDiscovery.test.ts',
      'tests/ai-gateway/control/CommandCenterNaturalCapabilityDiscovery.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'natural-capability-discovery-contract',
    label: 'Discovery contract is policy-only',
    target: 'Discovery returns tool hints, safety envelope, quarantine and receipts without execution',
    files: ['src/runtime/agent/NaturalCapabilityDiscoveryService.ts'],
    needles: [
      'NATURAL_CAPABILITY_DISCOVERY_CONTRACT_VERSION',
      '2026-05-03.wave-29',
      'toolHintProfile',
      'noExecutionPerformed',
      'naturalLanguageDoesNotBypassPolicy',
      'quarantine',
      'recommendedToolNames',
      'buildReceipts',
      'nextSafeAction',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-discovery',
    label: 'Agent run uses discovery',
    target: 'Natural language hints feed ToolExposurePolicy and run metadata',
    files: [
      'src/runtime/agent/AgentRunFactory.ts',
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
    ],
    needles: [
      'NaturalCapabilityDiscoveryService',
      'mergeToolHintProfiles',
      'naturalCapabilityDiscovery',
      'ToolExposurePolicy',
      'NATURAL_CAPABILITY_DISCOVERY_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-discovery',
    label: 'CLI exposes discovery',
    target: 'zavorth discover renders the same snapshot as text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliCapabilityDiscoveryRenderer.ts',
      'src/cli/ZavorthCliSurfaceHelpers.ts',
      'tests/cli/ZavorthCliCapabilityDiscovery.test.ts',
    ],
    needles: [
      'discover',
      'capability-discovery',
      'Natural Capability Discovery - Wave 29',
      'resolveCapabilityDiscoveryCliText',
      'zavorth discover "<pedido>" [--json]',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-discovery',
    label: 'Command Center projects discovery',
    target: '/control reads capabilityDiscovery from runtime metadata and renders recommendations',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterNaturalCapabilityDiscovery.test.ts',
    ],
    needles: [
      'DashboardNaturalCapabilityDiscoverySnapshot',
      'capabilityDiscovery',
      'buildNaturalCapabilityDiscovery',
      'mapNaturalCapabilityDiscovery',
      'visibleDiscoveryRecommendations',
      'Discovery',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-discovery-gate',
    label: 'package exposes Wave 29 gate',
    target: 'local QA can run natural-capability-discovery:check and qa:natural-capability-discovery',
    files: ['package.json'],
    needles: [
      'natural-capability-discovery:check',
      'qa:natural-capability-discovery',
      'scripts/natural-capability-discovery-check.mjs',
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
  console.log('[natural-capability-discovery] checking Wave 29');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[natural-capability-discovery] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
