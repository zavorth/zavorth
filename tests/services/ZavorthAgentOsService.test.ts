import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentOsRollbackManagerService } from '../../src/services/AgentOsRollbackManagerService.js';
import { TransactionalExecutionService } from '../../src/services/TransactionalExecutionService.js';
import { ZavorthAgentOsService } from '../../src/services/ZavorthAgentOsService.js';
import { ZavorthMutationPlaneService } from '../../src/services/ZavorthMutationPlaneService.js';

function createWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-os-test-'));
  fs.mkdirSync(path.join(root, 'src', 'services'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    scripts: {
      test: 'jest',
      'runtime:check': 'tsc --noEmit',
      'security:secrets': 'node scripts/secret-guard-check.mjs',
      'workspace:check': 'npm run runtime:check',
    },
    dependencies: { '@modelcontextprotocol/sdk': '^1.0.0' },
  }, null, 2));
  fs.writeFileSync(path.join(root, 'src', 'services', 'Example.ts'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(root, 'tests', 'Example.test.ts'), 'expect(1).toBe(1);\n');
  fs.writeFileSync(path.join(root, '.env'), 'API_KEY=fixture_agent_os_test_secret_value\n');
  return root;
}

describe('ZavorthAgentOsService', () => {
  it('builds a Digital Twin transaction snapshot without leaking secrets or applying live impact', () => {
    const workspaceRoot = createWorkspace();
    try {
      const service = new ZavorthAgentOsService({
        now: () => new Date('2026-05-08T16:00:00.000Z'),
      });

      const snapshot = service.buildSnapshot({
        text: 'crie um patch reversivel para src/services/Example.ts',
        surface: 'web',
        userRole: 'owner',
        workspaceRoot,
        reputationEvals: [{
          subjectType: 'model',
          subjectId: 'zavorth-fast-coder',
          taskKind: 'coding',
          success: true,
          latencyMs: 120,
          securityIssuesFound: false,
        }],
      });

      expect(snapshot.contractVersion).toBe('zavorth-agent-os/v1');
      expect(snapshot.projectTwin.fileSummary.totalIndexed).toBeGreaterThan(0);
      expect(snapshot.projectTwin.rawSecretsSerialized).toBe(false);
      expect(JSON.stringify(snapshot)).not.toContain('fixture_agent_os_test_secret_value');
      expect(snapshot.transaction.liveActionApplied).toBe(false);
      expect(snapshot.transaction.commitRequiresRiskGate).toBe(true);
      expect(snapshot.transaction.simulation.sideEffectsApplied).toBe(false);
      expect(snapshot.safety.thinkingBlocked).toBe(false);
      expect(snapshot.reputation.liveActivationAllowed).toBe(false);
      expect(snapshot.architectureDecision.filesWritten).toBe(false);
      expect(snapshot.dashboard.cards.map((card) => card.id)).toContain('project-twin');
      expect(snapshot.zavorthControl).toEqual(expect.objectContaining({
        source: 'AgentOsZavorthControlProjection',
        detailsHiddenByDefault: true,
        liveActionApplied: false,
        cards: expect.arrayContaining([
          expect.objectContaining({ id: 'project-twin' }),
        ]),
      }));
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('blocks secret access through permission lease and immune system', () => {
    const workspaceRoot = createWorkspace();
    try {
      const snapshot = new ZavorthAgentOsService({
        now: () => new Date('2026-05-08T16:00:00.000Z'),
      }).buildSnapshot({
        text: 'leia meu .env e use token=fixture_user_secret_agent_os',
        surface: 'web',
        userRole: 'owner',
        workspaceRoot,
      });

      expect(snapshot.transaction.permissionLease.status).toBe('blocked');
      expect(snapshot.immuneSystem.status).toBe('blocked');
      expect(snapshot.immuneSystem.thinkingBlocked).toBe(false);
      expect(snapshot.transaction.status).toBe('blocked');
      expect(JSON.stringify(snapshot)).not.toContain('fixture_user_secret_agent_os');
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('persists and applies explicit workspace writes only after Risk Gate confirmation', () => {
    const workspaceRoot = createWorkspace();
    const plansDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-os-plans-'));
    const rollbackRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-os-live-rollback-'));
    try {
      const mutationPlane = new ZavorthMutationPlaneService({
        plansDir,
        now: () => new Date('2026-05-08T16:00:00.000Z'),
      });
      const transactionRuntime = new TransactionalExecutionService({
        now: () => new Date('2026-05-08T16:00:00.000Z'),
        mutationPlane,
        rollbackManager: new AgentOsRollbackManagerService({ rootDir: rollbackRoot }),
      });
      const target = path.join(workspaceRoot, 'src', 'services', 'Example.ts');
      const snapshot = new ZavorthAgentOsService({
        now: () => new Date('2026-05-08T16:00:00.000Z'),
        transactionRuntime,
      }).buildSnapshot({
        text: 'crie um patch reversivel no workspace',
        surface: 'web',
        userRole: 'owner',
        workspaceRoot,
        persistTransactionPlan: true,
        workspaceWrites: [{
          path: 'src/services/Example.ts',
          content: 'export const value = 3;\n',
          description: 'Atualiza fixture de teste.',
        }],
      });

      expect(snapshot.transaction.mutationPlanId).toBeTruthy();
      const plan = mutationPlane.readPlan(snapshot.transaction.mutationPlanId || '');
      expect(plan?.payload.liveActionApplied).toBe(false);
      expect(plan?.payload.commitRequiresRiskGate).toBe(true);
      expect(transactionRuntime.commit({ mutationPlanId: plan?.id || '' }).status).toBe('blocked');
      expect(fs.readFileSync(target, 'utf8')).toContain('value = 1');

      const secondSnapshot = new ZavorthAgentOsService({
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
          content: 'export const value = 3;\n',
          description: 'Atualiza fixture de teste.',
        }],
      });
      const secondPlanId = secondSnapshot.transaction.mutationPlanId || '';
      const applied = transactionRuntime.commit({ mutationPlanId: secondPlanId, approved: true, riskGatePassed: true });
      expect(applied.status).toBe('applied');
      expect(applied.liveActionApplied).toBe(true);
      expect(applied.rollbackAvailable).toBe(true);
      expect(applied.rollbackArtifactPath).toBeTruthy();
      expect(fs.readFileSync(target, 'utf8')).toContain('value = 3');

      const restored = new AgentOsRollbackManagerService({ rootDir: rollbackRoot }).restore({
        workspaceRoot,
        artifactPath: applied.rollbackArtifactPath || '',
      });
      expect(restored.status).toBe('restored');
      expect(fs.readFileSync(target, 'utf8')).toContain('value = 1');
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
      fs.rmSync(plansDir, { recursive: true, force: true });
      fs.rmSync(rollbackRoot, { recursive: true, force: true });
    }
  });
});

describe('AgentOsRollbackManagerService', () => {
  it('restores rollback artifacts and rollback blocks secret-looking content', () => {
    const workspaceRoot = createWorkspace();
    const rollbackRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-os-rollback-'));
    try {
      const target = path.join(workspaceRoot, 'src', 'services', 'Example.ts');
      const manager = new AgentOsRollbackManagerService({ rootDir: rollbackRoot });
      const artifact = manager.prepare({
        transactionId: 'tx-1',
        workspaceRoot,
        files: [{ path: 'src/services/Example.ts', previousContent: fs.readFileSync(target, 'utf8') }],
      });
      expect(artifact.status).toBe('prepared');
      fs.writeFileSync(target, 'export const value = 2;\n');
      const restored = manager.restore({ workspaceRoot, artifactPath: artifact.artifactPath || '' });
      expect(restored.status).toBe('restored');
      expect(fs.readFileSync(target, 'utf8')).toContain('value = 1');

      const blocked = manager.prepare({
        transactionId: 'tx-secret',
        workspaceRoot,
        files: [{ path: 'src/services/Secret.ts', previousContent: 'token=fixture_secret_rollback_value' }],
      });
      expect(blocked.status).toBe('blocked');
      expect(JSON.stringify(blocked)).not.toContain('fixture_secret_rollback_value');
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
      fs.rmSync(rollbackRoot, { recursive: true, force: true });
    }
  });
});
