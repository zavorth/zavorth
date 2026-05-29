#!/usr/bin/env tsx
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentOsRollbackManagerService } from '../src/services/AgentOsRollbackManagerService.js';
import { TransactionalExecutionService } from '../src/services/TransactionalExecutionService.js';
import { ZavorthAgentOsService } from '../src/services/ZavorthAgentOsService.js';
import { ZavorthMutationPlaneService } from '../src/services/ZavorthMutationPlaneService.js';

type Rule = {
  id: string;
  status: 'passed' | 'failed';
  observed: string;
};

const asJson = process.argv.includes('--json');
const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-os-gate-'));
const plansDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-os-gate-plans-'));
const rollbackRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-os-gate-rollback-'));

try {
  fs.mkdirSync(path.join(workspaceRoot, 'src', 'services'), { recursive: true });
  fs.mkdirSync(path.join(workspaceRoot, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, 'package.json'), JSON.stringify({
    scripts: {
      test: 'jest',
      'runtime:check': 'tsc --noEmit',
      'workspace:check': 'npm run runtime:check',
      'security:secrets': 'node scripts/secret-guard-check.mjs',
    },
    dependencies: { '@modelcontextprotocol/sdk': '1.0.0' },
  }, null, 2));
  fs.writeFileSync(path.join(workspaceRoot, 'src', 'services', 'Example.ts'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(workspaceRoot, 'tests', 'Example.test.ts'), 'expect(1).toBe(1);\n');
  fs.writeFileSync(path.join(workspaceRoot, '.env'), 'API_KEY=fixture_redaction_value_should_not_leak\n');

  const mutationPlane = new ZavorthMutationPlaneService({
    plansDir,
    now: () => new Date('2026-05-08T16:00:00.000Z'),
  });
  const transactionRuntime = new TransactionalExecutionService({
    now: () => new Date('2026-05-08T16:00:00.000Z'),
    mutationPlane,
    rollbackManager: new AgentOsRollbackManagerService({ rootDir: rollbackRoot }),
  });
  const targetFile = path.join(workspaceRoot, 'src', 'services', 'Example.ts');
  const snapshot = new ZavorthAgentOsService({
    now: () => new Date('2026-05-08T16:00:00.000Z'),
    transactionRuntime,
  }).buildSnapshot({
    text: 'crie um patch reversivel no workspace e nao leia token=fixture_user_secret_value',
    surface: 'web',
    userRole: 'owner',
    workspaceRoot,
    persistTransactionPlan: true,
    workspaceWrites: [{
      path: 'src/services/Example.ts',
      content: 'export const value = 42;\n',
      description: 'Agent OS gate reversible write.',
    }],
  });
  const blockedCommit = transactionRuntime.commit({ mutationPlanId: snapshot.transaction.mutationPlanId || '' });
  const safeSnapshot = new ZavorthAgentOsService({
    now: () => new Date('2026-05-08T16:00:01.000Z'),
    transactionRuntime,
  }).buildSnapshot({
    text: 'crie um patch reversivel no workspace',
    surface: 'web',
    userRole: 'owner',
    workspaceRoot,
    persistTransactionPlan: true,
    workspaceWrites: [{
      path: 'src/services/Example.ts',
      content: 'export const value = 43;\n',
      description: 'Agent OS gate reversible apply.',
    }],
  });
  const appliedCommit = transactionRuntime.commit({
    mutationPlanId: safeSnapshot.transaction.mutationPlanId || '',
    approved: true,
    riskGatePassed: true,
  });
  const restored = new AgentOsRollbackManagerService({ rootDir: rollbackRoot }).restore({
    workspaceRoot,
    artifactPath: appliedCommit.rollbackArtifactPath || '',
  });

  const serialized = JSON.stringify(snapshot);
  const rules: Rule[] = [
    rule('contract-version', snapshot.contractVersion === 'zavorth-agent-os/v1', snapshot.contractVersion),
    rule('project-twin-redacts-secrets', !serialized.includes('fixture_redaction_value_should_not_leak') && !serialized.includes('fixture_user_secret_value'), 'raw secrets absent'),
    rule('simulation-no-side-effects', snapshot.transaction.simulation.sideEffectsApplied === false, String(snapshot.transaction.simulation.sideEffectsApplied)),
    rule('transaction-no-live-apply', snapshot.transaction.liveActionApplied === false && snapshot.transaction.commitRequiresRiskGate === true, snapshot.transaction.status),
    rule('permission-lease-hard-blocks', snapshot.transaction.permissionLease.hardBlocksPreserved === true, snapshot.transaction.permissionLease.status),
    rule('immune-system-does-not-block-thinking', snapshot.immuneSystem.thinkingBlocked === false, snapshot.immuneSystem.cautionLevel),
    rule('reputation-cannot-activate-live', snapshot.reputation.liveActivationAllowed === false && snapshot.reputation.hardBlocksCanBeOverridden === false, `${snapshot.reputation.scores.length} score(s)`),
    rule('adr-is-draft-only', snapshot.architectureDecision.status === 'draft' && snapshot.architectureDecision.filesWritten === false, snapshot.architectureDecision.id),
    rule('zavorthControl-projection', snapshot.zavorthControl.cards.length >= 4 && snapshot.zavorthControl.actions.length >= 3, snapshot.zavorthControl.title),
    rule('governed-live-apply-needs-risk-gate', blockedCommit.status === 'blocked' && fs.readFileSync(targetFile, 'utf8').includes('value = 1'), blockedCommit.summary),
    rule('governed-live-apply-with-rollback', appliedCommit.status === 'applied' && appliedCommit.liveActionApplied === true && Boolean(appliedCommit.rollbackArtifactPath), appliedCommit.summary),
    rule('governed-live-rollback-restores-file', restored.status === 'restored' && fs.readFileSync(targetFile, 'utf8').includes('value = 1'), restored.summary),
  ];

  const failed = rules.filter((entry) => entry.status === 'failed');
  const report = {
    generatedAt: new Date().toISOString(),
    status: failed.length > 0 ? 'failed' : 'passed',
    summary: { rules: rules.length, failed: failed.length },
    rules,
  };

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write('[agent-os] checking release gate\n');
    for (const entry of rules) {
      process.stdout.write(`[agent-os] ${entry.status === 'passed' ? 'ok' : 'fail'} ${entry.id}: ${entry.observed}\n`);
    }
  }

  process.exitCode = failed.length > 0 ? 1 : 0;
} finally {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
  fs.rmSync(plansDir, { recursive: true, force: true });
  fs.rmSync(rollbackRoot, { recursive: true, force: true });
}

function rule(id: string, passed: boolean, observed: string): Rule {
  return { id, status: passed ? 'passed' : 'failed', observed };
}
