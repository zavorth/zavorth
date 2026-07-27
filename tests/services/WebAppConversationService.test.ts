import { WebAppConversationService } from '../../src/services/WebAppConversationService';
import { ZavorthAgentGateway } from '../../src/runtime/agent/index.js';
import { FirstRunPersonalizationService } from '../../src/services/FirstRunPersonalizationService.js';
import { ZavorthConversationalSetupService } from '../../src/services/ZavorthConversationalSetupService.js';

function createRealtimeMock() {
  const messages: Array<{ role: string; content: string; kind-: string | null }> = [];
  return {
    messages,
    createSession: jest.fn(() => 'web-session-1'),
    ensureSession: jest.fn(),
    getChatId: jest.fn((sessionId: string) => `web:${sessionId}`),
    recordUserMessage: jest.fn((_sessionId: string, content: string) => {
      messages.push({ role: 'user', content });
      return messages[messages.length - 1];
    }),
    recordAssistantMessage: jest.fn(
      (_sessionId: string, content: string, _taskId-: string | null, kind-: string | null) => {
        messages.push({ role: 'assistant', content, kind });
        return messages[messages.length - 1];
      },
    ),
    getResolvedSnapshot: jest.fn(async (sessionId: string) => ({
      sessionId,
      chatId: `web:${sessionId}`,
      messages,
      tasks: [],
      permissions: [],
      continuity: null,
      replay: null,
      handoff: null,
      workflowRuns: [],
    })),
    captureBaseline: jest.fn(async () => undefined),
  };
}

function createRuntime() {
  return {
    webUserId: 'web-user',
    taskManager: {
      getTask: jest.fn(() => null),
    },
    permissionService: {
      listRequests: jest.fn(async () => []),
    },
    parser: {
      parse: jest.fn(),
    },
    taskOrchestrationController: {
      handleTaskMessage: jest.fn(),
    },
    permissionController: {
      resolvePermissionReference: jest.fn(),
      shortPermissionId: jest.fn(),
      handlePermissionCallback: jest.fn(),
      handleApproval: jest.fn(),
      handleRejection: jest.fn(),
      formatPermissionCreatedMessage: jest.fn(),
    },
    surfaceTaskDispatcher: null,
  };
}

