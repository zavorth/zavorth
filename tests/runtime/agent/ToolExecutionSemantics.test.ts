import {
  ToolExecutionSemantics,
} from '../../../src/runtime/agent/index.js';

describe('ToolExecutionSemantics', () => {
  it('normalizes safe tool exposure into read-only execution semantics', () => {
    const semantics = new ToolExecutionSemantics();

    const decision = semantics.resolve({
      tool: {
        id: 'read_file',
        risk: 'safe',
        requiresApproval: false,
        description: 'Read a workspace file.',
      },
    });

    expect(decision).toEqual(expect.objectContaining({
      toolId: 'read_file',
      risk: 'safe',
      retryable: true,
      compensatable: false,
      requiresPreview: false,
      requiresApproval: false,
      rollbackStrategy: null,
      externalSideEffect: false,
      policyTags: expect.arrayContaining([
        'risk:safe',
        'retryable',
        'preview-not-required',
        'approval-not-required',
        'local-or-readonly',
      ]),
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      source: 'ToolExecutionSemantics',
      toolDescription: 'Read a workspace file.',
    }));
  });

  it('accepts snake case declarations from existing task and planner contracts', () => {
    const semantics = new ToolExecutionSemantics();

    const decision = semantics.resolve({
      toolId: 'release.promote',
      risk: 'attention',
      retryable: false,
      compensatable: true,
      requires_preview: true,
      requires_approval: true,
      rollback_strategy: 'release-rollback-preview',
      external_side_effect: true,
      metadata: {
        sourceContract: 'PlanContract',
      },
    });

    expect(decision).toEqual(expect.objectContaining({
      toolId: 'release.promote',
      risk: 'attention',
      retryable: false,
      compensatable: true,
      requiresPreview: true,
      requiresApproval: true,
      rollbackStrategy: 'release-rollback-preview',
      externalSideEffect: true,
      policyTags: expect.arrayContaining([
        'risk:attention',
        'not-retryable',
        'compensatable',
        'preview-required',
        'approval-required',
        'external-side-effect',
        'rollback:release-rollback-preview',
      ]),
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      source: 'ToolExecutionSemantics',
      sourceContract: 'PlanContract',
    }));
  });

  it('infers preview, approval and side effects for dangerous tools without executing them', () => {
    const semantics = new ToolExecutionSemantics();

    const decision = semantics.resolve({
      toolId: 'shell.exec',
      risk: 'danger',
    });

    expect(decision).toEqual(expect.objectContaining({
      toolId: 'shell.exec',
      risk: 'danger',
      retryable: false,
      compensatable: false,
      requiresPreview: true,
      requiresApproval: true,
      rollbackStrategy: null,
      externalSideEffect: true,
    }));
    expect(decision.policyTags).toEqual(expect.arrayContaining([
      'risk:danger',
      'preview-required',
      'approval-required',
      'external-side-effect',
    ]));
  });
});
