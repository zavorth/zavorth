import { SharedSurfaceWorkflowGovernanceCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceWorkflowGovernanceCommandPack.js';
import { parseNaturalPermissionIntent, parseNaturalWorkflowIntent } from '../../src/domain/surface/presentation/shared-surface/workflow-governance/workflowGovernanceIntents.js';
import { formatPermissionListReply } from '../../src/domain/surface/presentation/shared-surface/workflow-governance/workflowGovernanceRenderers.js';

describe('SharedSurfaceWorkflowGovernanceCommandPack', () => {
  it('resolves a natural workflow resume intent against recent tasks', async () => {
    const workflowController = {
      handleWorkflow: jest.fn().mockResolvedValue(undefined),
    };
    const pack = new SharedSurfaceWorkflowGovernanceCommandPack({
      permissionService: null,
      selfModificationCommandService: null,
      workflowController,
      taskManager: {
        getRecentTasks: jest.fn().mockReturnValue([
          {
            command_type: '/workflow',
            raw_message: 'workflow review release hardening',
            result_summary: 'release hardening',
            error_summary: '',
            metadata: {
              workflow_run_id: 'wf-1234',
              workflow_label: 'release hardening',
              workflow_objective: 'release hardening',
              workflow_stage_id: '',
              workflow_resume_stage_id: '',
              workflow_stage_label: '',
              workflow_name: 'release hardening',
            },
          },
        ]),
      },
    });

    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      userId: '42',
    } as any;

    const handled = await pack.maybeHandleNaturalWorkflow(ctx, 'retomar workflow de release hardening');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(
      'Entendi que voce quer retomar o workflow mais relacionado a release hardening.',
    );
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(ctx, 'resume wf-1234');
  });

  it('parses natural permission and selfmod intents without changing command semantics', () => {
    expect(parseNaturalPermissionIntent('quero aprovar a permissao perm-abc123')).toEqual({
      command: 'approve',
      args: 'perm-abc123',
      intro: 'Entendi que voce quer aprovar a permissao perm-abc123.',
    });

    expect(parseNaturalWorkflowIntent('workflow review melhorar docs')).toEqual({
      args: 'review melhorar docs',
      intro: 'Entendi que voce quer abrir um workflow review para melhorar docs.',
    });

    expect(formatPermissionListReply([], 'pending')).toContain('Nenhuma permissao encontrada nesse filtro.');
  });
});