describe('WebAppConversationService natural-first routing', () => {
  let personalizationSpy: jest.SpyInstance;

  beforeEach(() => {
    personalizationSpy = jest.spyOn(FirstRunPersonalizationService.prototype, 'getStatus').mockReturnValue({
      pending: false,
      reasons: [],
      files: {
        identity: '',
        soul: '',
        user: '',
        bootstrap: '',
        domain: '',
        learningStyle: '',
        errorHandling: '',
        outputFormat: '',
        timeAutomation: '',
      },
      bootstrapExists: false,
      missingUserFields: [],
      identityName: 'Zavorth',
    });
  });

  afterEach(() => {
    personalizationSpy.mockRestore();
  });

  it('routes web chat natural requests through the shared surface before opening a task', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn();
    const sharedSurface = {
      maybeHandle: jest.fn(async (ctx: any) => {
        await ctx.reply('Entendi que you quer colocar o Zavorth no Discord.');
        return true;
      }),
    };
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => sharedSurface as any,
    });

    const result = await service.processChatSend({
      sessionId: 'session-web-1',
      message: 'Quero colocar you no Discord',
    });

    expect(sharedSurface.maybeHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'web',
        userId: 'web-user',
        chatId: 'web:session-web-1',
        rawText: 'Quero colocar you no Discord',
      }),
    );
    expect(sendToSession).not.toHaveBeenCalled();
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-web-1',
      'Entendi que you quer colocar o Zavorth no Discord.',
      null,
      'shared-surface',
    );
    expect(result.taskId).toBeNull();
    expect(result.snapshot.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', content: expect.stringContaining('Discord') }),
      ]),
    );
  });

  it('routes web chat through the canonical Surface API when the boundary is provided', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn();
    const surfaceApi = {
      handleCommand: jest.fn(async (input: any) => {
        await input.context.reply(`Boundary ${input.request.surface}: ${input.context.rawText}`);
        return {
          ok: true,
          handled: true,
          status: 'ok',
          summary: 'Handled by canonical web boundary.',
          messages: [`Boundary ${input.request.surface}: ${input.context.rawText}`],
          correlation: {
            traceId: 'trace-web',
            runId: 'run-web',
            sessionId: input.request.threadId,
            approvalId: null,
            artifactId: null,
          },
          error: null,
          metadata: {},
        };
      }),
    };
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => surfaceApi as any,
    });

    const result = await service.processChatSend({
      sessionId: 'session-web-boundary',
      message: '/hub',
    });

    expect(surfaceApi.handleCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          platform: 'web',
          rawText: '/hub',
        }),
        request: expect.objectContaining({
          surface: 'web',
          requestedBy: 'web-user',
          threadId: 'session-web-boundary',
        }),
      }),
    );
    expect(sendToSession).not.toHaveBeenCalled();
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-web-boundary',
      'Boundary web: /hub',
      null,
      'shared-surface',
    );
    expect(result.taskId).toBeNull();
  });

  it('uses LegacyUnifiedGatewayAdapter as a web fallback when AgentGateway is absent', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'task-web-legacy' }));
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (event: any) => {
        await event.reply(`Gateway web: ${event.text}`);
        return {
          responseText: `Gateway web: ${event.text}`,
          surface: event.surface,
          intentCategory: 'delegated',
          firewallStats: 'test',
          fastModelSuggested: false,
        };
      }),
    };
    const runtime = {
      ...createRuntime(),
      legacyUnifiedGateway,
    };
    const service = new WebAppConversationService({
      runtime: runtime as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
    });

    const result = await service.processChatSend({
      sessionId: 'session-web-gateway',
      message: 'me explique o current plane',
    });

    expect(legacyUnifiedGateway.handleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: 'web',
        userId: 'web-user',
        chatId: 'web:session-web-gateway',
        text: 'me explique o current plane',
        metadata: expect.objectContaining({
          phase: 'legacy-unified-conversation-fallback-v1',
          sessionId: 'session-web-gateway',
        }),
      }),
    );
    expect(sendToSession).not.toHaveBeenCalled();
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-web-gateway',
      'Gateway web: me explique o current plane',
      null,
      'unified-gateway',
    );
    expect(result.taskId).toBeNull();
  });

  it('passes web natural replies through the shared Echo output stage', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'task-web-legacy' }));
    const echoOutputStage = {
      deliver: jest.fn(async (request: any) => {
        await request.sink.sendText(`stage:${request.text}`);
        return { delivered: 'text' };
      }),
    };
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (event: any) => {
        await event.reply(`Gateway web: ${event.text}`);
        return {
          responseText: `Gateway web: ${event.text}`,
          surface: event.surface,
          intentCategory: 'delegated',
          firewallStats: 'test',
          fastModelSuggested: false,
        };
      }),
    };
    const runtime = {
      ...createRuntime(),
      legacyUnifiedGateway,
      echoOutputStage,
    };
    const service = new WebAppConversationService({
      runtime: runtime as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
    });

    await service.processChatSend({
      sessionId: 'session-web-stage',
      message: 'me responda naturalmente',
    });

    expect(echoOutputStage.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: 'web',
        text: 'Gateway web: me responda naturalmente',
        rawInput: 'me responda naturalmente',
        requestedBy: 'web-user',
        sessionId: 'session-web-stage',
      }),
    );
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-web-stage',
      'stage:Gateway web: me responda naturalmente',
      null,
      'unified-gateway',
    );
  });

  it('keeps the canonical web session path when no natural surface handles the message', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'task-web-1' }));
    const sharedSurface = {
      maybeHandle: jest.fn(async () => false),
    };
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => sharedSurface as any,
    });

    const result = await service.processChatSend({
      sessionId: 'session-web-2',
      message: 'continue the plan anterior',
    });

    expect(sharedSurface.maybeHandle).toHaveBeenCalled();
    expect(sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'web',
        chatId: 'web:session-web-2',
        sessionId: 'session-web-2',
        text: 'continue the plan anterior',
      }),
    );
    expect(result.taskId).toBe('task-web-1');
  });

  it('preserves string experience profiles in composer runtime hints', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'task-profile-string' }));
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
    });

    await service.processChatSend({
      sessionId: 'session-web-profile-string',
      message: 'review this TypeScript code',
      experienceProfile: 'developer',
      composerSettings: { effort: 'high' },
    });

    expect(sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        composerPayload: expect.objectContaining({
          experienceProfile: 'developer',
          effortControl: expect.objectContaining({
            requestedLevel: 'high',
          }),
        }),
      }),
    );
  });

  it('routes low-signal conversation through the Universal Agent Runtime without opening a task', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'should-not-open' }));
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (event: any) => {
        await event.reply('Ol-! Como posso ajudar you- hoje-');
        return {
          responseText: 'Ol-! Como posso ajudar you- hoje-',
          surface: event.surface,
          intentCategory: 'conversation',
          firewallStats: 'test',
          fastModelSuggested: false,
        };
      }),
    };
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:30:00.000Z'),
      idFactory: (() => {
        let index = 0;
        return (prefix: string) => {
          index += 1;
          return `${prefix}-${index}`;
        };
      })(),
    });
    const service = new WebAppConversationService({
      runtime: { ...createRuntime(), legacyUnifiedGateway } as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
      agentGateway,
    });

    const result = await service.processChatSend({
      sessionId: 'session-dashboard-chat-only',
      message: 'ol-',
    });

    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(sendToSession).not.toHaveBeenCalled();
    expect(result.taskId).toBeNull();
    expect(result.responseDecision).toEqual(
      expect.objectContaining({
        mode: 'conversation',
        responsePath: 'fast-chat',
        shouldShowArtifactInChat: false,
      }),
    );
    expect(agentGateway.buildSnapshot({ activeSessionId: 'session-dashboard-chat-only' }).activeRun).toEqual(
      expect.objectContaining({
        channel: 'web',
        sessionId: 'session-dashboard-chat-only',
        input: 'ol-',
        metadata: expect.objectContaining({
          responseDecision: expect.objectContaining({
            responsePath: 'fast-chat',
          }),
          legacyUnifiedGatewayAvailable: true,
          legacyUnifiedGatewayBypassed: true,
        }),
      }),
    );
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-dashboard-chat-only',
      expect.stringContaining('no model is configured yet'),
      null,
      'universal-agent-runtime',
    );
  });

  it('does not steal free-text folder inspection into local-inspector (agent-first)', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'should-not-run' }));
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:45:00.000Z'),
      idFactory: (prefix: string) => `${prefix}-file-inspection`,
    });
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
      agentGateway,
    });

    const result = await service.processChatSend({
      sessionId: 'session-dashboard-downloads',
      message: 'analyze what is inside my downloads folder',
    });

    // Free text never keyword-routes to file-inspection feature; agent owns the turn.
    expect(result.responseDecision?.mode).not.toBe('file-inspection');
    expect(result.responseDecision?.responsePath).not.toBe('local-inspector');
    expect(realtime.recordAssistantMessage).not.toHaveBeenCalledWith(
      'session-dashboard-downloads',
      expect.any(String),
      null,
      expect.stringMatching(/^file-inspection/),
    );
  });

  it('routes selected chat skills into governed capability negotiation before execution', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'task-web-skill' }));
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:55:00.000Z'),
      idFactory: (prefix: string) => `${prefix}-selected-skill`,
    });
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
      agentGateway,
    });

    const result = await service.processChatSend({
      sessionId: 'session-dashboard-skill',
      message: 'use a skill selecionada para este tema',
      selectedSkills: [
        {
          id: 'network_fetch',
          title: 'Pesquisar na web',
          prompt: 'Pesquise fontes recentes.',
        },
      ],
    });

    expect(result.taskId).toBeNull();
    expect(result.responseDecision).toEqual(
      expect.objectContaining({
        responsePath: 'agent-runtime',
        requestedTools: expect.arrayContaining(['network_fetch']),
      }),
    );
    expect(sendToSession).not.toHaveBeenCalled();
    const snapshot = agentGateway.buildSnapshot({ activeSessionId: 'session-dashboard-skill' });
    expect(snapshot.activeRun).toEqual(
      expect.objectContaining({
        status: 'waiting_approval',
        summary: 'Capability Negotiation waiting for approval de escopo.',
        approvals: [
          expect.objectContaining({
            status: 'pending',
            risk: 'attention',
          }),
        ],
      }),
    );
    expect(snapshot.activeRun?.metadata).toEqual(
      expect.objectContaining({
        responseDecision: expect.objectContaining({
          requestedTools: expect.arrayContaining(['network_fetch']),
        }),
        composerPayload: expect.objectContaining({
          selectedSkills: [expect.objectContaining({ id: 'network_fetch' })],
        }),
      }),
    );
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-dashboard-skill',
      expect.stringContaining('I need your confirmation'),
      null,
      'universal-agent-runtime',
    );
  });

  it('answers text attachments as conversation instead of opening an artifact run', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'should-not-run' }));
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (event: any) => {
        expect(event.text).toContain('Content:');
        expect(event.text).toContain('QvSxjZLRMQHD');
        expect(event.text).toContain('Classificaction estrutural');
        expect(event.text).toContain('URL encoding');
        expect(event.text).toContain('Base64');
        expect(event.text).toContain('not exponthere is, reescreva ou decodifique o value completo');
        await event.reply('This TXT appears to contain an encoded token/access code, not a common message.');
        return {
          responseText: 'This TXT appears to contain an encoded token/access code, not a common message.',
          surface: event.surface,
          intentCategory: 'conversation',
          firewallStats: 'test',
          fastModelSuggested: true,
        };
      }),
    };
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:56:30.000Z'),
      idFactory: (prefix: string) => `${prefix}-text-attachment`,
    });
    const service = new WebAppConversationService({
      runtime: { ...createRuntime(), legacyUnifiedGateway } as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
      agentGateway,
    });

    const result = await service.processChatSend({
      sessionId: 'session-dashboard-text-attachment',
      message: 'me diga o que tem nesse file',
      attachments: [
        {
          name: 'token.txt',
          type: 'text/plain',
          size: 739,
          text: 'QvSxjZLRMQHD%2Bo2UQfv05oFK6Ev%2BsA%2B%2BKRbIMbVDbc8T6EJfayYIqAiXvvmlMJ03q%2FLxhcFz%2F6',
          truncated: false,
        },
      ],
    });

    expect(result.taskId).toBeNull();
    expect(result.responseDecision).toBeNull();
    expect(sendToSession).not.toHaveBeenCalled();
    expect(agentGateway.buildSnapshot({ activeSessionId: 'session-dashboard-text-attachment' }).activeRun).toEqual(
      expect.objectContaining({
        channel: 'web',
        input: expect.stringContaining('The user sent textual attachments'),
        metadata: expect.objectContaining({
          composerPayload: expect.objectContaining({
            originalMessage: 'me diga o que tem nesse file',
            attachmentConversation: true,
            attachments: [
              expect.objectContaining({ name: 'token.txt', text: expect.stringContaining('QvSxjZLRMQHD') }),
            ],
          }),
          legacyUnifiedGatewayAvailable: true,
          legacyUnifiedGatewayBypassed: true,
        }),
      }),
    );
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(realtime.recordUserMessage).toHaveBeenCalledWith(
      'session-dashboard-text-attachment',
      'me diga o que tem nesse file',
      null,
      [],
    );
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-dashboard-text-attachment',
      expect.any(String),
      null,
      'attachment-conversation',
    );
  });

  it('keeps local text-attachment fallback compact for encoded/sensitive-looking content', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'should-not-run' }));
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
    });
    const encodedText = 'QvSxjZLRMQHD%2Bo2UQfv05oFK6Ev%2BsA%2B%2BKRbIMbVDbc8T6EJfayYIqAiXvvmlMJ03q%2FLxhcFz%2F6'.repeat(
      4,
    );

    await service.processChatSend({
      sessionId: 'session-dashboard-text-attachment-fallback',
      message: 'me diga o que tem nesse file',
      attachments: [
        {
          name: 'token.txt',
          type: 'text/plain',
          size: encodedText.length,
          text: encodedText,
        },
      ],
    });

    expect(sendToSession).not.toHaveBeenCalled();
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-dashboard-text-attachment-fallback',
      expect.stringContaining('resembles a token or encoded value'),
      null,
      'attachment-conversation',
    );
    expect(realtime.messages[realtime.messages.length - 1]?.content).toContain('URL encoding');
    expect(realtime.messages[realtime.messages.length - 1]?.content).toContain('Base64');
    expect(realtime.messages[realtime.messages.length - 1]?.content).toContain('not vou despejar nem decodificar');
    expect(realtime.messages[realtime.messages.length - 1]?.content).not.toContain(encodedText);
  });

  it('answers honestly when binary attachments arrive without usable content', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'should-not-run' }));
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:56:00.000Z'),
      idFactory: (prefix: string) => `${prefix}-binary-attachment`,
    });
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
      agentGateway,
    });

    const result = await service.processChatSend({
      sessionId: 'session-dashboard-binary',
      message: 'analise esse anexo',
      attachments: [
        {
          name: 'foto.png',
          type: 'image/png',
          size: 2048,
          text: null,
        },
      ],
    });

    expect(result.taskId).toBeNull();
    expect(result.responseDecision).toBeNull();
    expect(sendToSession).not.toHaveBeenCalled();
    expect(agentGateway.buildSnapshot({ activeSessionId: 'session-dashboard-binary' }).activeRun).toBeNull();
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-dashboard-binary',
      expect.stringContaining('arrived as metadata only'),
      null,
      'attachment-unsupported',
    );
  });

  it('routes Dashboard natural web research through governed capability negotiation', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'task-universal-web' }));
    const sharedSurface = {
      maybeHandle: jest.fn(async () => false),
    };
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T15:00:00.000Z'),
      idFactory: (() => {
        let index = 0;
        return (prefix: string) => {
          index += 1;
          return `${prefix}-${index}`;
        };
      })(),
    });
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => sharedSurface as any,
      agentGateway,
    });

    const result = await service.processChatSend({
      sessionId: 'session-dashboard',
      message: 'pesquise recent articles about autonomous agents',
    });

    expect(sendToSession).not.toHaveBeenCalled();
    expect(result.taskId).toBeNull();
    expect(result.responseDecision).toEqual(
      expect.objectContaining({
        mode: 'operation',
        responsePath: 'agent-runtime',
        requestedTools: expect.arrayContaining(['network_fetch']),
        shouldShowArtifactInChat: false,
      }),
    );
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-dashboard',
      expect.stringContaining('I need your confirmation'),
      null,
      'universal-agent-runtime',
    );
    const snapshot = agentGateway.buildSnapshot({ activeSessionId: 'session-dashboard' });
    expect(snapshot.activeRun).toEqual(
      expect.objectContaining({
        sessionId: 'session-dashboard',
        channel: 'web',
        status: 'waiting_approval',
        summary: 'Capability Negotiation waiting for approval de escopo.',
        approvals: [
          expect.objectContaining({
            status: 'pending',
            risk: 'attention',
          }),
        ],
      }),
    );
    expect(snapshot.activeRun?.toolExposure.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'network_fetch',
          risk: 'attention',
          requiresApproval: false,
        }),
      ]),
    );
    expect(snapshot.activeRun?.metadata).toEqual(
      expect.objectContaining({
        artifactPolicy: expect.objectContaining({
          shouldShowArtifactInChat: false,
        }),
        responseDecision: expect.objectContaining({
          responsePath: 'agent-runtime',
        }),
      }),
    );
  });

  it('clamps dynamic workflow fanout to the selected effort budget', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'task-universal-workflow' }));
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T15:05:00.000Z'),
      idFactory: (() => {
        let index = 0;
        return (prefix: string) => {
          index += 1;
          return `${prefix}-${index}`;
        };
      })(),
    });
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
      agentGateway,
    });

    await service.processChatSend({
      sessionId: 'session-dashboard-workflow-budget',
      message: 'pesquise recent articles about autonomous agents',
      composerSettings: { effort: 'low' },
      workflowIntent: {
        source: 'slash-command',
        kind: 'governed-workflow',
        command: '/workflows',
        dynamicWorkflow: true,
        maxFanout: 999,
      },
    });

    const snapshot = agentGateway.buildSnapshot({ activeSessionId: 'session-dashboard-workflow-budget' });
    expect(snapshot.activeRun?.metadata).toEqual(
      expect.objectContaining({
        dynamicWorkflow: expect.objectContaining({
          command: '/workflows',
          maxFanout: 1,
          effortLevel: 'low',
          budgetGuardRequired: true,
        }),
        effortControl: expect.objectContaining({
          effectiveLevel: 'low',
          budget: expect.objectContaining({
            maxSubagents: 1,
          }),
        }),
      }),
    );

    await service.processChatSend({
      sessionId: 'session-dashboard-workflow-fractional-budget',
      message: 'compare notas de research em paralelo',
      composerSettings: { effort: 'low' },
      workflowIntent: {
        source: 'slash-command',
        kind: 'governed-workflow',
        command: '/workflows',
        dynamicWorkflow: true,
        maxFanout: 0.5,
      },
    });

    const fractionalSnapshot = agentGateway.buildSnapshot({
      activeSessionId: 'session-dashboard-workflow-fractional-budget',
    });
    expect(fractionalSnapshot.activeRun?.metadata).toEqual(
      expect.objectContaining({
        dynamicWorkflow: expect.objectContaining({
          command: '/workflows',
          maxFanout: 1,
          effortLevel: 'low',
          budgetGuardRequired: true,
        }),
        effortControl: expect.objectContaining({
          budget: expect.objectContaining({
            maxSubagents: 1,
          }),
        }),
      }),
    );
  });

  it('stops risky Dashboard requests at the Universal Agent approval gate', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'should-not-run' }));
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T16:00:00.000Z'),
      idFactory: (() => {
        let index = 0;
        return (prefix: string) => {
          index += 1;
          return `${prefix}-${index}`;
        };
      })(),
    });
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
      agentGateway,
    });

    const result = await service.processChatSend({
      sessionId: 'session-dashboard-risk',
      message: 'run a terminal command to fix everything',
    });

    expect(sendToSession).not.toHaveBeenCalled();
    expect(result.taskId).toBeNull();
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-dashboard-risk',
      expect.stringContaining('I need your confirmation'),
      null,
      'universal-agent-runtime',
    );
    expect(agentGateway.buildSnapshot({ activeSessionId: 'session-dashboard-risk' }).activeRun).toEqual(
      expect.objectContaining({
        status: 'waiting_approval',
        approvals: [
          expect.objectContaining({
            status: 'pending',
            risk: 'danger',
          }),
        ],
      }),
    );
  });

  it('records a resource preflight for heavy chat requests before dispatching the task', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'task-web-2' }));
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
      taskResourcePlanner: {
        planChatTask: jest.fn(async () => ({
          generatedAt: '2026-04-14T16:00:00.000Z',
          taskKind: 'chat',
          intent: 'Rode uma automaction visual em sandbox',
          heavy: true,
          approvalRequired: true,
          summary: 'Planner detectou trilhas pesadas.',
          userFacingSummary: 'Para cumprir isso eu posso need de QA visual e Sandbox.',
          budget: {
            ramMb: 352,
            cpuPercent: 42,
            diskMb: 2560,
            processCount: 2,
            externalExposure: 'local',
            recurring: false,
            companionDependencies: ['wsl', 'docker-desktop'],
            capabilityIds: ['qa', 'sandbox'],
            fallback: 'Seguir no core com smoke textual.',
            notes: [],
          },
          capabilityEstimates: [],
          companionEstimates: [],
          warnings: [],
        })),
        renderImpactSummary: jest.fn(() => 'Impacto estimado: QA visual e Sandbox.'),
      } as any,
    });

    const result = await service.processChatSend({
      sessionId: 'session-web-3',
      message: 'Rode uma automaction visual em sandbox',
    });

    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-web-3',
      'Impacto estimado: QA visual e Sandbox.',
      null,
      'resource-impact',
    );
    expect(result.resourceImpact).toEqual(
      expect.objectContaining({
        heavy: true,
        approvalRequired: true,
      }),
    );
    expect(sendToSession).toHaveBeenCalled();
  });

  it('blocks dispatch and returns a mode escalation when the current mode is insufficient', async () => {
    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'task-web-3' }));
    const service = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession }) as any,
      getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) }) as any,
      taskResourcePlanner: {
        planChatTask: jest.fn(async () => createImpact()),
        renderImpactSummary: jest.fn(() => 'Impacto estimado.'),
      } as any,
      modeEscalation: {
        evaluateChatRequest: jest.fn(() => ({
          allowed: false,
          request: {
            id: 'mode-escalation-builder-1',
            createdAt: '2026-04-14T18:00:00.000Z',
            updatedAt: '2026-04-14T18:00:00.000Z',
            sessionId: 'session-web-4',
            requestedBy: 'web-user',
            intent: 'edit this code',
            currentMode: { id: 'chat' },
            effectiveMode: { id: 'chat' },
            requiredMode: { id: 'builder' },
            reason: 'a tarefa pede trilthere is de construcao',
            reasons: ['a tarefa pede trilthere is de construcao'],
            recommendedScope: 'once',
            supportedScopes: ['once', 'session', 'host'],
            fallback: 'Responder conceitualmente.',
            summary: 'Para cumprir isso, eu preciso subir de chat para builder.',
            status: 'pending',
            resourceImpact: null,
            resolution: {
              decidedAt: null,
              decidedBy: null,
              scope: null,
              grantId: null,
            },
          },
          snapshot: {
            generatedAt: '2026-04-14T18:00:00.000Z',
            sessionId: 'session-web-4',
            baseMode: { id: 'chat' },
            effectiveMode: { id: 'chat' },
            status: 'pending',
            activeGrants: [],
            pendingRequest: { id: 'mode-escalation-builder-1' },
            recentRequests: [],
            commands: {
              show: '/mode',
              approve: '/mode approve <requestId> [once|session|host]',
              reject: '/mode reject <requestId>',
              inspect: '/api/web/runtime/mode-escalation-sessionId=:id',
              resolve: '/api/web/runtime/mode-escalation/resolve',
            },
          },
        })),
        buildSnapshot: jest.fn(() => null),
      } as any,
    });

    const result = await service.processChatSend({
      sessionId: 'session-web-4',
      message: 'edit this code',
    });

    expect(sendToSession).not.toHaveBeenCalled();
    expect(result.taskId).toBeNull();
    expect(result.modeEscalation).toEqual(
      expect.objectContaining({
        status: 'pending',
      }),
    );
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-web-4',
      expect.stringContaining('/mode approve mode-escalation-builder-1'),
      null,
      'mode-escalation',
    );
  });

  describe('onboarding conversational setup interception', () => {
    it('intercepts chat messages and runs conversational setup when personalization is pending', async () => {
      const realtime = createRealtimeMock();
      const sendToSession = jest.fn();

      personalizationSpy.mockReturnValue({
        pending: true,
        reasons: ['USER.md has pending fields'],
        files: {
          identity: '',
          soul: '',
          user: '',
          bootstrap: '',
          domain: '',
          learningStyle: '',
          errorHandling: '',
          outputFormat: '',
          timeAutomation: '',
        },
        bootstrapExists: false,
        missingUserFields: ['Name'],
        identityName: 'Zavorth',
      });

      const intakeSpy = jest
        .spyOn(ZavorthConversationalSetupService.prototype, 'runFirstMessageIntake')
        .mockResolvedValue({
          reply: 'What is your name-',
          finished: false,
          status: 'awaiting_confirmation',
          confirmationToken: 'trusted-confirm-token',
          preview: {
            agentIntroduction: 'Zavorth',
            userSummary: 'Local user',
            operatingStyle: 'Safe',
            firstMission: 'Review files',
          },
        });

      const service = new WebAppConversationService({
        runtime: {
          webUserId: 'web-user',
          projectRoot: '/fake/root',
        } as any,
        realtime: realtime as any,
        getGatewaySessionTools: () => ({ sendToSession }) as any,
      });

      const result = await service.processChatSend({
        sessionId: 'session-web-onboard-1',
        deviceLocale: 'pt-BR',
        onboardingConfirmationToken: 'trusted-confirm-token',
        message: 'Hello',
      });

      expect(personalizationSpy).toHaveBeenCalled();
      expect(intakeSpy).toHaveBeenCalled();
      expect(intakeSpy).toHaveBeenCalledWith('session-web-onboard-1', expect.any(Array), expect.any(Object), {
        locale: 'pt-BR',
        confirmPreviewToken: 'trusted-confirm-token',
      });
      expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
        'session-web-onboard-1',
        'What is your name-',
        null,
        'conversational-setup-reply',
      );
      expect(result.sessionId).toBe('session-web-onboard-1');
      expect(result.taskId).toBeNull();
      expect(result.onboarding).toEqual(
        expect.objectContaining({
          status: 'awaiting_confirmation',
          confirmationToken: 'trusted-confirm-token',
        }),
      );

      intakeSpy.mockRestore();
    });
  });
});

function createImpact() {
  return {
    generatedAt: '2026-04-14T18:00:00.000Z',
    taskKind: 'chat',
    intent: 'edit this code',
    heavy: false,
    approvalRequired: false,
    summary: 'Sem impacto pesado.',
    userFacingSummary: 'Posso seguir no core.',
    budget: {
      ramMb: 0,
      cpuPercent: 0,
      diskMb: 0,
      processCount: 0,
      externalExposure: 'none',
      recurring: false,
      companionDependencies: [],
      capabilityIds: [],
      fallback: 'Responder conceitualmente.',
      notes: [],
    },
    capabilityEstimates: [],
    companionEstimates: [],
    warnings: [],
  };
}
