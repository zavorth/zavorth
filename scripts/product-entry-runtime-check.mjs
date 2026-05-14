#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'product-entry-runtime-files',
    label: 'Wave 47 files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/ProductEntryRuntimeService.ts',
      'src/cli/ZavorthCliProductEntryRuntimeRenderer.ts',
      'tests/runtime/agent/ProductEntryRuntimeService.test.ts',
      'tests/runtime/agent/AgentRunServiceProductEntryRuntime.test.ts',
      'tests/cli/ZavorthCliProductEntryRuntime.test.ts',
      'tests/ai-gateway/control/CommandCenterProductEntryRuntime.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'product-entry-runtime-contract',
    label: 'Product Entry Runtime contract exists',
    target: 'ProductEntryRuntimeService links first-run profile, personalization, onboarding, productization evidence and AgentGateway handoff',
    files: ['src/runtime/agent/ProductEntryRuntimeService.ts'],
    needles: [
      'PRODUCT_ENTRY_RUNTIME_CONTRACT_VERSION',
      '2026-05-04.wave-47',
      'FirstRunWorkspaceBootstrapProfileService',
      'FirstRunPersonalizationService',
      'FirstRunOnboardingContractService',
      'ProductizationEvidenceService',
      'handoff_to_agent_runtime',
      'needs_first_run',
      'firstRunStateSharedAcrossSurfaces',
      'noRuntimePersistentStart: true',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-publishes-product-entry-runtime',
    label: 'Agent run publishes product entry runtime',
    target: 'AgentRunService writes run.metadata.productEntryRuntime after Productization Evidence and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceProductEntryRuntime.test.ts',
    ],
    needles: [
      'ProductEntryRuntimeService',
      'productEntryRuntime',
      'applyProductEntryRuntime',
      'PRODUCT_ENTRY_RUNTIME_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-product-entry-runtime',
    label: 'CLI exposes product entry runtime',
    target: 'zavorth product-entry renders first-run state and handoff in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliProductEntryRuntimeRenderer.ts',
      'tests/cli/ZavorthCliProductEntryRuntime.test.ts',
    ],
    needles: [
      'product-entry',
      'first-run-runtime',
      'Product Entry Runtime / First Run - Wave 47',
      'resolveProductEntryRuntimeCliText',
      'formatProductEntryRuntimeSnapshot',
      'zavorth product-entry',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-product-entry-runtime',
    label: 'Command Center projects product entry runtime',
    target: '/control reads productEntryRuntime and renders first-run/handoff readiness',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterProductEntryRuntime.test.ts',
    ],
    needles: [
      'DashboardProductEntryRuntimeSnapshot',
      'productEntryRuntime',
      'buildProductEntryRuntime',
      'mapProductEntryRuntime',
      'Product Entry Runtime',
      'entry.handoffAllowed',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-product-entry-runtime-gate',
    label: 'package exposes Wave 47 gate',
    target: 'local QA can run product-entry:check and qa:product-entry',
    files: ['package.json'],
    needles: [
      'product-entry:check',
      'qa:product-entry',
      'scripts/product-entry-runtime-check.mjs',
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
  console.log('[product-entry] checking Wave 47');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[product-entry] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
