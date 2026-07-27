import { SharedSurfaceMemoryCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceMemoryCommandPack';

function buildCtx(rawText = '/memory') {
  return {
    platform: 'telegram',
    userId: 'telegram-user',
    chatId: 'telegram:chat-1',
    isGroup: false,
    rawText,
    reply: jest.fn(async () => undefined),
    editMessage: jest.fn(async () => undefined),
  };
}

function buildMemoryPlaneSnapshot(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-04-15T12:00:00.000Z',
    summary: {
      persistedMemories: 2,
      relevantMemories: 1,
      replayTasks: 1,
      workflowRuns: 1,
      artifacts: 1,
      workspaceSignals: 0,
      timelineEvents: 1,
      historicalEvents: 0,
      changedFacts: 0,
    },
    memory: {
      recent: [],
      relevant: [
        {
          key: 'gateway',
          value: 'Gateway ready para smoke.',
          category: 'runtime',
          updatedAt: '2026-04-15T12:00:00.000Z',
        },
      ],
      categories: ['runtime'],
      vectorRecall: false,
    },
    timeline: {
      recent: [],
      conflicts: [],
      latestHistoricalAt: null,
    },
    replay: null,
    artifacts: {
      recent: [
        {
          id: 'artifact-1',
          label: 'Build report',
          summary: 'Build verde.',
          path: 'artifacts/build.md',
        },
      ],
      kinds: ['report'],
      latestLabel: 'Build report',
      reusableCount: 1,
    },
    workspace: null,
    suggestedActions: [
      {
        id: 'resume',
        label: 'Abrir replay',
        command: '/sessionhistory latest',
        reason: 'Resume the last execution.',
        kind: 'resume',
      },
    ],
    narrative: {
      headline: 'Operational memory pronta.',
      operatorSummary: 'Ha contexto suficiente para resume o runtime.',
    },
    ...overrides,
  };
}

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceMemoryCommandPack {
  return new SharedSurfaceMemoryCommandPack({
    memoryPlaneService: {
      buildSnapshot: jest.fn(async () => buildMemoryPlaneSnapshot()),
    } as any,
    layeredMemoryService: {
      buildStatus: jest.fn(async () => ({
        generatedAt: '2026-04-15T12:00:00.000Z',
        summary: {
          total: 5,
          episodic: 2,
          semantic: 2,
          procedural: 1,
        },
        budgets: {
          perLayer: 12,
          episodicUsage: 0.16,
          semanticUsage: 0.16,
          proceduralUsage: 0.08,
        },
        narrative: {
          headline: 'Layered memory pronta.',
          operatorSummary: 'Recall distribuido entre episodic, semantic e procedural.',
        },
      })),
      search: jest.fn(async () => ({
        generatedAt: '2026-04-15T12:00:00.000Z',
        query: 'gateway',
        total: 1,
        data: [
          {
            id: 'memory-1',
            label: 'Gateway smoke',
            summary: 'Smoke do gateway ficou verde.',
            memoryLayer: 'semantic',
            source: 'memory-service',
            confidence: 0.91,
            lastValidatedAt: '2026-04-15T12:00:00.000Z',
          },
        ],
      })),
      readProcedures: jest.fn(async () => ({
        generatedAt: '2026-04-15T12:00:00.000Z',
        total: 1,
        data: [
          {
            id: 'procedure-1',
            label: 'Release smoke',
            summary: 'Validar release com build e smoke.',
            memoryLayer: 'procedural',
            source: 'learning-plane',
            confidence: 0.88,
            lastValidatedAt: '2026-04-15T12:00:00.000Z',
            steps: ['Rodar build', 'Rodar smoke', 'Ler scorecard'],
          },
        ],
      })),
    } as any,
    ...overrides,
  });
}

