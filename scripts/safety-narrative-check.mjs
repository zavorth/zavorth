#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'safety-narrative-files',
    label: 'Safety Narrative files exist',
    target: 'Runtime, CLI, Dashboard, tests and docs are present',
    files: [
      'src/runtime/agent/SafetyNarrativeService.ts',
      'src/cli/ZavorthCliSafetyNarrativeRenderer.ts',
      'tests/runtime/agent/SafetyNarrativeService.test.ts',
      'tests/runtime/agent/AgentRunServiceSafetyNarrative.test.ts',
      'tests/cli/ZavorthCliSafetyNarrative.test.ts',
      'tests/ai-gateway/dashboard/DashboardSafetyNarrative.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'safety-narrative-contract',
    label: 'Safety Narrative contract explains blocks',
    target: 'Narrative provides reasons, alternatives, redaction and non-bypass policy',
    files: ['src/runtime/agent/SafetyNarrativeService.ts'],
    needles: [
      'SAFETY_NARRATIVE_CONTRACT_VERSION',
      '2026-05-03.safety-narrative',
      'highRiskBlockPresent',
      'alternativesDoNotExecute',
      'naturalLanguageDoesNotBypassPolicy',
      'rawSecretSerialized: false',
      'pathRedactionApplied',
      'nextSafeAction',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-safety-narrative',
    label: 'Agent run uses Safety Narrative',
    target: 'Approval, preview and block paths attach safetyNarrative to run metadata',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/SafetyNarrativeService.ts',
      'src/runtime/agent/index.ts',
    ],
    needles: [
      'SafetyNarrativeService',
      'safetyNarrative',
      'applySafetyNarrative',
      'Bloqueei por seguranca',
      'SAFETY_NARRATIVE_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-safety-narrative',
    label: 'CLI exposes Safety Narrative',
    target: 'zavorth safety renders reasons and safe alternatives in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliSafetyNarrativeRenderer.ts',
      'src/cli/ZavorthCliSurfaceHelpers.ts',
      'tests/cli/ZavorthCliSafetyNarrative.test.ts',
    ],
    needles: [
      'safety',
      'safety-narrative',
      'Safety Narrative - Safety Narrative',
      'resolveSafetyNarrativeCliText',
      'zavorth safety "<pedido>" [--json]',
    ],
  }),
  ruleContainsAcross({
    id: 'dashboard-projects-safety-narrative',
    label: 'Dashboard projects Safety Narrative',
    target: '/dashboard reads safetyNarrative from run metadata and renders reasons',
    files: [
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/dashboardDashboardContracts.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/dashboardRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardControlShell.tsx',
      'tests/ai-gateway/dashboard/DashboardSafetyNarrative.test.ts',
    ],
    needles: [
      'DashboardSafetyNarrativeSnapshot',
      'safetyNarrative',
      'buildSafetyNarrative',
      'mapSafetyNarrative',
      'visibleSafetyReasons',
      'Safety',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-safety-narrative-gate',
    label: 'package exposes Safety Narrative gate',
    target: 'local QA can run safety-narrative:check and qa:safety-narrative',
    files: ['package.json'],
    needles: [
      'safety-narrative:check',
      'qa:safety-narrative',
      'scripts/safety-narrative-check.mjs',
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
  console.log('[safety-narrative] checking Safety Narrative');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[safety-narrative] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
