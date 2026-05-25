#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'universal-preview-files',
    label: 'Universal Preview files exist',
    target: 'Runtime, CLI, Dashboard, tests and docs are present',
    files: [
      'src/runtime/agent/UniversalPreviewModeService.ts',
      'src/cli/ZavorthCliUniversalPreviewRenderer.ts',
      'tests/runtime/agent/UniversalPreviewModeService.test.ts',
      'tests/runtime/agent/AgentRunServiceUniversalPreviewMode.test.ts',
      'tests/cli/ZavorthCliUniversalPreview.test.ts',
      'tests/ai-gateway/dashboard/DashboardUniversalPreviewMode.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'universal-preview-contract',
    label: 'Preview contract is non-executing',
    target: 'Preview exposes plan, risk, safety, receipts and next safe action without execution',
    files: ['src/runtime/agent/UniversalPreviewModeService.ts'],
    needles: [
      'UNIVERSAL_PREVIEW_MODE_CONTRACT_VERSION',
      '2026-05-03.universal-preview',
      'planSteps',
      'noExecutionPerformed',
      'naturalLanguageDoesNotBypassPolicy',
      'executorBlockedInPreviewMode',
      'toolsActuallyCalled: []',
      'nextSafeAction',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-preview',
    label: 'Agent run uses Universal Preview',
    target: 'Runs store preview snapshots and preview-only requests short-circuit before execution',
    files: [
      'src/runtime/agent/AgentRunFactory.ts',
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
    ],
    needles: [
      'UniversalPreviewModeService',
      'universalPreviewMode',
      'createUniversalPreviewResultIfRequested',
      'Universal Preview Mode',
      'UNIVERSAL_PREVIEW_MODE_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-preview',
    label: 'CLI exposes Universal Preview',
    target: 'zavorth preview renders a Universal Preview snapshot in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliUniversalPreviewRenderer.ts',
      'src/cli/ZavorthCliSurfaceHelpers.ts',
      'tests/cli/ZavorthCliUniversalPreview.test.ts',
    ],
    needles: [
      'preview',
      'universal-preview',
      'Universal Preview Mode - Universal Preview',
      'resolveUniversalPreviewCliText',
      'zavorth preview "<pedido>" [--json]',
    ],
  }),
  ruleContainsAcross({
    id: 'dashboard-projects-preview',
    label: 'Dashboard projects Universal Preview',
    target: '/dashboard reads universalPreviewMode from run metadata and renders plan steps',
    files: [
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/dashboardDashboardContracts.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/dashboardRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardControlShell.tsx',
      'tests/ai-gateway/dashboard/DashboardUniversalPreviewMode.test.ts',
    ],
    needles: [
      'DashboardUniversalPreviewModeSnapshot',
      'universalPreviewMode',
      'buildUniversalPreviewMode',
      'mapUniversalPreviewMode',
      'visiblePreviewSteps',
      'Preview',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-preview-gate',
    label: 'package exposes Universal Preview gate',
    target: 'local QA can run universal-preview:check and qa:universal-preview',
    files: ['package.json'],
    needles: [
      'universal-preview:check',
      'qa:universal-preview',
      'scripts/universal-preview-mode-check.mjs',
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
  console.log('[universal-preview] checking Universal Preview');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[universal-preview] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
