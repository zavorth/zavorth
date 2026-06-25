#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'run-observatory-contract-exists',
    label: 'Run Observatory contract exists',
    target: 'Run Observatory has a canonical runtime contract, focused tests and documentation',
    files: [
      'src/runtime/agent/RunObservatory.ts',
      'tests/runtime/agent/RunObservatoryProduct.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'run-observatory-run-observatory-fields',
    label: 'Run Observatory fields are explicit',
    target: 'Observatory exposes contractVersion, summary, health, receipts, sidecars, timeline, replay and surface payload',
    files: ['src/runtime/agent/RunObservatory.ts'],
    needles: [
      'RUN_OBSERVATORY_CONTRACT_VERSION',
      '2026-05-03.run-observatory',
      'UniversalAgentRunObservatoryReceipt',
      'UniversalAgentRunObservatoryTimelineEvent',
      'UniversalAgentRunObservatoryReplaySnapshot',
      'UniversalAgentRunObservatoryDiffPreview',
      'UniversalAgentRunObservatoryHealth',
      'UniversalAgentRunObservatorySidecars',
      'buildReceiptsForRun',
      'buildDiffPreviews',
      'buildTimeline',
      'buildReplay',
      'buildHealth',
      'buildSidecars',
      'surface: buildSurface',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-gateway-uses-observatory',
    label: 'Agent Gateway uses the canonical Observatory',
    target: 'ZavorthAgentGateway buildSnapshot/queryRuns still routes through queryUniversalAgentRuns',
    files: [
      'src/runtime/agent/ZavorthAgentGateway.ts',
      'src/runtime/agent/index.ts',
    ],
    needles: [
      'queryUniversalAgentRuns',
      'runObservatory',
      'RUN_OBSERVATORY_CONTRACT_VERSION',
      'UniversalAgentRunObservatoryReceipt',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorthControl-projects-run-observatory',
    label: 'ZavorthControl projects Run Observatory',
    target: '/zavorthControl preserves receipts, sidecars, timeline, replay and health from the runtime snapshot',
    files: [
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/contracts/zavorthControlZavorthControlContracts.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlRunObservatory.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlControlShell.tsx',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlOverviewSector.tsx',
      'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts',
      'tests/ai-gateway/zavorthControl/ZavorthControlRunObservatory.test.ts',
      'tests/services/WebAppRuntimeInteractionRouteService.test.ts',
    ],
    needles: [
      'ZavorthControlRunObservatoryReceipt',
      'timeline',
      'receipts',
      'sidecars',
      'diffPreviews',
      'replay',
      'health',
      'Run Observatory',
      'viewModel.runObservatory.receipts',
      'visibleDiffPreviews',
      'onApplyDiffPreview',
      '/api/web/agent-runs/apply-draft',
      'confirmOwnerControlledApply',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-run-observatory',
    label: 'CLI exposes Run Observatory',
    target: 'zavorth observatory renders the same snapshot in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliRunObservatoryRenderer.ts',
      'src/cli/ZavorthCliSurfaceHelpers.ts',
      'tests/cli/ZavorthCliRunObservatory.test.ts',
    ],
    needles: [
      'observatory',
      'runs',
      'formatRunObservatorySnapshot',
      'resolveRunObservatoryCliQuery',
      'zavorth observatory --json',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-run-observatory-gate',
    label: 'package exposes Run Observatory gate',
    target: 'local QA can run run-observatory:check and qa:run-observatory',
    files: ['package.json'],
    needles: [
      'run-observatory:check',
      'qa:run-observatory',
      'scripts/run-observatory-check.mjs',
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
  console.log('[run-observatory] checking Run Observatory');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[run-observatory] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
