import {
  NaturalFirstRunClassifier,
} from '../../../src/runtime/agent/index.js';

describe('NaturalFirstRunClassifier', () => {
  const classifier = new NaturalFirstRunClassifier();

  it('routes short greetings as normal LLM-facing text instead of a light-chat shortcut', () => {
    expect(classifier.classify({
      text: 'oi',
      channel: 'web',
    })).toEqual(expect.objectContaining({
      shouldEnterGateway: true,
      contractVersion: 'natural-first-classifier/3',
      route: 'llm-reply',
      effort: 'light',
      requiresApproval: false,
      intent: expect.objectContaining({
        primary: 'free-text-question',
        confidence: expect.any(Number),
      }),
      cost: expect.objectContaining({
        tier: 'cheap',
      }),
      risk: expect.objectContaining({
        level: 'safe',
      }),
    }));
  });

  it('routes lightweight follow-up language as normal LLM-facing text', () => {
    expect(classifier.classify({
      text: 'explica melhor',
      channel: 'web',
      sessionId: 'session-follow-up',
    })).toEqual(expect.objectContaining({
      route: 'llm-reply',
      intent: expect.objectContaining({
        primary: 'free-text-question',
      }),
      context: expect.objectContaining({
        session: expect.objectContaining({
          present: true,
          id: 'session-follow-up',
        }),
      }),
    }));
  });

  it('keeps slash commands as command router shortcuts', () => {
    expect(classifier.classify({
      text: '/status',
      channel: 'telegram',
    })).toEqual(expect.objectContaining({
      shouldEnterGateway: false,
      route: 'slash-command',
      usesLlm: 'not-required',
      intent: expect.objectContaining({
        primary: 'slash-command',
      }),
    }));
  });

  it('routes open-ended free text to an LLM reply', () => {
    expect(classifier.classify({
      text: 'qual a melhor forma de pensar sobre esse produto?',
      channel: 'cli',
    })).toEqual(expect.objectContaining({
      route: 'llm-reply',
      usesLlm: 'preferred',
      intent: expect.objectContaining({
        primary: 'free-text-question',
      }),
    }));
  });

  it('routes repo work to governed execution', () => {
    expect(classifier.classify({
      text: 'analise esse repositorio e documente o fluxo principal',
      channel: 'cli',
    })).toEqual(expect.objectContaining({
      route: 'governed-execution',
      effort: 'heavy',
      cost: expect.objectContaining({
        tier: 'expensive',
        budgetHint: 'governed-runtime',
      }),
    }));
  });

  it('routes command/tool intent to preview before execution', () => {
    expect(classifier.classify({
      text: 'rode npm test nesse projeto',
      channel: 'web',
    })).toEqual(expect.objectContaining({
      route: 'tool-preview',
      requiresApproval: false,
      risk: expect.objectContaining({
        previewRequired: true,
      }),
      cost: expect.objectContaining({
        tier: 'standard',
      }),
    }));
  });

  it('treats current datetime lookups as safe tool use without approval', () => {
    expect(classifier.classify({
      text: 'Me diga que horas sao agora em Brasilia',
      channel: 'telegram',
      requestedTools: ['get_datetime'],
    })).toEqual(expect.objectContaining({
      route: 'tool-preview',
      requiresApproval: false,
      risk: expect.objectContaining({
        level: 'safe',
        requiresApproval: false,
      }),
      context: expect.objectContaining({
        tools: expect.objectContaining({
          requested: ['get_datetime'],
          highestRisk: 'safe',
        }),
      }),
    }));
  });

  it('routes dangerous mutation intent to approval proposal', () => {
    expect(classifier.classify({
      text: 'apague a pasta dist e faça push',
      channel: 'web',
    })).toEqual(expect.objectContaining({
      route: 'approval-proposal',
      requiresApproval: true,
      intent: expect.objectContaining({
        primary: 'sensitive-action',
      }),
      risk: expect.objectContaining({
        level: 'danger',
        requiresApproval: true,
      }),
    }));
  });

  it('routes memory requests to memory recall', () => {
    expect(classifier.classify({
      text: 'como resolvemos aquele erro de permissao?',
      channel: 'web',
    })).toEqual(expect.objectContaining({
      route: 'memory-recall',
      signals: expect.arrayContaining(['memory-intent']),
      context: expect.objectContaining({
        memory: expect.objectContaining({
          hinted: true,
        }),
      }),
    }));
  });

  it('keeps recall about sensitive topics as memory recall instead of execution approval', () => {
    expect(classifier.classify({
      text: 'o que combinamos sobre aquele deploy?',
      channel: 'cli',
    })).toEqual(expect.objectContaining({
      route: 'memory-recall',
      requiresApproval: false,
      risk: expect.objectContaining({
        level: 'safe',
      }),
    }));
  });

  it('uses session, user, workspace, tools and memory metadata as classifier context', () => {
    const result = classifier.classify({
      text: 'continue de onde paramos',
      channel: 'api',
      userId: 'api-user',
      sessionId: 'api-session',
      workspace: 'C:/repo/Zavorth',
      requestedTools: ['memory.read'],
      metadata: {
        allowedTools: ['workspace.read'],
        memoryPrompt: 'Preferir contexto recente.',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      route: 'memory-recall',
      intent: expect.objectContaining({
        candidates: expect.arrayContaining(['memory-recall']),
      }),
      context: expect.objectContaining({
        channel: 'api',
        user: expect.objectContaining({
          present: true,
          id: 'api-user',
        }),
        session: expect.objectContaining({
          present: true,
          id: 'api-session',
        }),
        workspace: expect.objectContaining({
          present: true,
          path: 'C:/repo/Zavorth',
        }),
        memory: expect.objectContaining({
          hinted: true,
          sources: expect.arrayContaining(['memoryPrompt']),
        }),
        tools: expect.objectContaining({
          requested: ['memory.read'],
          available: ['workspace.read'],
          highestRisk: 'safe',
        }),
      }),
    }));
  });

  it('promotes explicit approval-required tools to approval proposals', () => {
    expect(classifier.classify({
      text: 'prepare a mudanca',
      channel: 'cli',
      requestedTools: ['workspace.write'],
      metadata: {
        requireApprovalFor: ['workspace.write'],
      },
    })).toEqual(expect.objectContaining({
      route: 'approval-proposal',
      requiresApproval: true,
      context: expect.objectContaining({
        tools: expect.objectContaining({
          approvalRequired: ['workspace.write'],
          highestRisk: 'danger',
        }),
      }),
      signals: expect.arrayContaining(['approval-required-tools']),
    }));
  });

  it('routes channel setup language to capability discovery with standard cost', () => {
    expect(classifier.classify({
      text: 'conectar Telegram e configurar o canal',
      channel: 'web',
    })).toEqual(expect.objectContaining({
      route: 'capability-discovery',
      intent: expect.objectContaining({
        primary: 'capability-discovery',
      }),
      cost: expect.objectContaining({
        tier: 'standard',
      }),
    }));
  });
});
