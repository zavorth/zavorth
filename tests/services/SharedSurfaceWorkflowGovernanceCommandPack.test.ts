import { SharedSurfaceWorkflowGovernanceCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceWorkflowGovernanceCommandPack.js';
import { parseExplicitSelfModificationIntent } from '../../src/domain/surface/presentation/shared-surface/workflow-governance/workflowGovernanceIntents.js';
import { formatPermissionListReply } from '../../src/domain/surface/presentation/shared-surface/workflow-governance/workflowGovernanceRenderers.js';

describe('SharedSurfaceWorkflowGovernanceCommandPack', () => {
  it('explicit selfmod prefix still parses; free-text natural intents removed', () => {
    expect(parseExplicitSelfModificationIntent('selfmod preview foo')).toEqual({
      args: 'preview foo',
      intro: 'Opening the guarded self-modification flow for Zavorth.',
    });
    expect(parseExplicitSelfModificationIntent('aprovar permissao xyz')).toBeNull();
    expect(formatPermissionListReply([], 'pending')).toContain('No permissions in this filter.');
  });

  it('slash /workflow still routes deterministically', async () => {
    const workflowController = {
      handleWorkflow: jest.fn().mockResolvedValue(undefined),
    };
    const pack = new SharedSurfaceWorkflowGovernanceCommandPack({
      permissionService: null,
      selfModificationCommandService: null,
      workflowController,
      taskManager: null,
    });
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      userId: '42',
    } as any;

    const handled = await pack.maybeHandleCommand(ctx, '/workflow', 'resume wf-1234');
    expect(handled).toBe(true);
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(ctx, 'resume wf-1234');
  });
});
