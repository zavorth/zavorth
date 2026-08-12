import {
  NaturalFirstRunClassifier,
} from '../../../src/runtime/agent/index.js';

describe('NaturalFirstRunClassifier', () => {
  const classifier = new NaturalFirstRunClassifier();

  it('routes short greetings as free-text agent turns', () => {
    expect(classifier.classify({
      text: 'oi',
      channel: 'web',
    })).toEqual(expect.objectContaining({
      shouldEnterGateway: true,
      contractVersion: 'natural-first-classifier/4',
      route: 'llm-reply',
      effort: 'standard',
      requiresApproval: false,
      reason: 'Free-text turns use the agent runtime; the LLM chooses tools.',
      signals: expect.arrayContaining(['free-text']),
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

  it('routes lightweight follow-up language as free-text agent turns', () => {
    expect(classifier.classify({
      text: 'explica melhor',
      channel: 'web',
      sessionId: 'session-follow-up',
    })).toEqual(expect.objectContaining({
      route: 'llm-reply',
      effort: 'standard',
      signals: expect.arrayContaining(['free-text']),
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

  it('routes open-ended free text to the agent runtime (llm-reply)', () => {
    expect(classifier.classify({
      text: 'qual a melhor forma de pensar sobre esse produto?',
      channel: 'cli',
    })).toEqual(expect.objectContaining({
      route: 'llm-reply',
      effort: 'standard',
      usesLlm: 'preferred',
      signals: expect.arrayContaining(['free-text']),
      intent: expect.objectContaining({
        primary: 'free-text-question',
      }),
    }));
  });

  it('does not force governed-execution from operational phrase maps; free text stays agent-owned', () => {
    expect(classifier.classify({
      text: 'analise esse repositorio e documente o fluxo principal',
      channel: 'cli',
    })).toEqual(expect.objectContaining({
      route: 'llm-reply',
      effort: 'standard',
      usesLlm: 'preferred',
      reason: 'Free-text turns use the agent runtime; the LLM chooses tools.',
      signals: expect.arrayContaining(['free-text']),
      intent: expect.objectContaining({
        primary: 'free-text-question',
      }),
    }));
  });

  it('does not force tool-preview from free-text shell phrases', () => {
    expect(classifier.classify({
      text: 'rode npm test nesse projeto',
      channel: 'web',
    })).toEqual(expect.objectContaining({
      route: 'llm-reply',
      signals: expect.arrayContaining(['free-text']),
    }));
  });

  it('uses structured requestedTools for tool-preview risk, not free-text keywords', () => {
    expect(classifier.classify({
      text: 'whatever the user said',
      channel: 'telegram',
      requestedTools: ['get_datetime'],
    })).toEqual(expect.objectContaining({
      route: 'tool-preview',
      requiresApproval: false,
      context: expect.objectContaining({
        tools: expect.objectContaining({
          requested: ['get_datetime'],
          highestRisk: 'safe',
        }),
      }),
    }));
  });

  it('does not force approval from free-text mutation phrases alone', () => {
    expect(classifier.classify({
      text: 'apague a pasta dist e faça push',
      channel: 'web',
    })).toEqual(expect.objectContaining({
      route: 'llm-reply',
      requiresApproval: false,
      risk: expect.objectContaining({
        level: 'safe',
      }),
    }));
  });

  it('marks danger from structured high-risk requested tools', () => {
    expect(classifier.classify({
      text: 'please proceed',
      channel: 'web',
      requestedTools: ['workspace.delete'],
    })).toEqual(expect.objectContaining({
      route: 'approval-proposal',
      requiresApproval: true,
      risk: expect.objectContaining({
        level: 'danger',
      }),
    }));
  });

  it('does not route memory phrase maps on free text; agent path owns NLU', () => {
    expect(classifier.classify({
      text: 'como resolvemos aquele erro de permissao?',
      channel: 'web',
    })).toEqual(expect.objectContaining({
      route: 'llm-reply',
      effort: 'standard',
      signals: expect.arrayContaining(['free-text']),
      intent: expect.objectContaining({
        primary: 'free-text-question',
      }),
      context: expect.objectContaining({
        memory: expect.objectContaining({
          hinted: false,
        }),
      }),
    }));
  });

  it('keeps free-text memory-about-deploy as agent path without inventing approval from memory words', () => {
    expect(classifier.classify({
      text: 'o que combinamos sobre aquele deploy?',
      channel: 'cli',
    })).toEqual(expect.objectContaining({
      route: 'llm-reply',
      requiresApproval: false,
      risk: expect.objectContaining({
        level: 'safe',
      }),
      signals: expect.arrayContaining(['free-text']),
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

  it('does not force capability-discovery from setup phrase maps; free text stays agent-owned', () => {
    expect(classifier.classify({
      text: 'conectar Telegram e configurar o canal',
      channel: 'web',
    })).toEqual(expect.objectContaining({
      route: 'llm-reply',
      effort: 'standard',
      signals: expect.arrayContaining(['free-text']),
      intent: expect.objectContaining({
        primary: 'free-text-question',
      }),
    }));
  });
});
