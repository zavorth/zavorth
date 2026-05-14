#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'productization-evidence-files',
    label: 'Wave 46 files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/ProductizationEvidenceService.ts',
      'src/cli/ZavorthCliProductizationEvidenceRenderer.ts',
      'tests/runtime/agent/ProductizationEvidenceService.test.ts',
      'tests/runtime/agent/AgentRunServiceProductizationEvidence.test.ts',
      'tests/cli/ZavorthCliProductizationEvidence.test.ts',
      'tests/ai-gateway/control/CommandCenterProductizationEvidence.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'productization-evidence-contract',
    label: 'Productization evidence contract exists',
    target: 'ProductizationEvidenceService links C9, replay hardening, release readiness, gates, surfaces and policy',
    files: ['src/runtime/agent/ProductizationEvidenceService.ts'],
    needles: [
      'PRODUCTIZATION_EVIDENCE_CONTRACT_VERSION',
      '2026-05-04.wave-46',
      'ZavorthProductizationContractService',
      'runArtifactReceiptReplay',
      'releaseReadiness',
      'noReleasePublished',
      'noInstallerExecuted',
      'stableRequiresRealRelease',
      'readyGateCount',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-publishes-productization-evidence',
    label: 'Agent run publishes productization evidence',
    target: 'AgentRunService writes run.metadata.productizationEvidence after replay hardening and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceProductizationEvidence.test.ts',
    ],
    needles: [
      'ProductizationEvidenceService',
      'productizationEvidence',
      'applyProductizationEvidence',
      'PRODUCTIZATION_EVIDENCE_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-productization-evidence',
    label: 'CLI exposes productization evidence',
    target: 'zavorth productization-evidence renders release readiness in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliProductizationEvidenceRenderer.ts',
      'tests/cli/ZavorthCliProductizationEvidence.test.ts',
    ],
    needles: [
      'productization-evidence',
      'release-readiness',
      'Productization Evidence & Release Readiness - Wave 46',
      'resolveProductizationEvidenceCliText',
      'formatProductizationEvidenceSnapshot',
      'zavorth productization-evidence',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-productization-evidence',
    label: 'Command Center projects productization evidence',
    target: '/control reads productizationEvidence and renders release readiness',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterProductizationEvidence.test.ts',
    ],
    needles: [
      'DashboardProductizationEvidenceSnapshot',
      'productizationEvidence',
      'buildProductizationEvidence',
      'mapProductizationEvidence',
      'Productization Evidence',
      'releaseReadiness.status',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-productization-evidence-gate',
    label: 'package exposes Wave 46 gate',
    target: 'local QA can run productization-evidence:check and qa:productization-evidence',
    files: ['package.json'],
    needles: [
      'productization-evidence:check',
      'qa:productization-evidence',
      'scripts/productization-evidence-check.mjs',
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
  console.log('[productization-evidence] checking Wave 46');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[productization-evidence] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
