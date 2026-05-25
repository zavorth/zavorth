#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'tool-rehearsal-files',
    label: 'Tool Rehearsal files exist',
    target: 'Runtime, CLI, Dashboard, tests and docs are present',
    files: [
      'src/runtime/agent/ToolRehearsalService.ts',
      'src/cli/ZavorthCliToolRehearsalRenderer.ts',
      'tests/runtime/agent/ToolRehearsalService.test.ts',
      'tests/runtime/agent/AgentRunServiceToolRehearsal.test.ts',
      'tests/cli/ZavorthCliToolRehearsal.test.ts',
      'tests/ai-gateway/dashboard/DashboardToolRehearsal.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'tool-rehearsal-contract',
    label: 'Tool Rehearsal contract explains dry-run calls',
    target: 'ToolRehearsalSnapshot includes calls, approximate args, adjustments, receipts and no-effect policy',
    files: ['src/runtime/agent/ToolRehearsalService.ts'],
    needles: [
      'TOOL_REHEARSAL_CONTRACT_VERSION',
      '2026-05-03.tool-rehearsal',
      'ToolRehearsalCall',
      'approximateArguments',
      'expectedOutput',
      'noToolExecuted',
      'noShellSpawned',
      'realExecutionLimitedToRehearsedScope',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-tool-rehearsal',
    label: 'Agent run gates execution with Tool Rehearsal',
    target: 'AgentRunService writes run.metadata.toolRehearsal and creates approval before executor',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceToolRehearsal.test.ts',
    ],
    needles: [
      'ToolRehearsalService',
      'toolRehearsal',
      'createToolRehearsalProposalIfNeeded',
      'Aprovar tool rehearsal',
      'TOOL_REHEARSAL_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-tool-rehearsal',
    label: 'CLI exposes Tool Rehearsal',
    target: 'zavorth rehearse renders simulated tool calls in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliToolRehearsalRenderer.ts',
      'tests/cli/ZavorthCliToolRehearsal.test.ts',
    ],
    needles: [
      'rehearse',
      'Tool Rehearsal - Tool Rehearsal',
      'resolveToolRehearsalCliText',
      'formatToolRehearsalSnapshot',
      'zavorth rehearse',
    ],
  }),
  ruleContainsAcross({
    id: 'dashboard-projects-tool-rehearsal',
    label: 'Dashboard projects Tool Rehearsal',
    target: '/dashboard reads toolRehearsal from run metadata and renders it in skills sector',
    files: [
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/dashboardDashboardContracts.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/dashboardRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardControlShell.tsx',
      'tests/ai-gateway/dashboard/DashboardToolRehearsal.test.ts',
    ],
    needles: [
      'DashboardToolRehearsalSnapshot',
      'toolRehearsal',
      'buildToolRehearsal',
      'mapToolRehearsal',
      'Tool Rehearsal',
      'summary.callCount',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-tool-rehearsal-gate',
    label: 'package exposes Tool Rehearsal gate',
    target: 'local QA can run tool-rehearsal:check and qa:tool-rehearsal',
    files: ['package.json'],
    needles: [
      'tool-rehearsal:check',
      'qa:tool-rehearsal',
      'scripts/tool-rehearsal-check.mjs',
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
  console.log('[tool-rehearsal] checking Tool Rehearsal');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[tool-rehearsal] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
