#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'public-adoption-pilot-loop-files',
    label: 'Public Adoption Pilot files exist',
    target: 'Runtime, CLI, ZavorthControl, tests and docs are present',
    files: [
      'src/runtime/agent/PublicAdoptionPilotLoopService.ts',
      'src/cli/ZavorthCliPublicAdoptionPilotLoopRenderer.ts',
      'tests/runtime/agent/PublicAdoptionPilotLoopService.test.ts',
      'tests/runtime/agent/AgentRunServicePublicAdoptionPilotLoop.test.ts',
      'tests/cli/ZavorthCliPublicAdoptionPilotLoop.test.ts',
      'tests/ai-gateway/zavorthControl/ZavorthControlPublicAdoptionPilotLoop.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'public-adoption-pilot-loop-contract',
    label: 'Public Adoption Pilot Loop contract exists',
    target: 'PublicAdoptionPilotLoopService links feedback product loop and PilotLoopService without implicit collection',
    files: ['src/runtime/agent/PublicAdoptionPilotLoopService.ts'],
    needles: [
      'PUBLIC_ADOPTION_PILOT_LOOP_CONTRACT_VERSION',
      '2026-05-04.adoption-pilot',
      'FeedbackTelemetryProductLoopService',
      'PilotLoopService',
      'publicAdoptionPilotLoop',
      'noImplicitCollection: true',
      'noTelemetryEnabled: true',
      'noExternalSubmission: true',
      'noWorkspacePayloadStored: true',
      'zavorthControlAggregatedOnly: true',
      'pilotRequiresExplicitOwner: true',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-publishes-public-adoption-pilot-loop',
    label: 'Agent run publishes public adoption pilot loop',
    target: 'AgentRunService writes run.metadata.publicAdoptionPilotLoop after feedbackTelemetryProductLoop and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServicePublicAdoptionPilotLoop.test.ts',
    ],
    needles: [
      'PublicAdoptionPilotLoopService',
      'publicAdoptionPilotLoop',
      'applyPublicAdoptionPilotLoop',
      'PUBLIC_ADOPTION_PILOT_LOOP_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-public-adoption-pilot-loop',
    label: 'CLI exposes public adoption pilot loop',
    target: 'zavorth public-adoption-pilot-loop renders pilot readiness, ledger and zavorthControl in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliPublicAdoptionPilotLoopRenderer.ts',
      'tests/cli/ZavorthCliPublicAdoptionPilotLoop.test.ts',
    ],
    needles: [
      'public-adoption-pilot-loop',
      'pilot-loop-runtime',
      'pilot-feedback-loop',
      'Public Adoption / Pilot Feedback Loop - Public Adoption Pilot',
      'resolvePublicAdoptionPilotLoopCliText',
      'formatPublicAdoptionPilotLoopSnapshot',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorthControl-projects-public-adoption-pilot-loop',
    label: 'ZavorthControl projects public adoption pilot loop',
    target: '/zavorthControl reads publicAdoptionPilotLoop and renders pilot policy',
    files: [
      'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/contracts/zavorthControlZavorthControlContracts.ts',
      'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.ts',
      'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthControlRuntimeProjection.ts',
      'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlControlShell.tsx',
      'tests/ai-gateway/zavorthControl/ZavorthControlPublicAdoptionPilotLoop.test.ts',
    ],
    needles: [
      'ZavorthControlPublicAdoptionPilotLoopSnapshot',
      'publicAdoptionPilotLoop',
      'buildPublicAdoptionPilotLoop',
      'mapPublicAdoptionPilotLoop',
      'Public Adoption / Pilot Loop',
      'policy.noImplicitCollection',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-public-adoption-pilot-loop-gate',
    label: 'package exposes Public Adoption Pilot gate',
    target: 'local QA can run public-adoption-pilot-loop:check and qa:public-adoption-pilot-loop',
    files: ['package.json'],
    needles: [
      'public-adoption-pilot-loop:check',
      'qa:public-adoption-pilot-loop',
      'scripts/public-adoption-pilot-loop-check.mjs',
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
  console.log('[public-adoption-pilot-loop] checking Public Adoption Pilot');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[public-adoption-pilot-loop] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
