#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'cross-channel-continuity-files',
    label: 'Channel mesh1 files exist',
    target: 'Runtime, CLI, ZavorthControl, tests and docs are present',
    files: [
      'src/runtime/agent/CrossChannelContinuityService.ts',
      'src/cli/ZavorthCliCrossChannelContinuityRenderer.ts',
      'tests/runtime/agent/CrossChannelContinuityService.test.ts',
      'tests/runtime/agent/AgentRunServiceCrossChannelContinuity.test.ts',
      'tests/cli/ZavorthCliCrossChannelContinuity.test.ts',
      'tests/zavorth-control/zavorthControl/ZavorthControlCrossChannelContinuity.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'cross-channel-continuity-contract',
    label: 'Cross-Channel Continuity contract preserves session handoff',
    target: 'CrossChannelContinuitySnapshot includes channels, handoffs, receipts and no-send policy',
    files: ['src/runtime/agent/CrossChannelContinuityService.ts'],
    needles: [
      'CROSS_CHANNEL_CONTINUITY_CONTRACT_VERSION',
      '2026-05-03.cross-channel',
      'CrossChannelContinuityChannel',
      'CrossChannelContinuityHandoff',
      'noCrossChannelMessageSent',
      'noSessionForkCreated',
      'approvalRequiredForChannelSwitch',
      'sameGatewayRequired',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-cross-channel-continuity',
    label: 'Agent run publishes Cross-Channel Continuity',
    target: 'AgentRunService writes run.metadata.crossChannelContinuity and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceCrossChannelContinuity.test.ts',
    ],
    needles: [
      'CrossChannelContinuityService',
      'crossChannelContinuity',
      'applyCrossChannelContinuity',
      'CROSS_CHANNEL_CONTINUITY_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-cross-channel-continuity',
    label: 'CLI exposes Cross-Channel Continuity',
    target: 'zavorth continuity renders channel continuity in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliCrossChannelContinuityRenderer.ts',
      'tests/cli/ZavorthCliCrossChannelContinuity.test.ts',
    ],
    needles: [
      'continuity',
      'Cross-Channel Continuity - Channel mesh1',
      'resolveCrossChannelContinuityCliText',
      'formatCrossChannelContinuitySnapshot',
      'zavorth continuity',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorthControl-projects-cross-channel-continuity',
    label: 'ZavorthControl projects Cross-Channel Continuity',
    target: '/zavorthControl reads crossChannelContinuity from run metadata and renders it in overview/channels surfaces',
    files: [
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/contracts/zavorthControlZavorthControlContracts.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthControlRuntimeProjection.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlControlShell.tsx',
      'tests/zavorth-control/zavorthControl/ZavorthControlCrossChannelContinuity.test.ts',
    ],
    needles: [
      'ZavorthControlCrossChannelContinuitySnapshot',
      'crossChannelContinuity',
      'buildCrossChannelContinuity',
      'mapCrossChannelContinuity',
      'Cross-Channel Continuity',
      'summary.channelCount',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-cross-channel-continuity-gate',
    label: 'package exposes Channel mesh1 gate',
    target: 'local QA can run cross-channel-continuity:check and qa:cross-channel-continuity',
    files: ['package.json'],
    needles: [
      'cross-channel-continuity:check',
      'qa:cross-channel-continuity',
      'scripts/cross-channel-continuity-check.mjs',
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
  console.log('[cross-channel-continuity] checking Channel mesh1');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[cross-channel-continuity] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
