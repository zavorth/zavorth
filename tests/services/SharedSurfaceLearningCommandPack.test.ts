import { SharedSurfaceLearningCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceLearningCommandPack';

function buildCtx(rawText = '/learning') {
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

function buildLearningSnapshot(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-04-15T12:00:00.000Z',
    summary: {
      total: 1,
      pending: 1,
      approved: 0,
      rejected: 0,
      promoted: 0,
      published: 0,
      quarantined: 0,
      highConfidence: 1,
    },
    candidates: [
      {
        id: 'candidate:gateway-smoke',
        platformEntryId: 'skill:learned:gateway-smoke',
        title: 'Gateway smoke skill',
        kind: 'skill',
        summary: 'Aprendeu o fluxo de smoke do gateway.',
        score: 0.92,
        reviewState: 'pending',
        lifecycle: 'learned_draft',
        createdAt: '2026-04-15T12:00:00.000Z',
        updatedAt: '2026-04-15T12:00:00.000Z',
        lastValidatedAt: '2026-04-15T12:00:00.000Z',
        source: {
          workflowRunId: 'workflow-1',
          workflow: 'gateway-smoke',
          workspace: 'Zavorth',
          objective: 'Validar gateway',
          artifactCount: 1,
          completedStages: 3,
          totalStages: 3,
          originTaskId: null,
          sourceSurface: 'telegram',
        },
        steps: ['Rodar build', 'Rodar smoke'],
        details: ['Workflow: gateway-smoke'],
      },
    ],
    narrative: {
      headline: 'Learning plane com 1 candidato derivado do runtime.',
      operatorSummary: '1 pendente, 0 aprovado e 0 promovido.',
    },
    ...overrides,
  };
}

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceLearningCommandPack {
  return new SharedSurfaceLearningCommandPack({
    learningPlaneService: {
      buildSnapshot: jest.fn(() => buildLearningSnapshot()),
      executeAction: jest.fn(() => ({
        generatedAt: '2026-04-15T12:00:00.000Z',
        candidateId: 'candidate:gateway-smoke',
        actionId: 'approve',
        status: 'applied',
        ok: true,
        summary: 'Gateway smoke skill aprovado como draft revisavel.',
        details: ['O item continua como learned_draft ate uma promocao explicita.'],
        snapshot: buildLearningSnapshot(),
      })),
    } as any,
    ...overrides,
  });
}

describe('SharedSurfaceLearningCommandPack', () => {
  it('renders learning plane status through /learning', async () => {
    const buildSnapshot = jest.fn(() => buildLearningSnapshot());
    const pack = buildPack({
      learningPlaneService: {
        buildSnapshot,
        executeAction: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/learning');

    const handled = await pack.maybeHandle(ctx as any, '/learning', '');

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Learning plane do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Candidatos: 1 | pendentes: 1 | aprovados: 0.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Gateway smoke skill [skill] score=0.92'));
  });

  it('uses the candidates heading when /learning candidates is requested', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/learning candidates');

    const handled = await pack.maybeHandle(ctx as any, '/learning', 'candidates');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Candidatos em foco:'));
  });

  it('shows usage for mutable learning actions without a candidate id', async () => {
    const executeAction = jest.fn();
    const pack = buildPack({
      learningPlaneService: {
        buildSnapshot: jest.fn(),
        executeAction,
      } as any,
    });
    const ctx = buildCtx('/learning approve');

    const handled = await pack.maybeHandle(ctx as any, '/learning', 'approve');

    expect(handled).toBe(true);
    expect(executeAction).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Use /learning <approve|reject|promote|forget|promote-skill|promote-procedure> <candidateId>.');
  });

  it('executes approve/reject/promote actions through the learning plane service', async () => {
    const executeAction = jest.fn(() => ({
      generatedAt: '2026-04-15T12:00:00.000Z',
      candidateId: 'candidate:gateway-smoke',
      actionId: 'approve',
      status: 'applied',
      ok: true,
      summary: 'Gateway smoke skill aprovado como draft revisavel.',
      details: ['O item continua como learned_draft ate uma promocao explicita.'],
      snapshot: buildLearningSnapshot(),
    }));
    const pack = buildPack({
      learningPlaneService: {
        buildSnapshot: jest.fn(),
        executeAction,
      } as any,
    });
    const ctx = buildCtx('/learning approve candidate:gateway-smoke');

    const handled = await pack.maybeHandle(ctx as any, '/learning', 'approve candidate:gateway-smoke');

    expect(handled).toBe(true);
    expect(executeAction).toHaveBeenCalledWith({
      candidateId: 'candidate:gateway-smoke',
      actionId: 'approve',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Gateway smoke skill aprovado como draft revisavel.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Status: applied.'));
  });

  it('routes natural learning intents through the same command handler', async () => {
    const executeAction = jest.fn(() => ({
      generatedAt: '2026-04-15T12:00:00.000Z',
      candidateId: 'candidate:gateway-smoke',
      actionId: 'promote',
      status: 'applied',
      ok: true,
      summary: 'Gateway smoke skill promovido para trusted local.',
      details: ['O candidato agora pode aparecer como habilidade aprendida.'],
      snapshot: buildLearningSnapshot(),
    }));
    const pack = buildPack({
      learningPlaneService: {
        buildSnapshot: jest.fn(),
        executeAction,
      } as any,
    });
    const ctx = buildCtx('promova o candidato candidate:gateway-smoke');

    await pack.handleNaturalLearningIntent(ctx as any, {
      args: 'promote candidate:gateway-smoke',
      intro: 'Entendi que voce quer promover o candidato candidate:gateway-smoke no learning plane.',
    });

    expect(ctx.reply).toHaveBeenNthCalledWith(
      1,
      'Entendi que voce quer promover o candidato candidate:gateway-smoke no learning plane.',
    );
    expect(ctx.reply).toHaveBeenNthCalledWith(2, expect.stringContaining('promovido para trusted local.'));
    expect(executeAction).toHaveBeenCalledWith({
      candidateId: 'candidate:gateway-smoke',
      actionId: 'promote',
    });
  });

  it('ignores unrelated commands', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/memory');

    const handled = await pack.maybeHandle(ctx as any, '/memory', '');

    expect(handled).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
