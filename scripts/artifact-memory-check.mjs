#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'artifact-memory-files',
    label: 'Wave 38 files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/ArtifactMemoryService.ts',
      'src/cli/ZavorthCliArtifactMemoryRenderer.ts',
      'tests/runtime/agent/ArtifactMemoryService.test.ts',
      'tests/runtime/agent/AgentRunServiceArtifactMemory.test.ts',
      'tests/cli/ZavorthCliArtifactMemory.test.ts',
      'tests/ai-gateway/control/CommandCenterArtifactMemory.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'artifact-memory-contract',
    label: 'Artifact Memory contract indexes reusable artifacts',
    target: 'ArtifactMemorySnapshot includes entries, receipts, search, policy and citation guarantees',
    files: ['src/runtime/agent/ArtifactMemoryService.ts'],
    needles: [
      'ARTIFACT_MEMORY_CONTRACT_VERSION',
      '2026-05-03.wave-38',
      'ArtifactMemoryEntry',
      'ArtifactMemoryReceipt',
      'noArtifactContentInvented',
      'noFilesystemReadPerformed',
      'promotionRequiresExplicitAction',
      'reusedArtifactMustCiteOrigin',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-artifact-memory',
    label: 'Agent run publishes Artifact Memory',
    target: 'AgentRunService writes run.metadata.artifactMemory and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceArtifactMemory.test.ts',
    ],
    needles: [
      'ArtifactMemoryService',
      'artifactMemory',
      'applyArtifactMemory',
      'ARTIFACT_MEMORY_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-artifact-memory',
    label: 'CLI exposes Artifact Memory',
    target: 'zavorth artifact-memory renders reusable artifact index in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliArtifactMemoryRenderer.ts',
      'tests/cli/ZavorthCliArtifactMemory.test.ts',
    ],
    needles: [
      'artifact-memory',
      'Artifact Memory - Wave 38',
      'resolveArtifactMemoryCliText',
      'formatArtifactMemorySnapshot',
      'zavorth artifact-memory',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-artifact-memory',
    label: 'Command Center projects Artifact Memory',
    target: '/control reads artifactMemory from run metadata and renders it in dreams sector',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterArtifactMemory.test.ts',
    ],
    needles: [
      'DashboardArtifactMemorySnapshot',
      'artifactMemory',
      'buildArtifactMemory',
      'mapArtifactMemory',
      'Artifact Memory',
      'summary.memoryEntryCount',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-artifact-memory-gate',
    label: 'package exposes Wave 38 gate',
    target: 'local QA can run artifact-memory:check and qa:artifact-memory',
    files: ['package.json'],
    needles: [
      'artifact-memory:check',
      'qa:artifact-memory',
      'scripts/artifact-memory-check.mjs',
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
  console.log('[artifact-memory] checking Wave 38');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[artifact-memory] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
