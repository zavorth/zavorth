#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const jestBin = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');

const rules = [
  ruleFilesExist({
    id: 'agent-team-compiler-files',
    label: 'Channel mesh0 files exist',
    target: 'Runtime, CLI, ZavorthControl, tests and docs are present',
    files: [
      'src/runtime/agent/AgentTeamCompilerService.ts',
      'src/cli/ZavorthCliAgentTeamCompilerRenderer.ts',
      'tests/runtime/agent/AgentTeamCompilerService.test.ts',
      'tests/runtime/agent/AgentRunServiceAgentTeamCompiler.test.ts',
      'tests/cli/ZavorthCliAgentTeamCompiler.test.ts',
      'tests/zavorth-control/zavorthControl/ZavorthControlAgentTeamCompiler.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'agent-team-compiler-contract',
    label: 'Agent Team Compiler contract compiles governed roles',
    target: 'AgentTeamCompilerSnapshot includes roles, topology, receipts, policy and approval guarantees',
    files: ['src/runtime/agent/AgentTeamCompilerService.ts'],
    needles: [
      'AGENT_TEAM_COMPILER_CONTRACT_VERSION',
      '2026-05-03.track-40',
      'AgentTeamCompilerRole',
      'AgentTeamCompilerReceipt',
      'noSubagentsLaunched',
      'approvalRequiredBeforeLaunch',
      'budgetsDefaultToZero',
      'providerSelectionIsAdvisory',
      'launchApprovedTeam',
      'peerReviewRequiredBeforeSynthesis',
      'mutationRequiresSubagentGateway',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-agent-team-compiler',
    label: 'Agent run publishes Agent Team Compiler',
    target: 'AgentRunService writes run.metadata.agentTeamCompiler and exports the contract',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceAgentTeamCompiler.test.ts',
    ],
    needles: [
      'AgentTeamCompilerService',
      'agentTeamCompiler',
      'applyAgentTeamCompiler',
      'AGENT_TEAM_COMPILER_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-agent-team-compiler',
    label: 'CLI exposes Agent Team Compiler',
    target: 'zavorth agent-team renders compiled roles in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliAgentTeamCompilerRenderer.ts',
      'tests/cli/ZavorthCliAgentTeamCompiler.test.ts',
    ],
    needles: [
      'agent-team',
      'Agent Team Compiler - Channel mesh0',
      'resolveAgentTeamCompilerCliText',
      'formatAgentTeamCompilerSnapshot',
      'zavorth agent-team',
      'formatAgentTeamCompilerLaunchResult',
      'resolveAgentTeamCompilerApprovalId',
    ],
  }),
  ruleCommandPasses({
    id: 'agent-team-launch-tests-pass',
    label: 'Agent Team launch protocol tests pass',
    target: 'Approved launch prepares a review board, blocks missing approval and keeps execution projection-only',
    command: process.execPath,
    args: [
      jestBin,
      'tests/runtime/agent/AgentTeamCompilerService.test.ts',
      'tests/cli/ZavorthCliAgentTeamCompiler.test.ts',
      '--runInBand',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorthControl-projects-agent-team-compiler',
    label: 'ZavorthControl projects Agent Team Compiler',
    target: '/zavorthControl reads agentTeamCompiler from run metadata and renders it in overview/config surfaces',
    files: [
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/contracts/zavorthControlZavorthControlContracts.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthControlRuntimeProjection.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlControlShell.tsx',
      'tests/zavorth-control/zavorthControl/ZavorthControlAgentTeamCompiler.test.ts',
    ],
    needles: [
      'ZavorthControlAgentTeamCompilerSnapshot',
      'agentTeamCompiler',
      'buildAgentTeamCompiler',
      'mapAgentTeamCompiler',
      'Agent Team Compiler',
      'summary.roleCount',
      'approvalId',
      'directToolExecution',
      'synthesisRequired',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-agent-team-compiler-gate',
    label: 'package exposes Channel mesh0 gate',
    target: 'local QA can run agent-team-compiler:check and qa:agent-team-compiler',
    files: ['package.json'],
    needles: [
      'agent-team-compiler:check',
      'qa:agent-team-compiler',
      'scripts/agent-team-compiler-check.mjs',
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
  console.log('[agent-team-compiler] checking Channel mesh0');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[agent-team-compiler] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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

function ruleCommandPasses(input) {
  const result = spawnSync(input.command, input.args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = `${result.error ? `${result.error.message}\n` : ''}${result.stdout || ''}\n${result.stderr || ''}`.trim();
  return {
    id: input.id,
    label: input.label,
    status: result.status === 0 ? 'passed' : 'failed',
    observed: `exit ${result.status}`,
    target: input.target,
    details: result.status === 0 ? [] : output.split(/\r?\n/).slice(0, 12),
  };
}
