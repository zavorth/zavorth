import {
  HotContextAssembler,
} from '../../../src/runtime/agent/index.js';

describe('HotContextAssembler', () => {
  it('delegates to the canonical assembler with a forced hot profile', () => {
    const assemble = jest.fn((input) => ({
      sessionId: input.sessionId,
      userId: input.userId,
      channel: input.channel,
      traceId: input.traceId,
      workspace: input.workspace,
      continuityPrompt: input.hot.continuityPrompt,
      summaryPrompt: input.hot.summaryPrompt,
      canonicalSessionPrompt: input.hot.canonicalSessionPrompt,
      workspacePrompt: null,
      memoryPrompt: null,
      skillPrompt: null,
      mcpSnapshot: null,
      profile: {
        id: 'hot-context',
        depth: 'hot',
        includeHot: true,
        includeWarm: false,
        includeCold: false,
        reason: 'forced hot',
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
      metadata: {
        ...input.metadata,
        contextProfile: 'hot-context',
        contextDepth: 'hot',
        contextLayers: ['hot'],
        toolExposureGatedByContextProfile: false,
      },
    }));
    const assembler = new HotContextAssembler({
      canonicalAssembler: {
        assemble,
      },
    });

    const snapshot = assembler.assemble({
      sessionId: 'web:hot-context',
      userId: 'grey',
      channel: 'web',
      traceId: 'trace-hot',
      workspace: 'C:/repo/Zavorth',
      hot: {
        continuityPrompt: 'Continuidade recente.',
        summaryPrompt: 'Resumo curto.',
        canonicalSessionPrompt: 'Session canonica.',
        recentEvents: [
          {
            kind: 'input',
          },
        ],
      },
      metadata: {
        source: 'test',
      },
    });

    expect(assemble).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'web:hot-context',
      profile: 'hot',
      hot: expect.objectContaining({
        continuityPrompt: 'Continuidade recente.',
      }),
      metadata: expect.objectContaining({
        source: 'test',
        hotContextSource: 'HotContextAssembler',
      }),
    }));
    expect(snapshot.hot.continuityPrompt).toBe('Continuidade recente.');
    expect(snapshot.canonical.profile).toEqual(expect.objectContaining({
      depth: 'hot',
      includeWarm: false,
      includeCold: false,
      gatesToolExposure: false,
    }));
    expect(snapshot.canonical.workspacePrompt).toBeNull();
    expect(snapshot.canonical.memoryPrompt).toBeNull();
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      source: 'CanonicalSessionContextAssembler',
      layer: 'hot',
      required: true,
      includesWarm: false,
      includesCold: false,
      toolExposureGatedByHotContext: false,
    }));
  });

  it('builds a hot-only canonical snapshot without optional warm or cold context', () => {
    const assembler = new HotContextAssembler();

    const snapshot = assembler.assemble({
      sessionId: 'cli:empty-hot',
      channel: 'cli',
    });

    expect(snapshot.hot).toEqual({
      continuityPrompt: null,
      summaryPrompt: null,
      canonicalSessionPrompt: null,
      recentEvents: [],
      metadata: {},
    });
    expect(snapshot.canonical).toEqual(expect.objectContaining({
      sessionId: 'cli:empty-hot',
      channel: 'cli',
      workspacePrompt: null,
      memoryPrompt: null,
      skillPrompt: null,
      mcpSnapshot: null,
    }));
    expect(snapshot.canonical.warm).toBeUndefined();
    expect(snapshot.canonical.cold).toBeUndefined();
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      contextDepth: 'hot',
      contextLayers: ['hot'],
      required: true,
      toolExposureGatedByContextProfile: false,
      toolExposureGatedByHotContext: false,
    }));
  });
});
