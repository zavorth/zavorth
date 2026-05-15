#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');

const rules = [
  filesExist('agent-os-files', [
    'src/contracts/AgentOsContract.ts',
    'src/services/ProjectDigitalTwinService.ts',
    'src/services/TransactionalExecutionService.ts',
    'src/services/AgentOsRollbackManagerService.ts',
    'src/services/ImpactSimulatorService.ts',
    'src/services/FutureComparatorService.ts',
    'src/services/PermissionBrokerService.ts',
    'src/services/AgentImmuneSystemService.ts',
    'src/services/ReputationScoreboardService.ts',
    'src/services/ArchitectureDecisionRecorder.ts',
    'src/services/ZavorthAgentOsService.ts',
    'scripts/agent-os-gate.ts',
    'tests/services/ZavorthAgentOsService.test.ts',
    'docs/README.md',
  ]),
  containsAll('agent-os-contract-invariants', ['src/contracts/AgentOsContract.ts'], [
    'AGENT_OS_CONTRACT_VERSION',
    'AgentOsProjectTwinSnapshot',
    'AgentOsTransactionalPlan',
    'AgentOsImpactSimulation',
    'AgentOsPermissionLease',
    'AgentOsImmuneSignal',
    'AgentOsReputationScore',
    'AgentOsArchitectureDecisionDraft',
    'AgentOsTransactionalCommitResult',
    'liveActionApplied: false',
    'rawSecretsSerialized: false',
    'thinkingBlocked: false',
  ]),
  containsAll('agent-os-services-security', [
    'src/services/ProjectDigitalTwinService.ts',
    'src/services/TransactionalExecutionService.ts',
    'src/services/AgentOsRollbackManagerService.ts',
    'src/services/ImpactSimulatorService.ts',
    'src/services/PermissionBrokerService.ts',
    'src/services/AgentImmuneSystemService.ts',
  ], [
    'project-twin-no-secret-content',
    'commitRequiresRiskGate: true',
    'workspaceWrites',
    'liveActionApplied: true',
    'Rollback bloqueado para evitar serializar conteudo sensivel.',
    'impact-simulation-no-side-effects',
    'permission-lease-hard-blocks-preserved',
    'immune-system-does-not-block-thinking',
  ]),
  containsAll('agent-os-futures-reputation-adr', [
    'src/services/FutureComparatorService.ts',
    'src/services/ReputationScoreboardService.ts',
    'src/services/ArchitectureDecisionRecorder.ts',
    'src/services/ZavorthAgentOsService.ts',
  ], [
    'rejected-futures-kept-as-receipts',
    'reputation-cannot-bypass-hard-blocks',
    'requiresTransactionRuntime: true',
    'agent-os-no-parallel-runtime',
    'AgentOsCommandCenterProjection',
  ]),
  containsAll('agent-os-gate-tests', [
    'scripts/agent-os-gate.ts',
    'tests/services/ZavorthAgentOsService.test.ts',
  ], [
    'project-twin-redacts-secrets',
    'simulation-no-side-effects',
    'transaction-no-live-apply',
    'governed-live-apply-needs-risk-gate',
    'governed-live-apply-with-rollback',
    'governed-live-rollback-restores-file',
    'permission-lease-hard-blocks',
    'rollback blocks secret-looking content',
  ]),
];

const gate = spawnSync(process.execPath, [tsxCli, 'scripts/agent-os-gate.ts', '--json'], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
});
rules.push({
  id: 'agent-os-dynamic-gate',
  status: gate.status === 0 ? 'passed' : 'failed',
  observed: gate.status === 0 ? 'dynamic gate passed' : `dynamic gate failed (${gate.status})`,
  details: gate.status === 0 ? [] : [gate.stdout, gate.stderr].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 30),
});

const failed = rules.filter((rule) => rule.status === 'failed');
const output = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: { rules: rules.length, passed: rules.length - failed.length, failed: failed.length },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log('[agent-os] checking release gate');
  for (const rule of rules) {
    console.log(`[agent-os] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.observed}`);
    for (const detail of rule.details || []) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function filesExist(id, files) {
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${files.length - missing.length}/${files.length} files present`,
    details: missing,
  };
}

function containsAll(id, files, needles) {
  const haystack = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  const missing = needles.filter((needle) => !haystack.includes(needle));
  return {
    id,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `missing ${missing.length} marker(s)` : 'all markers present',
    details: missing,
  };
}
