#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'source-agent-runtime-bridge-checkpoint-2-files',
    label: 'Preview engine files exist',
    target: 'contract, policy doctor, bridge adapters, service, command, tests and package scripts are present',
    files: [
      'src/contracts/SourceAgentRuntimeBridgeContract.ts',
      'src/services/SourceAgentRuntimeToolPolicyService.ts',
      'src/services/SourceAgentRuntimeBridgeService.ts',
      'src/adapters/claude/ClaudeCodeCliBridgeAdapter.ts',
      'src/adapters/claude/AcpxBridgeRuntimeAdapter.ts',
      'scripts/source-agent-runtime-bridge.ts',
      'tests/services/SourceAgentRuntimeBridgeService.test.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'source-agent-runtime-bridge-contract',
    label: 'Contract captures agent runtime bridge vocabulary',
    target: 'contract includes package evidence, bridge readiness, tool decisions and Preview engine snapshot',
    files: ['src/contracts/SourceAgentRuntimeBridgeContract.ts'],
    needles: [
      'ZAVORTH_SOURCE_AGENT_RUNTIME_BRIDGE_CONTRACT_VERSION',
      'SOURCE_AGENT_RUNTIME_PACKAGES',
      'SourceAgentRuntimePackageEvidence',
      'SourceAgentRuntimeBridgeReadiness',
      'SourceAgentRuntimeToolPolicyDoctorSnapshot',
      'SourceAgentRuntimeBridgePackSnapshot',
      'noAnthropicApiImpersonation',
    ],
  }),
  ruleContainsAll({
    id: 'source-agent-runtime-policy-doctor',
    label: 'Tool policy doctor gates write and shell tools',
    target: 'policy service classifies Claude tools and requires approval before writes or shell',
    files: ['src/services/SourceAgentRuntimeToolPolicyService.ts'],
    needles: [
      'SourceAgentRuntimeToolPolicyService',
      'ToolExposurePolicy',
      'writesAndShellRequireApproval',
      'Bash',
      'Write',
      'approval_required',
    ],
  }),
  ruleContainsAll({
    id: 'source-agent-runtime-bridge-service',
    label: 'Bridge service scans usage and emits readiness receipt',
    target: 'service scans Source and Zavorth package evidence, adapter guards, bridge readiness and config routes',
    files: ['src/services/SourceAgentRuntimeBridgeService.ts'],
    needles: [
      'buildSnapshot',
      'buildPackageEvidence',
      'buildAdapterGuards',
      '@anthropic-ai/claude-agent-sdk',
      '@anthropic-ai/claude-code',
      '@agentclientprotocol/claude-agent-acp',
      'Provider Mesh via Ollama',
      'Approval gate - Provider Mesh Expansion Pack',
    ],
  }),
  ruleContainsAll({
    id: 'source-agent-runtime-dry-run-bridges',
    label: 'Claude Code and ACPX are dry-run owner-gated bridges',
    target: 'bridge adapters expose readiness without live CLI or ACP execution',
    files: [
      'src/adapters/claude/ClaudeCodeCliBridgeAdapter.ts',
      'src/adapters/claude/AcpxBridgeRuntimeAdapter.ts',
    ],
    needles: [
      'owner_decision_required',
      'liveExecutionPerformed: false',
      'dryRunAvailable: true',
      'bypassPermissionsAllowed: false',
    ],
  }),
  ruleContainsAll({
    id: 'source-agent-runtime-package-scripts',
    label: 'package exposes Preview engine gates',
    target: 'operators can inspect, inspect JSON, run check and QA gate',
    files: ['package.json'],
    needles: [
      'source-agent-runtime-bridge',
      'source-agent-runtime-bridge:json',
      'source-agent-runtime-bridge:check',
      'qa:source-agent-runtime-bridge',
    ],
  }),
  runRuntimeRule(),
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
  console.log('[source-agent-runtime-bridge] checking Preview engine');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[source-agent-runtime-bridge] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 12)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runRuntimeRule() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/source-agent-runtime-bridge.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: 'source-agent-runtime-bridge-runtime-receipt',
      label: 'Runtime bridge receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'Preview engine command emits a passing bridge snapshot against the current Source checkout',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    return {
      id: 'source-agent-runtime-bridge-runtime-receipt',
      label: 'Runtime bridge receipt passes',
      status: receipt.status === 'passed' ? 'passed' : 'failed',
      observed: `status=${receipt.status}, bridgesReady=${receipt.summary?.bridgesReady}, ownerGated=${receipt.summary?.bridgesOwnerGated}`,
      target: 'Preview engine command emits a passing bridge snapshot against the current Source checkout',
      details: [
        `packagesPresentInSource=${receipt.summary?.packagesPresentInSource}`,
        `packagesImplementedInZavorth=${receipt.summary?.packagesImplementedInZavorth}`,
        `enabledByDefault=${receipt.summary?.enabledByDefault}`,
        `liveExecutionPerformed=${receipt.summary?.liveExecutionPerformed}`,
        `bypassPermissionsAllowed=${receipt.summary?.bypassPermissionsAllowed}`,
        `next=${receipt.commands?.nextStage}`,
      ],
    };
  } catch (error) {
    return {
      id: 'source-agent-runtime-bridge-runtime-receipt',
      label: 'Runtime bridge receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'Preview engine command emits a passing bridge snapshot against the current Source checkout',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
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

function compactDetails(...values) {
  return values
    .flatMap((value) => String(value || '').split(/\r?\n/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
