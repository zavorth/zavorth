#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'memory-with-receipts-files',
    label: 'Memory Receipts files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/MemoryWithReceiptsService.ts',
      'src/cli/ZavorthCliMemoryWithReceiptsRenderer.ts',
      'tests/runtime/agent/MemoryWithReceiptsService.test.ts',
      'tests/runtime/agent/AgentRunServiceMemoryWithReceipts.test.ts',
      'tests/cli/ZavorthCliMemoryWithReceipts.test.ts',
      'tests/ai-gateway/control/CommandCenterMemoryWithReceipts.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'memory-with-receipts-contract',
    label: 'Memory With Receipts contract exposes provenance',
    target: 'Memory receipts include source, confidence, observatory linkage and forget/correct actions',
    files: ['src/runtime/agent/MemoryWithReceiptsService.ts'],
    needles: [
      'MEMORY_WITH_RECEIPTS_CONTRACT_VERSION',
      '2026-05-03.memory-receipts',
      'sourceQuestionHint',
      'allMemoryHasReceipt',
      'runObservatoryLinked',
      'noMemoryInvented: true',
      'forgetCommand',
      'correctCommand',
      'queryUniversalAgentRuns',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-memory-with-receipts',
    label: 'Agent run attaches Memory With Receipts',
    target: 'AgentRunService writes run.metadata.memoryWithReceipts after createRun and executor memory signals',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceMemoryWithReceipts.test.ts',
    ],
    needles: [
      'MemoryWithReceiptsService',
      'memoryWithReceipts',
      'applyMemoryWithReceipts',
      'MEMORY_WITH_RECEIPTS_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-memory-with-receipts',
    label: 'CLI exposes Memory With Receipts',
    target: 'zavorth memory receipts renders source/correct/forget in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistrySessions.ts',
      'src/cli/ZavorthCliMemoryWithReceiptsRenderer.ts',
      'tests/cli/ZavorthCliMemoryWithReceipts.test.ts',
    ],
    needles: [
      'memory receipts',
      'Memory With Receipts - Memory Receipts',
      'resolveMemoryWithReceiptsCliText',
      'formatMemoryWithReceiptsSnapshot',
      'zavorth memory source',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-memory-with-receipts',
    label: 'Command Center projects Memory With Receipts',
    target: '/control reads memoryWithReceipts from run metadata and renders provenance in dreams sector',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterMemoryWithReceipts.test.ts',
    ],
    needles: [
      'DashboardMemoryWithReceiptsSnapshot',
      'memoryWithReceipts',
      'buildMemoryWithReceipts',
      'mapMemoryWithReceipts',
      'sourceQuestionHint',
      'receipts reais',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-memory-with-receipts-gate',
    label: 'package exposes Memory Receipts gate',
    target: 'local QA can run memory-with-receipts:check and qa:memory-with-receipts',
    files: ['package.json'],
    needles: [
      'memory-with-receipts:check',
      'qa:memory-with-receipts',
      'scripts/memory-with-receipts-check.mjs',
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
  console.log('[memory-with-receipts] checking Memory Receipts');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[memory-with-receipts] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
