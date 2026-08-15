import { WebAppConversationService } from '../../../src/services/WebAppConversationService';
import { SurfaceOperationalIntentService } from '../../../src/services/SurfaceOperationalIntentService';
import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';
import type { UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createRealtimeMock() {
  const messages: Array<{
    role: string;
    content: string;
    kind?: string | null;
    mentions?: unknown[];
  }> = [];

  return {
    messages,
    createSession: jest.fn(() => 'web-session-1'),
    ensureSession: jest.fn(),
    getChatId: jest.fn((sessionId: string) => `web:${sessionId}`),
    recordUserMessage: jest.fn((_sessionId: string, content: string, _taskId?: string | null, mentions?: unknown[]) => {
      messages.push({ role: 'user', content, mentions });
      return messages[messages.length - 1];
    }),
    recordAssistantMessage: jest.fn((
      _sessionId: string,
      content: string,
      _taskId?: string | null,
      kind?: string | null,
    ) => {
      messages.push({ role: 'assistant', content, kind });
      return messages[messages.length - 1];
    }),
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

function createRuntime(overrides: Record<string, unknown> = {}) {
  return {
    webUserId: 'web-user',
    providerLabel: 'Gemini',
    modelLabel: 'gemini-2.5-flash',
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
    ...overrides,
  };
}

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-qa-${index}`;
  };
}

let surfaceOperationalIntentService: SurfaceOperationalIntentService;

function createConversationService(input: {
  runtime?: Record<string, unknown>;
  realtime?: ReturnType<typeof createRealtimeMock>;
  sendToSession?: jest.Mock;
  agentGateway?: ZavorthAgentGateway | null;
}) {
  const realtime = input.realtime || createRealtimeMock();
  const sendToSession = input.sendToSession || jest.fn(async () => ({ taskId: 'task-zavorthControl-qa' }));
  const agentGateway = input.agentGateway === undefined
    ? new ZavorthAgentGateway({
        now: () => new Date('2026-04-27T12:00:00.000Z'),
        idFactory: createIdFactory(),
      })
    : input.agentGateway;

  const service = new WebAppConversationService({
    runtime: createRuntime(input.runtime) as any,
    realtime: realtime as any,
    getGatewaySessionTools: () => ({ sendToSession } as any),
    getSharedSurfaceCommandService: () => ({ maybeHandle: jest.fn(async () => false) } as any),
    agentGateway,
    surfaceOperationalIntentService,
  });

  return {
    service,
    realtime,
    sendToSession,
    agentGateway,
  };
}

describe('ZavorthControl response cortex QA gate', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
    surfaceOperationalIntentService = new SurfaceOperationalIntentService({
      semanticClassifier: null,
    });
    jest
      .spyOn(surfaceOperationalIntentService, 'classifyWithSemantic')
      .mockImplementation(async (input) => surfaceOperationalIntentService.classify(input));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes simple conversation through the universal gateway without tasks, approvals, or artifacts', async () => {
    const { service, realtime, sendToSession, agentGateway } = createConversationService({});

    const result = await service.processChatSend({
      sessionId: 'qa-simple-chat',
      message: 'oi',
    });

    expect(result.taskId).toBeNull();
    expect(sendToSession).not.toHaveBeenCalled();
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.sessionId).toBe('qa-simple-chat');
    expect(realtime.recordAssistantMessage).toHaveBeenCalled();
  });

  it('keeps natural folder inspection local and out of the artifact pipeline', async () => {
    const { service, sendToSession, agentGateway } = createConversationService({});

    const result = await service.processChatSend({
      sessionId: 'qa-downloads-inspection',
      message: 'analise o que tem dentro da minha pasta downloads',
    });

    expect(result.taskId).toBeNull();
    expect(sendToSession).not.toHaveBeenCalled();
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.sessionId).toBe('qa-downloads-inspection');
  });

  it('preserves selected skills, text attachments and voice payloads while waiting for governed execution approval', async () => {
    const { service, sendToSession, agentGateway } = createConversationService({});

    const result = await service.processChatSend({
      sessionId: 'qa-rich-composer-payload',
      message: 'pesquise artigos recentes sobre agentes autonomos usando este resumo',
      attachments: [
        {
          name: 'resumo.md',
          type: 'text/markdown',
          size: 42,
          text: '# Tema\nAgentes autonomos locais.',
        },
      ],
      selectedSkills: [
        {
          id: 'web.search',
          title: 'Pesquisar na web',
          prompt: 'Pesquisar fontes recentes e confiaveis.',
        },
      ],
      voice: {
        transcript: 'search recent articles about autonomous agents',
        language: 'en-US',
        confidence: 0.92,
      },
    });

    expect(sendToSession).not.toHaveBeenCalled();
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.sessionId).toBe('qa-rich-composer-payload');
  });

  it('answers honestly for binary-only attachments instead of pretending to analyze them', async () => {
    const { service, realtime, sendToSession, agentGateway } = createConversationService({});

    const result = await service.processChatSend({
      sessionId: 'qa-binary-only-attachment',
      message: 'analise esse print',
      attachments: [
        {
          name: 'print.png',
          type: 'image/png',
          size: 120_000,
        },
      ],
    });

    expect(sendToSession).not.toHaveBeenCalled();
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.sessionId).toBe('qa-binary-only-attachment');
  });

  it('stops dangerous operations at the universal approval gate before dispatch', async () => {
    const { service, realtime, sendToSession, agentGateway } = createConversationService({});

    const result = await service.processChatSend({
      sessionId: 'qa-shell-approval',
      message: 'rode npm test no terminal',
    });

    expect(sendToSession).not.toHaveBeenCalled();
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.sessionId).toBe('qa-shell-approval');
  });

  it('allows user-facing artifact cards only for explicit deliverable artifact requests', async () => {
    const executor: UniversalAgentExecutor = ({ run }) => ({
      status: 'completed',
      summary: 'Relatorio PDF pronto.',
      replyText: 'Relatorio pronto para revisao.',
      artifacts: [
        {
          id: 'artifact-report-1',
          title: 'Relatorio em PDF',
          kind: 'report',
          createdAt: run.createdAt,
          sessionId: run.sessionId,
          status: 'ready',
          metadata: {
            format: 'pdf',
          },
        },
      ],
    });
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T12:30:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await gateway.handle({
      userId: 'web-user',
      channel: 'web',
      sessionId: 'qa-explicit-artifact',
      text: 'gere um relatorio em PDF',
      requestedTools: ['pdf.generate'],
      metadata: {
        capabilityNegotiationApproved: true,
        artifactPolicy: {
          shouldCreateArtifact: true,
          shouldShowArtifactInChat: true,
          reason: 'deliverable-artifact-requested',
        },
      },
    });

    expect(result.run.status).toBe('completed');
    expect(result.run.artifacts).toEqual([
      expect.objectContaining({
        id: 'artifact-report-1',
        title: 'Relatorio em PDF',
        status: 'ready',
      }),
    ]);
    expect(result.run.metadata).toEqual(expect.objectContaining({
      artifactPolicy: expect.objectContaining({
        shouldCreateArtifact: true,
        shouldShowArtifactInChat: true,
      }),
    }));
  });
});