describe('SharedSurfaceMemoryCommandPack', () => {
  it('renders memory plane unavailability when the runtime has no memory plane service', async () => {
    const pack = buildPack({
      memoryPlaneService: null,
    });
    const ctx = buildCtx('/memoryplane');

    const handled = await pack.maybeHandle(ctx as any, '/memoryplane', '');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Memory plane unavailable in this shared runtime.');
  });

  it('renders the memory plane snapshot with artifacts, memories and suggested actions', async () => {
    const buildSnapshot = jest.fn(async () => buildMemoryPlaneSnapshot());
    const pack = buildPack({
      memoryPlaneService: {
        buildSnapshot,
      } as any,
    });
    const ctx = buildCtx('/memoryplane');

    const handled = await pack.maybeHandle(ctx as any, '/memoryplane', '');

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'telegram-user',
        platform: 'telegram',
        chatId: 'telegram:chat-1',
        sessionId: 'telegram:chat-1',
        sourceUserId: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth resume and deliveries'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Build report: Build verde.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('gateway: Gateway ready para smoke.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Abrir replay: /sessionhistory latest'));
  });

  it('renders layered memory status through /memory', async () => {
    const buildStatus = jest.fn(async () => ({
      generatedAt: '2026-04-15T12:00:00.000Z',
      summary: {
        total: 9,
        episodic: 3,
        semantic: 4,
        procedural: 2,
      },
      budgets: {
        perLayer: 16,
        episodicUsage: 0.18,
        semanticUsage: 0.25,
        proceduralUsage: 0.12,
      },
      narrative: {
        headline: 'Layered memory indexada.',
        operatorSummary: 'Memory ready para resumption.',
      },
    }));
    const pack = buildPack({
      layeredMemoryService: {
        buildStatus,
        search: jest.fn(),
        readProcedures: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/memory');

    const handled = await pack.maybeHandle(ctx as any, '/memory', '');

    expect(handled).toBe(true);
    expect(buildStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'telegram-user',
        platform: 'telegram',
        chatId: 'telegram:chat-1',
        sessionId: 'telegram:chat-1',
        workspaceHint: null,
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Layered memory indexada.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Total: 9.'));
  });

  it('searches layered memory with /memory search', async () => {
    const search = jest.fn(async () => ({
      generatedAt: '2026-04-15T12:00:00.000Z',
      query: 'gateway',
      total: 1,
      data: [
        {
          id: 'memory-1',
          label: 'Gateway smoke',
          summary: 'Smoke do gateway ficou verde.',
          memoryLayer: 'semantic',
          source: 'memory-service',
          confidence: 0.91,
          lastValidatedAt: '2026-04-15T12:00:00.000Z',
        },
      ],
    }));
    const pack = buildPack({
      layeredMemoryService: {
        buildStatus: jest.fn(),
        search,
        readProcedures: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/memory search gateway');

    const handled = await pack.maybeHandle(ctx as any, '/memory', 'search gateway');

    expect(handled).toBe(true);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'gateway',
        userId: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Query: gateway.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Gateway smoke [semantic]'));
  });

  it('renders procedural memory through /memory procedures', async () => {
    const readProcedures = jest.fn(async () => ({
      generatedAt: '2026-04-15T12:00:00.000Z',
      total: 1,
      data: [
        {
          id: 'procedure-1',
          label: 'Release smoke',
          summary: 'Validar release com build e smoke.',
          memoryLayer: 'procedural',
          source: 'learning-plane',
          confidence: 0.88,
          lastValidatedAt: '2026-04-15T12:00:00.000Z',
          steps: ['Rodar build', 'Rodar smoke', 'Ler scorecard'],
        },
      ],
    }));
    const pack = buildPack({
      layeredMemoryService: {
        buildStatus: jest.fn(),
        search: jest.fn(),
        readProcedures,
      } as any,
    });
    const ctx = buildCtx('/memory procedures');

    const handled = await pack.maybeHandle(ctx as any, '/memory', 'procedures');

    expect(handled).toBe(true);
    expect(readProcedures).toHaveBeenCalledWith({
      workspaceHint: null,
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth procedural memory'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('-> Rodar build'));
  });

  it('routes natural memory intents through the same command handlers', async () => {
    const buildSnapshot = jest.fn(async () =>
      buildMemoryPlaneSnapshot({
        narrative: {
          headline: 'Retomada natural pronta.',
          operatorSummary: 'Contexto natural resolvido.',
        },
      }),
    );
    const pack = buildPack({
      memoryPlaneService: {
        buildSnapshot,
      } as any,
    });
    const ctx = buildCtx('show recent memory');

    const handled = await pack.maybeHandle(ctx as any, '/memoryplane', '');
    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Retomada natural pronta.'));
  });

  it('ignores unrelated commands', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/platform');

    const handled = await pack.maybeHandle(ctx as any, '/platform', '');

    expect(handled).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
