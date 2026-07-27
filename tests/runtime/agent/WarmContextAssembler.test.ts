import {
  WarmContextAssembler,
} from '../../../src/runtime/agent/index.js';

describe('WarmContextAssembler', () => {
  it('delegates to the canonical assembler with a forced warm profile', () => {
    const assemble = jest.fn((input) => ({
      sessionId: input.sessionId,
      userId: input.userId,
      channel: input.channel,
      traceId: input.traceId,
      workspace: input.workspace,
      continuityPrompt: input.hot.continuityPrompt,
      summaryPrompt: input.hot.summaryPrompt,
      canonicalSessionPrompt: input.hot.canonicalSessionPrompt,
      workspacePrompt: input.warm.workspacePrompt,
      memoryPrompt: null,
      skillPrompt: null,
      mcpSnapshot: null,
      profile: {
        id: 'warm-context',
        depth: 'warm',
        includeHot: true,
        includeWarm: true,
        includeCold: false,
        reason: 'forced warm',
        suggestedBy: 'test',
        gatesToolExposure: false,
      },
      hot: {
        continuityPrompt: input.hot.continuityPrompt,
        summaryPrompt: input.hot.summaryPrompt,
        canonicalSessionPrompt: input.hot.canonicalSessionPrompt,
        recentEvents: input.hot.recentEvents,
        metadata: input.hot.metadata || {},
      },
      warm: {
        workspacePrompt: input.warm.workspacePrompt,
        workspaceProfile: input.warm.workspaceProfile || null,
        identityFiles: input.warm.identityFiles || [],
        metadata: input.warm.metadata || {},
      },
      metadata: {
        ...input.metadata,
        contextProfile: 'warm-context',
        contextDepth: 'warm',
        contextLayers: ['hot', 'warm'],
        toolExposureGatedByContextProfile: false,
      },
    }));
    const assembler = new WarmContextAssembler({
      canonicalAssembler: {
        assemble,
      },
    });

    const snapshot = assembler.assemble({
      sessionId: 'web:warm-context',
      userId: 'grey',
      channel: 'web',
      traceId: 'trace-warm',
      workspace: 'C:/repo/Zavorth',
      hot: {
        continuityPrompt: 'Continuidade recente.',
        summaryPrompt: 'Resumo curto.',
        canonicalSessionPrompt: 'Session canonical.',
        recentEvents: [
          {
            kind: 'input',
          },
        ],
      },
      warm: {
        workspacePrompt: 'Workspace carregado.',
        workspaceProfile: {
          workspaceName: 'Zavorth',
        },
      },
      metadata: {
        source: 'test',
      },
    });

    expect(assemble).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'web:warm-context',
      profile: 'warm',
      hot: expect.objectContaining({
        continuityPrompt: 'Continuidade recente.',
      }),
      warm: expect.objectContaining({
        workspacePrompt: 'Workspace carregado.',
      }),
      metadata: expect.objectContaining({
        source: 'test',
        warmContextSource: 'WarmContextAssembler',
      }),
    }));
    expect(snapshot.warm.workspacePrompt).toBe('Workspace carregado.');
    expect(snapshot.canonical.profile).toEqual(expect.objectContaining({
      depth: 'warm',
      includeWarm: true,
      includeCold: false,
      gatesToolExposure: false,
    }));
    expect(snapshot.canonical.memoryPrompt).toBeNull();
    expect(snapshot.canonical.cold).toBeUndefined();
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      source: 'CanonicalSessionContextAssembler',
      layer: 'warm',
      required: false,
      includesWarm: true,
      includesCold: false,
      toolExposureGatedByWarmContext: false,
    }));
  });

  it('builds a warm canonical snapshot without optional cold context', () => {
    const assembler = new WarmContextAssembler();

    const snapshot = assembler.assemble({
      sessionId: 'web:empty-warm',
      channel: 'web',
      hot: {
        canonicalSessionPrompt: 'Canonical session ready.',
      },
      warm: {
        workspacePrompt: 'Workspace carregado.',
        workspaceProfile: {
          workspaceName: 'Zavorth',
        },
        identityFiles: [
          {
            path: 'IDENTITY.md',
            exists: true,
            summary: 'Identidade operacional existente.',
          },
          {
            path: 'MISSING.md',
            exists: false,
          },
        ],
      },
    });

    expect(snapshot.hot).toEqual(expect.objectContaining({
      canonicalSessionPrompt: 'Canonical session ready.',
      recentEvents: [],
      metadata: {},
    }));
    expect(snapshot.warm).toEqual(expect.objectContaining({
      workspacePrompt: 'Workspace carregado.',
      workspaceProfile: {
        workspaceName: 'Zavorth',
      },
      identityFiles: [
        {
          path: 'IDENTITY.md',
          exists: true,
          content: null,
          summary: 'Identidade operacional existente.',
        },
      ],
      metadata: {},
    }));
    expect(snapshot.canonical).toEqual(expect.objectContaining({
      sessionId: 'web:empty-warm',
      channel: 'web',
      workspacePrompt: 'Workspace carregado.',
      memoryPrompt: null,
      skillPrompt: null,
      mcpSnapshot: null,
    }));
    expect(snapshot.canonical.cold).toBeUndefined();
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      contextDepth: 'warm',
      contextLayers: ['hot', 'warm'],
      required: false,
      toolExposureGatedByContextProfile: false,
      toolExposureGatedByWarmContext: false,
    }));
  });
});
