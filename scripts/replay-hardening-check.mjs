#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'replay-hardening-files',
    label: 'Wave 45 files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/RunArtifactReceiptReplayService.ts',
      'src/cli/ZavorthCliRunArtifactReceiptReplayRenderer.ts',
      'tests/runtime/agent/RunArtifactReceiptReplayService.test.ts',
      'tests/runtime/agent/AgentRunServiceRunArtifactReceiptReplay.test.ts',
      'tests/cli/ZavorthCliRunArtifactReceiptReplay.test.ts',
      'tests/ai-gateway/control/CommandCenterRunArtifactReceiptReplay.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'replay-hardening-contract',
    label: 'Replay contract consolidates run, artifacts and receipts',
    target: 'RunArtifactReceiptReplaySnapshot links RunObservatory, ArtifactMemory, MemoryWithReceipts and Wave 35-44 feature receipts',
    files: ['src/runtime/agent/RunArtifactReceiptReplayService.ts'],
    needles: [
      'RUN_ARTIFACT_RECEIPT_REPLAY_CONTRACT_VERSION',
      '2026-05-04.wave-45',
      'queryUniversalAgentRuns',
      'artifactMemory',
      'memoryWithReceipts',
      'universalIntentTrustEnforcement',
      'providerMeshConsolidation',
      'replayUsesReceiptsOnly',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-replay-hardening',
    label: 'Agent run publishes replay hardening',
    target: 'AgentRunService writes runArtifactReceiptReplay after artifact/memory snapshots and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceRunArtifactReceiptReplay.test.ts',
    ],
    needles: [
      'RunArtifactReceiptReplayService',
      'runArtifactReceiptReplay',
      'applyRunArtifactReceiptReplay',
      'RUN_ARTIFACT_RECEIPT_REPLAY_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-replay-hardening',
    label: 'CLI exposes replay hardening',
    target: 'zavorth replay renders frames, artifacts and receipts in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliRunArtifactReceiptReplayRenderer.ts',
      'tests/cli/ZavorthCliRunArtifactReceiptReplay.test.ts',
    ],
    needles: [
      'replay',
      'artifact-replay',
      'Run / Artifact / Receipt Replay Hardening - Wave 45',
      'resolveRunArtifactReceiptReplayCliText',
      'formatRunArtifactReceiptReplaySnapshot',
      'zavorth replay',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-replay-hardening',
    label: 'Command Center projects replay hardening',
    target: '/control reads runArtifactReceiptReplay and renders overview/docs surfaces',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterRunArtifactReceiptReplay.test.ts',
    ],
    needles: [
      'DashboardRunArtifactReceiptReplaySnapshot',
      'runArtifactReceiptReplay',
      'buildRunArtifactReceiptReplay',
      'mapRunArtifactReceiptReplay',
      'Replay Hardening',
      'summary.frameCount',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-replay-hardening-gate',
    label: 'package exposes Wave 45 gate',
    target: 'local QA can run replay-hardening:check and qa:replay-hardening',
    files: ['package.json'],
    needles: [
      'replay-hardening:check',
      'qa:replay-hardening',
      'scripts/replay-hardening-check.mjs',
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
  console.log('[replay-hardening] checking Wave 45');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[replay-hardening] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
