#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-negotiation-files',
    label: 'Capability Negotiation files exist',
    target: 'Runtime, CLI, Command Center, tests and docs are present',
    files: [
      'src/runtime/agent/CapabilityNegotiationService.ts',
      'src/cli/ZavorthCliCapabilityNegotiationRenderer.ts',
      'tests/runtime/agent/CapabilityNegotiationService.test.ts',
      'tests/runtime/agent/AgentRunServiceCapabilityNegotiation.test.ts',
      'tests/cli/ZavorthCliCapabilityNegotiation.test.ts',
      'tests/ai-gateway/control/CommandCenterCapabilityNegotiation.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-negotiation-contract',
    label: 'Capability Negotiation contract explains scope',
    target: 'CapabilityNegotiationSnapshot includes capabilities, scope, proposal, receipts and policy',
    files: ['src/runtime/agent/CapabilityNegotiationService.ts'],
    needles: [
      'CAPABILITY_NEGOTIATION_CONTRACT_VERSION',
      '2026-05-03.capability-negotiation',
      'CapabilityNegotiationScope',
      'allowedToolIds',
      'blockedToolIds',
      'approvedScopeLimitsTools',
      'approvedScopeLimitsPaths',
      'noExecutionPerformed',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-capability-negotiation',
    label: 'Agent run gates sensitive scopes',
    target: 'AgentRunService writes run.metadata.capabilityNegotiation and creates approval before executor',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceCapabilityNegotiation.test.ts',
    ],
    needles: [
      'CapabilityNegotiationService',
      'capabilityNegotiation',
      'createCapabilityNegotiationProposalIfNeeded',
      'Aprovar escopo de capabilities',
      'CAPABILITY_NEGOTIATION_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-capability-negotiation',
    label: 'CLI exposes Capability Negotiation',
    target: 'zavorth negotiate renders negotiated capabilities in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliCapabilityNegotiationRenderer.ts',
      'tests/cli/ZavorthCliCapabilityNegotiation.test.ts',
    ],
    needles: [
      'negotiate',
      'Capability Negotiation - Capability Negotiation',
      'resolveCapabilityNegotiationCliText',
      'formatCapabilityNegotiationSnapshot',
      'zavorth negotiate',
    ],
  }),
  ruleContainsAcross({
    id: 'command-center-projects-capability-negotiation',
    label: 'Command Center projects Capability Negotiation',
    target: '/control reads capabilityNegotiation from run metadata and renders it in skills sector',
    files: [
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'tests/ai-gateway/control/CommandCenterCapabilityNegotiation.test.ts',
    ],
    needles: [
      'DashboardCapabilityNegotiationSnapshot',
      'capabilityNegotiation',
      'buildCapabilityNegotiation',
      'mapCapabilityNegotiation',
      'Capability Negotiation',
      'scope.allowedToolIds',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-capability-negotiation-gate',
    label: 'package exposes Capability Negotiation gate',
    target: 'local QA can run capability-negotiation:check and qa:capability-negotiation',
    files: ['package.json'],
    needles: [
      'capability-negotiation:check',
      'qa:capability-negotiation',
      'scripts/capability-negotiation-check.mjs',
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
  console.log('[capability-negotiation] checking Capability Negotiation');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-negotiation] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
