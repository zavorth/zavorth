import { ZavorthDynamicWorkflowService } from '../../src/services/ZavorthDynamicWorkflowService.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('ZavorthDynamicWorkflowService', () => {
  const now = () => new Date('2026-06-05T16:30:00.000Z');

  it('builds a governed wide workflow plan with cheap fanout and strong synthesis', () => {
    const service = new ZavorthDynamicWorkflowService({ now });

    const snapshot = service.buildPreview({
      objective: 'Analise 80 arquivos e sintetize os riscos principais usando token=secret-value',
      requestedFanout: 80,
      maxConcurrency: 12,
      maxCents: 75,
      workerModelClass: 'cheap',
      synthesisModelClass: 'premium',
    });

    expect(snapshot.contractVersion).toBe('zavorth-dynamic-workflows/1');
    expect(snapshot.status).toBe('needs-approval');
    expect(snapshot.objectivePreview).not.toContain('secret-value');
    expect(snapshot.scale.requestedFanout).toBe(80);
    expect(snapshot.scale.effectiveFanout).toBe(80);
    expect(snapshot.scale.maxConcurrency).toBe(12);
    expect(snapshot.routing.workers.modelClass).toBe('cheap');
    expect(snapshot.routing.synthesis.modelClass).toBe('premium');
    expect(snapshot.orchestration.arbitraryJavaScriptGenerated).toBe(false);
    expect(snapshot.orchestration.planFormat).toBe('zavorth-dynamic-workflow-plan/v1');
    expect(snapshot.orchestration.workerGroups.length).toBeGreaterThan(1);
    expect(snapshot.orchestration.synthesisStage.dependsOn).toEqual(
      expect.arrayContaining(snapshot.orchestration.workerGroups.map((group) => group.groupId)),
    );
    expect(snapshot.budget.status).toBe('approval-required');
    expect(snapshot.safety.noArbitraryCodeExecution).toBe(true);
    expect(snapshot.safety.budgetHardCapEnforced).toBe(true);
    expect(snapshot.surface.cliCommand).toContain('zavorth workflows');
  });

  it('blocks workflows that exceed fanout or budget caps before materialization', () => {
    const service = new ZavorthDynamicWorkflowService({ now });

    const snapshot = service.buildPreview({
      objective: 'Faça pesquisa massiva sem limite',
      requestedFanout: 500,
      maxConcurrency: 60,
      maxCents: 1,
      workerModelClass: 'premium',
      synthesisModelClass: 'premium',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockedReasons).toEqual(expect.arrayContaining([
      'requested fanout exceeds hard cap',
      'requested concurrency exceeds hard cap',
      'estimated cost exceeds approved budget',
    ]));
    expect(snapshot.materialization.ready).toBe(false);
  });

  it('uses practical defaults when fanout and concurrency are omitted', () => {
    const service = new ZavorthDynamicWorkflowService({ now });

    const snapshot = service.buildPreview({
      objective: 'Analise um pacote pequeno',
      maxCents: 50,
    });

    expect(snapshot.scale.requestedFanout).toBe(12);
    expect(snapshot.scale.effectiveFanout).toBe(12);
    expect(snapshot.scale.requestedConcurrency).toBe(6);
    expect(snapshot.scale.maxConcurrency).toBe(6);
  });

  it('materializes an approved preview into a Swarm V2 launch envelope without direct worker execution', () => {
    const launched: any[] = [];
    const service = new ZavorthDynamicWorkflowService({
      now,
      swarmLauncher: {
        launchSwarm(input: any) {
          launched.push(input);
          return {
            swarmId: input.swarmId,
            status: 'running',
            roles: input.roles,
            tokenBudget: input.tokenBudget,
          };
        },
      },
    });
    const snapshot = service.buildPreview({
      objective: 'Compare fornecedores e gere uma sintese final',
      requestedFanout: 24,
      maxConcurrency: 6,
      maxCents: 50,
      workerModelClass: 'cheap',
      synthesisModelClass: 'premium',
    });

    const blocked = service.materializeApprovedWorkflow(snapshot, {});
    const materialized = service.materializeApprovedWorkflow(snapshot, {
      approvalId: snapshot.approval.approvalId || 'approval-dynamic-workflow',
    });

    expect(blocked.status).toBe('blocked');
    expect(blocked.reason).toBe('approval required before materializing dynamic workflow');
    expect(materialized.status).toBe('materialized');
    expect(materialized.receiptId).toMatch(/^dynamic-workflow-receipt:/);
    expect(launched).toHaveLength(1);
    expect(launched[0]).toEqual(expect.objectContaining({
      official: true,
      maxRoles: 24,
      maxConcurrency: 6,
      tokenBudget: expect.objectContaining({
        modelClass: 'cheap',
        approved: true,
      }),
    }));
    expect(launched[0].swarmId).not.toContain(':');
    expect(launched[0].roles.every((role: any) => !role.id.includes(':'))).toBe(true);
    expect(launched[0].roles).toHaveLength(24);
    expect(materialized.safety.noDirectExecutionAuthority).toBe(true);
  });

  it('persists preview snapshots and launches them only with the matching approval id', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dynamic-workflows-'));
    const launched: any[] = [];
    const service = new ZavorthDynamicWorkflowService({
      now,
      storageDir: root,
      swarmLauncher: {
        launchSwarm(input: any) {
          launched.push(input);
          return {
            swarmId: input.swarmId,
            status: 'running',
            roles: input.roles,
            tokenBudget: input.tokenBudget,
          };
        },
      },
    });
    const snapshot = service.buildPreview({
      objective: 'Audite 32 arquivos usando token=secret-value',
      requestedFanout: 32,
      maxConcurrency: 8,
      maxCents: 80,
      workerModelClass: 'cheap',
      synthesisModelClass: 'premium',
    });

    const saved = service.savePreview(snapshot);
    const missingApproval = service.launchSavedWorkflow(snapshot.workflowId, {});
    const materialized = service.launchSavedWorkflow(snapshot.workflowId, {
      approvalId: snapshot.approval.approvalId,
    });
    const receiptFiles = fs.readdirSync(root).filter((file) => file.includes('receipt'));

    expect(saved.status).toBe('saved');
    expect(saved.path).toContain('dynamic-workflow_');
    expect(fs.readFileSync(saved.path, 'utf8')).not.toContain('secret-value');
    expect(missingApproval.status).toBe('blocked');
    expect(missingApproval.reason).toBe('approval required before materializing dynamic workflow');
    expect(materialized.status).toBe('materialized');
    expect(launched).toHaveLength(1);
    expect(receiptFiles.length).toBeGreaterThan(0);
    expect(fs.readFileSync(path.join(root, receiptFiles[0]), 'utf8')).not.toContain('secret-value');
  });
});
