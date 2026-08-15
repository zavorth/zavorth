import { AgentRunService, ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-${++index}`;
}

describe('AgentRunService selfmod escalation', () => {
  it('turns natural selfmod.preview requests into preview-first results through the existing service', async () => {
    const executor = jest.fn();
    const createGoalPreview = jest.fn().mockResolvedValue({
      success: true,
      mode: 'goal',
      previewId: 'goal-preview-1',
      traceId: 'trace-selfmod',
      runId: 'run-selfmod',
      sessionId: 'telegram:42',
      artifactId: 'goal-preview-1',
      summary: 'Preview de auto melhoria preparado.',
      changeCount: 2,
      validationPlan: ['npm test'],
      execution_lifecycle: [
        {
          kind: 'plan',
          status: 'planned',
          source: 'selfmod',
        },
      ],
    });
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T11:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      selfModificationService: { createGoalPreview } as any,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:42',
      text: 'proponha uma auto melhoria segura para o Zavorth',
      requestedTools: ['selfmod.preview'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(createGoalPreview).toHaveBeenCalledWith('proponha uma auto melhoria segura para o Zavorth', 'operator');
    expect(result.run).toEqual(
      expect.objectContaining({
        status: 'completed',
        summary: 'Preview de auto melhoria preparado.',
        approvals: [],
        artifacts: [
          expect.objectContaining({
            id: 'goal-preview-1',
            kind: 'diff',
            status: 'ready',
          }),
        ],
        toolExposure: expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              id: 'selfmod.preview',
              group: 'selfmod',
              risk: 'attention',
              requiresApproval: false,
              policyTags: expect.arrayContaining(['preview-first']),
            }),
          ]),
        }),
        metadata: expect.objectContaining({
          selfModificationPreview: expect.objectContaining({
            source: 'SelfModificationCommandService',
            operation: 'preview',
            success: true,
            previewId: 'goal-preview-1',
            changeCount: 2,
            applyServiceCalled: false,
            rollbackServiceCalled: false,
            previewFirst: true,
          }),
        }),
      }),
    );
    expect(result.replies[0].text).toContain('Preview: goal-preview-1');
    expect(result.replies[0].text).toContain('Apply was not executed');
  });

  it('routes discovered selfmod.preview intent before generic capability negotiation', async () => {
    const executor = jest.fn();
    const createGoalPreview = jest.fn().mockResolvedValue({
      success: true,
      mode: 'goal',
      previewId: 'natural-goal-preview-1',
      traceId: 'trace-natural-selfmod',
      runId: 'run-natural-selfmod',
      sessionId: 'telegram:42',
      artifactId: 'natural-goal-preview-1',
      summary: 'Preview natural de selfmod preparado.',
      changeCount: 1,
      validationPlan: ['npm test'],
      execution_lifecycle: [],
    });
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T11:02:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      selfModificationService: { createGoalPreview } as any,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:42',
      text: 'proponha uma auto melhoria segura para o Zavorth',
      requestedTools: ['selfmod.preview'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(createGoalPreview).toHaveBeenCalledTimes(1);
    expect(result.run.status).toBe('completed');
    expect(result.run.metadata.naturalCapabilityDiscovery).toEqual(
      expect.objectContaining({
        recommendedToolNames: expect.arrayContaining(['selfmod.preview']),
      }),
    );
    expect(result.run.metadata.capabilityNegotiation).toBeUndefined();
    expect(result.run.metadata.selfModificationPreview).toEqual(
      expect.objectContaining({
        previewId: 'natural-goal-preview-1',
        previewFirst: true,
      }),
    );
  });

  it('keeps selfmod.apply behind approval instead of generating or applying a preview directly', async () => {
    const executor = jest.fn();
    const createGoalPreview = jest.fn();
    const applyPreview = jest.fn();
    const rollbackChangeSet = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T11:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      selfModificationService: { createGoalPreview, applyPreview, rollbackChangeSet } as any,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:42',
      text: 'aplique o preview de selfmod goal-preview-1',
      requestedTools: ['selfmod.apply'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(createGoalPreview).not.toHaveBeenCalled();
    expect(applyPreview).not.toHaveBeenCalled();
    expect(rollbackChangeSet).not.toHaveBeenCalled();
    expect(result.run).toEqual(
      expect.objectContaining({
        status: 'waiting_approval',
        summary: 'Proposal for selfmod.apply awaiting approval.',
        toolExposure: expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              id: 'selfmod.apply',
              group: 'selfmod',
              risk: 'danger',
              requiresApproval: true,
              policyTags: expect.arrayContaining(['preview-required']),
            }),
          ]),
        }),
        metadata: expect.objectContaining({
          selfModificationActionProposal: expect.objectContaining({
            source: 'AgentRunService',
            operation: 'apply',
            toolId: 'selfmod.apply',
            targetId: 'goal-preview-1',
            targetField: 'previewId',
            directExecution: false,
            applyServiceCalled: false,
            rollbackServiceCalled: false,
            approvalCreated: true,
          }),
        }),
      }),
    );
    expect(result.run.approvals).toEqual([
      expect.objectContaining({
        title: 'Approve proposed selfmod.apply',
        risk: 'danger',
        status: 'pending',
      }),
    ]);
    expect(result.replies[0].text).toContain('Proposal for selfmod.apply prepared.');
    expect(result.replies[0].text).toContain('Apply/rollback was not executed');
  });

  it('turns natural selfmod.rollback into an approval proposal over an existing changeset', async () => {
    const createGoalPreview = jest.fn();
    const applyPreview = jest.fn();
    const rollbackChangeSet = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T11:10:00.000Z'),
      idFactory: createIdFactory(),
      selfModificationService: { createGoalPreview, applyPreview, rollbackChangeSet } as any,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:42',
      text: 'reverta o changeset change-123 com seguranca',
      requestedTools: ['selfmod.rollback'],
    });

    expect(createGoalPreview).not.toHaveBeenCalled();
    expect(applyPreview).not.toHaveBeenCalled();
    expect(rollbackChangeSet).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.metadata.selfModificationActionProposal).toEqual(
      expect.objectContaining({
        operation: 'rollback',
        toolId: 'selfmod.rollback',
        targetId: 'change-123',
        targetField: 'changeId',
        directExecution: false,
        applyServiceCalled: false,
        rollbackServiceCalled: false,
      }),
    );
    expect(result.run.approvals[0]).toEqual(
      expect.objectContaining({
        title: 'Approve proposed selfmod.rollback',
        risk: 'danger',
        status: 'pending',
      }),
    );
    expect(result.replies[0].text).toContain('Alvo: changeId change-123');
  });

  it('records approval for natural selfmod.apply without executing applyPreview', async () => {
    const createGoalPreview = jest.fn();
    const applyPreview = jest.fn();
    const rollbackChangeSet = jest.fn();
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T11:15:00.000Z'),
      idFactory: createIdFactory(),
      selfModificationService: { createGoalPreview, applyPreview, rollbackChangeSet } as any,
    });

    const pending = await gateway.handle({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:42',
      text: 'aplique o preview goal-preview-2',
      requestedTools: ['selfmod.apply'],
    });
    const approved = await gateway.approve(pending.run.approvals[0].id);

    expect(applyPreview).not.toHaveBeenCalled();
    expect(rollbackChangeSet).not.toHaveBeenCalled();
    expect(approved?.run.status).toBe('completed');
    expect(approved?.run.summary).toContain('direct execution was not performed');
    expect(approved?.run.metadata.selfModificationActionProposal).toEqual(
      expect.objectContaining({
        operation: 'apply',
        targetId: 'goal-preview-2',
        approvalOnly: true,
        directExecution: false,
        applyServiceCalled: false,
        rollbackServiceCalled: false,
      }),
    );
    expect(approved?.replies[0].text).toContain('Use the existing owner/trusted flow');
  });
});
