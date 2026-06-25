#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'provider-arena-files',
    label: 'Provider Arena files exist',
    target: 'Runtime, CLI, ZavorthControl, tests and docs are present',
    files: [
      'src/runtime/agent/ProviderArenaService.ts',
      'src/cli/ZavorthCliProviderArenaRenderer.ts',
      'tests/runtime/agent/ProviderArenaService.test.ts',
      'tests/runtime/agent/AgentRunServiceProviderArena.test.ts',
      'tests/cli/ZavorthCliProviderArena.test.ts',
      'tests/zavorth-control/zavorthControl/ZavorthControlProviderArena.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'provider-arena-contract',
    label: 'Provider Arena contract explains routing decision',
    target: 'ProviderArenaSnapshot includes candidates, decision source, receipts and read-only policy',
    files: ['src/runtime/agent/ProviderArenaService.ts'],
    needles: [
      'PROVIDER_ARENA_CONTRACT_VERSION',
      '2026-05-03.provider-arena',
      'ProviderArenaCandidate',
      'decisionSource',
      'noProviderExecutionPerformed',
      'usesRunObservatoryReceipts',
      'doesNotOverrideModelPicker',
      'secretsSerialized',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-provider-arena',
    label: 'Agent run attaches Provider Arena',
    target: 'AgentRunService writes run.metadata.providerArena using model picker, route and budget evidence',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceProviderArena.test.ts',
    ],
    needles: [
      'ProviderArenaService',
      'providerArena',
      'applyProviderArena',
      'PROVIDER_ARENA_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-provider-arena',
    label: 'CLI exposes Provider Arena',
    target: 'zavorth arena renders provider/model candidates in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliProviderArenaRenderer.ts',
      'tests/cli/ZavorthCliProviderArena.test.ts',
    ],
    needles: [
      'arena',
      'Provider Arena - Provider Arena',
      'resolveProviderArenaCliText',
      'formatProviderArenaSnapshot',
      'zavorth arena',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorthControl-projects-provider-arena',
    label: 'ZavorthControl projects Provider Arena',
    target: '/zavorthControl reads providerArena from run metadata and renders it in config sector',
    files: [
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/contracts/zavorthControlZavorthControlContracts.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthControlRuntimeProjection.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlControlShell.tsx',
      'tests/zavorth-control/zavorthControl/ZavorthControlProviderArena.test.ts',
    ],
    needles: [
      'ZavorthControlProviderArenaSnapshot',
      'providerArena',
      'buildProviderArena',
      'mapProviderArena',
      'Provider Arena',
      'summary.recommendedProviderLabel',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-provider-arena-gate',
    label: 'package exposes Provider Arena gate',
    target: 'local QA can run provider-arena:check and qa:provider-arena',
    files: ['package.json'],
    needles: [
      'provider-arena:check',
      'qa:provider-arena',
      'scripts/provider-arena-check.mjs',
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
  console.log('[provider-arena] checking Provider Arena');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[provider-arena] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
