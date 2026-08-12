import { SurfaceOperationalIntentService } from '../../src/services/SurfaceOperationalIntentService';

function lightImpact() {
  return {
    generatedAt: '2026-04-26T00:00:00.000Z',
    taskKind: 'chat',
    intent: 'conversa simples',
    heavy: false,
    approvalRequired: false,
    summary: 'Sem impacto pesado.',
    userFacingSummary: 'Core leve.',
    budget: {
      ramMb: 0,
      cpuPercent: 0,
      diskMb: 0,
      processCount: 0,
      externalExposure: 'none',
      recurring: false,
      companionDependencies: [],
      capabilityIds: [],
      fallback: 'Responder em conversa.',
      notes: [],
    },
    capabilityEstimates: [],
    companionEstimates: [],
    warnings: [],
  } as any;
}

describe('SurfaceOperationalIntentService', () => {
  let surfaceOperationalIntentService: SurfaceOperationalIntentService;

  beforeEach(() => {
    surfaceOperationalIntentService = new SurfaceOperationalIntentService({
      semanticClassifier: null,
    });
  });

  it('keeps low-signal conversation as conversation-only without keyword tables', () => {
    const decision = surfaceOperationalIntentService.classify({
      surface: 'web',
      text: 'estou pensando aqui ainda, espera um pouco',
      resourceImpact: lightImpact(),
    });

    expect(decision).toEqual(
      expect.objectContaining({
        shouldExecute: false,
        reason: 'conversation-only',
        requestedTools: [],
      }),
    );
  });

  it('routes operational requests when tool affordances are present', () => {
    const decision = surfaceOperationalIntentService.classify({
      surface: 'telegram',
      text: 'compare o que mudou nesta pasta e me mande um resumo',
    });

    expect(decision.shouldExecute).toBe(true);
    expect(decision.reason).toBe('tool-affordance-detected');
    expect(decision.requestedTools).toEqual(expect.arrayContaining(['read_file']));
  });

  it('routes natural capability requests that historically required slash commands', async () => {
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: null,
    });
    const cases = [
      {
        text: 'monte uma equipe de agentes para revisar esta arquitetura',
        tool: 'swarm.run',
      },
      {
        text: 'use resposta por voz com Echo nesta conversa',
        tool: 'echo_hands',
      },
      {
        text: 'ative o Watch Mode para observar a tela',
        tool: 'watchmode.control',
      },
      {
        text: 'proponha uma auto melhoria segura para o Zavorth',
        tool: 'selfmod.preview',
      },
    ];

    for (const entry of cases) {
      const decision = await service.decideResponse({
        surface: 'telegram',
        text: entry.text,
      });

      expect(decision).toEqual(
        expect.objectContaining({
          mode: 'operation',
          responsePath: 'agent-runtime',
          requestedTools: expect.arrayContaining([entry.tool]),
        }),
      );
    }
  });

  it('honors explicit execution even when the text is low-signal', () => {
    const decision = surfaceOperationalIntentService.classify({
      surface: 'cli',
      text: 'olá',
      explicitExecution: true,
    });

    expect(decision.shouldExecute).toBe(true);
    expect(decision.reason).toBe('explicit-execution');
    expect(decision.requestedTools).toEqual(['memory.read']);
  });

  it('uses a semantic classifier only for ambiguous conversation-only input', async () => {
    const semanticClassifier = {
      isProviderAvailable: jest.fn(() => true),
      getPreferredProviderName: jest.fn(() => 'test'),
      chat: jest.fn(async () => ({
        content: JSON.stringify({
          shouldExecute: true,
          requestedTools: ['read_file'],
          confidence: 'high',
        }),
        toolCalls: [],
        finishReason: 'stop',
      })),
    };
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: semanticClassifier as any,
      semanticTimeoutMs: 250,
    });

    const decision = await service.classifyWithSemantic({
      surface: 'web',
      text: 'da uma olhada no que aconteceu nesse projeto quando puder',
    });

    expect(semanticClassifier.chat).toHaveBeenCalled();
    expect(decision).toEqual(
      expect.objectContaining({
        shouldExecute: true,
        reason: 'semantic-operational',
        requestedTools: ['read_file'],
      }),
    );
  });

  it('does not call the semantic classifier for obvious tool affordances', async () => {
    const semanticClassifier = {
      isProviderAvailable: jest.fn(() => true),
      getPreferredProviderName: jest.fn(() => 'test'),
      chat: jest.fn(),
    };
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: semanticClassifier as any,
      ownerControlledDefaultActivationService: null,
    });

    const decision = await service.classifyWithSemantic({
      surface: 'cli',
      text: 'rode npm test',
    });

    expect(semanticClassifier.chat).not.toHaveBeenCalled();
    expect(decision.shouldExecute).toBe(true);
    expect(decision.reason).toBe('tool-affordance-detected');
  });

  it('uses the owner-controlled AI-first default before deterministic affordances when active', async () => {
    const semanticClassifier = {
      isProviderAvailable: jest.fn(() => true),
      getPreferredProviderName: jest.fn(() => 'test'),
      chat: jest.fn(async () => ({
        content: JSON.stringify({
          shouldExecute: false,
          requestedTools: [],
          confidence: 'high',
        }),
        toolCalls: [],
        finishReason: 'stop',
      })),
    };
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: semanticClassifier as any,
      ownerControlledDefaultActivationService: {
        status: () =>
          ({
            state: {
              status: 'active',
              defaultRouter: 'ai-first',
            },
          }) as any,
      },
    });

    const decision = await service.classifyWithSemantic({
      surface: 'cli',
      text: 'rode npm test',
    });

    expect(semanticClassifier.chat).toHaveBeenCalled();
    expect(decision.shouldExecute).toBe(false);
    expect(decision.reason).toBe('semantic-conversation');
  });

  it('does not steal composer-owned contextual mentions', () => {
    const decision = surfaceOperationalIntentService.classify({
      surface: 'web',
      text: 'compare este arquivo',
      hasContextualMentions: true,
    });

    expect(decision.shouldExecute).toBe(false);
    expect(decision.reason).toBe('contextual-mentions-owned-by-composer');
  });

  it('creates a response envelope for plain conversation', async () => {
    const semanticClassifier = {
      isProviderAvailable: jest.fn(() => true),
      getPreferredProviderName: jest.fn(() => 'test'),
      chat: jest.fn(async () => ({
        content: JSON.stringify({
          shouldExecute: false,
          requestedTools: [],
          confidence: 'high',
        }),
        toolCalls: [],
        finishReason: 'stop',
      })),
    };
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: semanticClassifier as any,
      semanticTimeoutMs: 250,
    });

    const decision = await service.decideResponse({
      surface: 'web',
      text: 'oi',
      resourceImpact: lightImpact(),
    });

    expect(decision).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        mode: 'conversation',
        responsePath: 'fast-chat',
        shouldCreateArtifact: false,
        shouldShowArtifactInChat: false,
        target: { type: 'none', value: null },
      }),
    );
  });

  it('keeps action verbs without a system target on the fast chat path', async () => {
    const semanticClassifier = {
      isProviderAvailable: jest.fn(() => true),
      getPreferredProviderName: jest.fn(() => 'test'),
      chat: jest.fn(async () => ({
        content: JSON.stringify({
          shouldExecute: false,
          requestedTools: [],
          confidence: 'high',
        }),
        toolCalls: [],
        finishReason: 'stop',
      })),
    };
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: semanticClassifier as any,
      semanticTimeoutMs: 250,
    });

    const decision = await service.decideResponse({
      surface: 'web',
      text: 'analise minha ideia e me diga se faz sentido',
    });

    expect(semanticClassifier.chat).toHaveBeenCalled();
    expect(decision.mode).toBe('conversation');
    expect(decision.responsePath).toBe('fast-chat');
    expect(decision.shouldShowArtifactInChat).toBe(false);
  });

  it('keeps passive link sharing on the LLM conversation path', async () => {
    const semanticClassifier = {
      isProviderAvailable: jest.fn(() => true),
      getPreferredProviderName: jest.fn(() => 'test'),
      chat: jest.fn(),
    };
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: semanticClassifier as any,
      semanticTimeoutMs: 250,
    });

    const decision = await service.decideResponse({
      surface: 'telegram',
      text: 'olha isso aqui https://example.com/artigo',
    });

    expect(semanticClassifier.chat).not.toHaveBeenCalled();
    expect(decision).toEqual(
      expect.objectContaining({
        mode: 'conversation',
        responsePath: 'fast-chat',
        requestedTools: [],
        target: { type: 'none', value: null },
        diagnostics: expect.objectContaining({
          uxIntent: expect.objectContaining({
            kind: 'answer',
            shouldUseTools: false,
          }),
        }),
      }),
    );
  });

  it('keeps conceptual analysis requests as conversation instead of over-triggering tools', async () => {
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: null,
    });

    const decision = await service.decideResponse({
      surface: 'web',
      text: 'analise essa ideia e me diga o que acha',
    });

    expect(decision).toEqual(
      expect.objectContaining({
        mode: 'conversation',
        responsePath: 'fast-chat',
        requestedTools: [],
        diagnostics: expect.objectContaining({
          uxIntent: expect.objectContaining({
            kind: 'explain',
            shouldUseTools: false,
          }),
        }),
      }),
    );
  });

  it('uses network fetch only when the user explicitly asks to inspect the link', async () => {
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: null,
    });

    const decision = await service.decideResponse({
      surface: 'telegram',
      text: 'resuma este link https://example.com/artigo',
    });

    expect(decision).toEqual(
      expect.objectContaining({
        mode: 'operation',
        responsePath: 'agent-runtime',
        requestedTools: expect.arrayContaining(['network_fetch']),
        target: { type: 'web', value: null },
        diagnostics: expect.objectContaining({
          uxIntent: expect.objectContaining({
            kind: 'preview',
            shouldUseTools: true,
          }),
        }),
      }),
    );
  });

  it('routes concrete sensitive work behind operational approval posture', async () => {
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: null,
    });

    const decision = await service.decideResponse({
      surface: 'cli',
      text: 'apague a pasta dist e rode npm test',
    });

    expect(decision).toEqual(
      expect.objectContaining({
        mode: 'operation',
        responsePath: 'agent-runtime',
        requestedTools: expect.arrayContaining(['shell.exec']),
        diagnostics: expect.objectContaining({
          uxIntent: expect.objectContaining({
            kind: 'execute',
            shouldUseTools: true,
            shouldAskApproval: true,
          }),
        }),
      }),
    );
  });

  it('does not keyword-route free-text folder phrases to local-inspector (agent-first)', async () => {
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: null,
    });

    const decision = await service.decideResponse({
      surface: 'web',
      text: 'analise minha pasta downloads e me diga o que tem la dentro',
    });

    // Free text stays model-owned: no free-text → read_file / local-inspector steal.
    expect(decision.mode).not.toBe('file-inspection');
    expect(decision.responsePath).not.toBe('local-inspector');
    expect(decision.requestedTools).not.toEqual(expect.arrayContaining(['read_file']));
  });

  it('allows explicit deliverable artifacts only for real artifact requests', async () => {
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: null,
    });

    const decision = await service.decideResponse({
      surface: 'web',
      text: 'gere um relatorio em PDF com os resultados',
    });

    expect(decision.mode).toBe('operation');
    expect(decision.responsePath).toBe('agent-runtime');
    expect(decision.requestedTools).toEqual(expect.arrayContaining(['pdf.generate']));
    expect(decision.shouldCreateArtifact).toBe(true);
    expect(decision.shouldShowArtifactInChat).toBe(true);
    expect(decision.artifactPolicy.reason).toBe('deliverable-artifact-requested');
  });

  it('does not turn shell execution into a chat artifact automatically', async () => {
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: null,
    });

    const decision = await service.decideResponse({
      surface: 'cli',
      text: 'rode npm test',
    });

    expect(decision.mode).toBe('operation');
    expect(decision.responsePath).toBe('agent-runtime');
    expect(decision.target.type).toBe('shell');
    expect(decision.requestedTools).toEqual(expect.arrayContaining(['shell.exec']));
    expect(decision.shouldCreateArtifact).toBe(false);
    expect(decision.shouldShowArtifactInChat).toBe(false);
  });

  it('attaches the canonical UNI decision to response diagnostics without changing the route', async () => {
    const service = new SurfaceOperationalIntentService({
      semanticClassifier: null,
    });

    const decision = await service.decideResponse({
      surface: 'cli',
      text: 'rode npm test',
    });

    expect(decision.responsePath).toBe('agent-runtime');
    expect(decision.diagnostics.universalIntent).toEqual(
      expect.objectContaining({
        intent: 'command_execution',
        risk: 'danger',
        nextSafeAction: 'preview_then_request_permission',
        requiresPermission: true,
      }),
    );
    expect(decision.diagnostics.trustSlider).toEqual(
      expect.objectContaining({
        level: 'collaborator',
        decision: 'requires_permission',
        sandboxTier: 'workspace-scoped',
        permissionScope: 'once',
        blocked: false,
      }),
    );
  });
});
