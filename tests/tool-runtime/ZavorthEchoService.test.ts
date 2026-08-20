import { ZavorthEchoService } from '../../src/services/ZavorthEchoService';
import { ProviderFactory } from '../../src/providers/ProviderFactory';
import { HomeAssistantBridge } from '../../src/tool-runtime/tools/iot/HomeAssistantBridge.js';
import { EchoVoiceTelemetryService } from '../../src/domain/observability/infrastructure/EchoVoiceTelemetryService.js';
import { LlmRuntimeService } from '../../src/services/llm/LlmRuntimeService.js';

describe('ZavorthEchoService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    ProviderFactory.clearCache();
  });

  function mockProvider(toolName: string, args: Record<string, unknown>) {
    jest.spyOn(LlmRuntimeService.prototype, 'chat').mockResolvedValue({
      content: null,
      toolCalls: [{ id: 'call-1', name: toolName, arguments: args }],
      finishReason: 'tool_calls',
    } as any);
  }

  it('uses the configured Echo LLM fallback order for provider execution', () => {
    const service = new ZavorthEchoService({
      llmProvider: 'ollama',
      llmFallbackOrder: [' VLLM ', 'openai', 'vllm', '', 'Gemini'],
    });

    expect((service as any).buildLlmRunOptions()).toEqual({
      providerName: 'ollama',
      allowFallback: true,
      fallbackOrder: ['vllm', 'openai', 'gemini'],
    });
  });

  it('creates a pending permission instead of executing screenshot immediately', async () => {
    mockProvider('os_screenshot', { mode: 'fullscreen', returnBase64: false });
    const service = new ZavorthEchoService({ llmProvider: 'openai' });

    const result = await service.processIntent('tire um print');

    expect(result.executionEntry.status).toBe('permission_pending');
    expect(result.toolsExecuted).toEqual([]);
    expect(result.permissionsRequested).toHaveLength(1);
    expect(service.getPendingPermissions()).toHaveLength(1);
    expect(service.getHistory(1)[0].toolCalls[0].securityDecision).toBe('permission_required');
  });

  it('approves a pending permission once and resumes the tool execution', async () => {
    mockProvider('os_screenshot', { mode: 'fullscreen', returnBase64: false });
    const service = new ZavorthEchoService({ llmProvider: 'openai' });
    await service.processIntent('tire um print');
    const permission = service.getPendingPermissions()[0];

    const executePipeline = jest
      .spyOn((service as any).orchestrator, 'executePipeline')
      .mockResolvedValue('OK: screenshot capturado');

    const result = await service.resolvePermission(permission.id, true);
    const secondAttempt = await service.resolvePermission(permission.id, true);

    expect(result.ok).toBe(true);
    expect(result.status).toBe('approved');
    expect(result.toolsExecuted).toEqual(['os_screenshot']);
    expect(executePipeline).toHaveBeenCalledTimes(1);
    expect(secondAttempt.ok).toBe(false);
  });

  it('denies a pending permission without executing the tool', async () => {
    mockProvider('os_screenshot', { mode: 'fullscreen', returnBase64: false });
    const service = new ZavorthEchoService({ llmProvider: 'openai' });
    await service.processIntent('tire um print');
    const permission = service.getPendingPermissions()[0];

    const executePipeline = jest.spyOn((service as any).orchestrator, 'executePipeline');
    const result = await service.resolvePermission(permission.id, false);

    expect(result.ok).toBe(true);
    expect(result.status).toBe('denied');
    expect(result.executionEntry?.status).toBe('permission_denied');
    expect(executePipeline).not.toHaveBeenCalled();
    expect(service.getPendingPermissions()).toHaveLength(0);
  });

  it('keeps canonical history in the ledger without relying on the orchestrator in-memory log', async () => {
    const oldUrl = process.env.HOME_ASSISTANT_URL;
    const oldToken = process.env.HOME_ASSISTANT_TOKEN;
    delete process.env.HOME_ASSISTANT_TOKEN;
    mockProvider('iot_home_assistant', { entity_id: 'light.sala', action: 'turn_on' });
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      text: async () => '',
    } as any);

    try {
      const service = new ZavorthEchoService({ llmProvider: 'openai' });
      process.env.HOME_ASSISTANT_URL = 'http://localhost:8123';
      process.env.HOME_ASSISTANT_TOKEN = 'test-token';
      const pending = await service.processIntent('ligue a luz da sala');
      const permission = service.getPendingPermissions()[0];
      const result = await service.resolvePermission(permission.id, true);

      expect(pending.executionEntry.status).toBe('permission_pending');
      expect(result.executionEntry?.status).toBe('success');
      expect(service.getHistory(1)).toHaveLength(1);
      expect((service as any).orchestrator.getExecutionLog()).toEqual([]);
    } finally {
      fetchSpy.mockRestore();
      if (oldUrl === undefined) {
        delete process.env.HOME_ASSISTANT_URL;
      } else {
        process.env.HOME_ASSISTANT_URL = oldUrl;
      }
      if (oldToken === undefined) {
        delete process.env.HOME_ASSISTANT_TOKEN;
      } else {
        process.env.HOME_ASSISTANT_TOKEN = oldToken;
      }
    }
  });

  it('projects canonical lifecycle, artifact, and policy fields for IoT tool calls in the public history contract', async () => {
    const oldUrl = process.env.HOME_ASSISTANT_URL;
    const oldToken = process.env.HOME_ASSISTANT_TOKEN;
    mockProvider('iot_home_assistant', { entity_id: 'light.sala', action: 'turn_on' });
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      text: async () => '',
    } as any);

    try {
      const service = new ZavorthEchoService({ llmProvider: 'openai' });
      process.env.HOME_ASSISTANT_URL = 'http://localhost:8123';
      process.env.HOME_ASSISTANT_TOKEN = 'test-token';
      await service.processIntent('ligue a luz da sala');
      const permission = service.getPendingPermissions()[0];
      const result = await service.resolvePermission(permission.id, true);
      const toolCall = result.executionEntry?.toolCalls[0];

      expect(toolCall?.toolName).toBe('iot_home_assistant');
      expect(toolCall?.lifecycle).toEqual(
        expect.objectContaining({
          mode: 'event-bridge',
          status: expect.any(String),
        }),
      );
      expect(toolCall?.artifact).toEqual(
        expect.objectContaining({
          kind: 'iot-command',
          source: 'iot_home_assistant',
        }),
      );
      expect(toolCall?.policy).toEqual(
        expect.objectContaining({
          scope: 'loopback',
        }),
      );
    } finally {
      fetchSpy.mockRestore();
      if (oldUrl === undefined) {
        delete process.env.HOME_ASSISTANT_URL;
      } else {
        process.env.HOME_ASSISTANT_URL = oldUrl;
      }
      if (oldToken === undefined) {
        delete process.env.HOME_ASSISTANT_TOKEN;
      } else {
        process.env.HOME_ASSISTANT_TOKEN = oldToken;
      }
    }
  });

  it('embeds the canonical watch mode summary into the Echo snapshot for surfaces', async () => {
    jest.spyOn(HomeAssistantBridge.prototype, 'getRecentPhysicalEvents').mockReturnValue([
      {
        id: 'ha-event-1',
        source: 'iot_home_assistant',
        timestamp: '2026-04-18T10:00:10.000Z',
        entityId: 'lock.front_door',
        oldState: 'locked',
        newState: 'unlocked',
        feedback: 'Atencao: lock.front_door mudou para unlocked.',
        severity: 'critical',
      },
    ] as any);
    const service = new ZavorthEchoService({
      watchModeControlPlane: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-18T10:00:00.000Z',
          workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
          summary: {
            posture: 'attention',
            totalRuns: 2,
            activeStatus: 'waiting_approval',
            pendingApprovals: 1,
            artifactEntries: 4,
            throttledScreenshots: 2,
            droppedTimelineEntries: 1,
            averageApprovalLatencyMs: 3200,
            pausedRuns: 0,
            failedRuns: 0,
            completedRuns: 1,
            strictApprovalDefault: true,
            allowedApps: 1,
            allowedSites: 1,
          },
          cost: {
            level: 'moderate',
            score: 45,
            summary: '1 approval(s) pendente(s) | latencia media 3200ms',
          },
          cards: [
            {
              id: 'status',
              label: 'Status supervisionado',
              posture: 'attention',
              summary: 'Chrome | revisar dashboard.',
              nextAction: 'Revise a proxima acao.',
              command: 'npm run ops:watch-mode',
            },
          ],
          actions: [
            {
              id: 'review-approvals',
              label: 'Decidir approvals pendentes',
              severity: 'warn',
              reason: '1 approval ainda bloqueia a proxima acao visual.',
              command: '/watchmode',
            },
          ],
          watchMode: {
            generatedAt: '2026-04-18T10:00:00.000Z',
            summary: {
              totalRuns: 2,
              runningRuns: 0,
              pausedRuns: 0,
              waitingApprovalRuns: 1,
              pendingApprovals: 1,
              artifactEntries: 4,
              throttledScreenshots: 2,
              droppedTimelineEntries: 1,
              averageApprovalLatencyMs: 3200,
              lastStatus: 'waiting_approval',
            },
            policy: {
              strictApprovalDefault: true,
              allowedApps: ['chrome'],
              allowedSites: ['docs.example.com'],
            },
            activeRun: null,
            runs: [],
          },
          narrative: {
            headline: 'Watch mode: Watch Mode supervisionado',
            operatorSummary: 'Chrome aguarda decisao humana.',
            nextAction: 'Decidir approvals pendentes',
          },
        })),
      } as any,
    });
    jest.spyOn(service, 'testConnection').mockResolvedValue({
      online: true,
      model: 'gemma2:2b',
      providerName: 'ollama',
      latencyMs: 12,
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.watchMode).toEqual(
      expect.objectContaining({
        posture: 'attention',
        activeStatus: 'waiting_approval',
        pendingApprovals: 1,
        averageApprovalLatencyMs: 3200,
        cost: expect.objectContaining({
          level: 'moderate',
          score: 45,
        }),
        cards: [
          expect.objectContaining({
            id: 'status',
            posture: 'attention',
          }),
        ],
      }),
    );
    expect(snapshot.capabilityLifecycle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: 'iot_home_assistant',
          lifecycle: expect.objectContaining({
            status: expect.any(String),
          }),
        }),
        expect.objectContaining({
          toolName: 'iot_mqtt_publish',
          lifecycle: expect.objectContaining({
            status: expect.any(String),
          }),
        }),
      ]),
    );
    expect(snapshot.signals.recentPhysicalEvents).toEqual([
      expect.objectContaining({
        entityId: 'lock.front_door',
        severity: 'critical',
      }),
    ]);
  });

  it('does not auto-start standalone IoT bridge listeners inside the canonical runtime service', () => {
    const startListeningEvents = jest
      .spyOn(HomeAssistantBridge.prototype, 'startListeningEvents')
      .mockImplementation(() => undefined);

    new ZavorthEchoService();

    expect(startListeningEvents).not.toHaveBeenCalled();
  });

  it('synthesizes dashboard audio through Gemini and exposes voice metrics in the snapshot', async () => {
    const voiceTelemetry = new EchoVoiceTelemetryService({
      filePath: `C:\\TESTES DEV\\zavorth-core\\Zavorth\\tmp\\voice-metrics-${Date.now()}.jsonl`,
    });
    const service = new ZavorthEchoService({
      llmProvider: 'gemini',
      voiceTelemetry,
      geminiVoiceService: {
        isConfigured: () => true,
        synthesizeDetailed: jest.fn(async () => ({
          filePath: __filename,
          model: 'gemini-2.5-flash',
          voiceName: 'Kore',
          languageCode: 'en-US',
          mimeType: 'audio/wav',
          sourceMimeType: 'audio/pcm',
          latencyMs: 55,
          inputChars: 19,
          outputBytes: 512,
        })),
        cleanup: jest.fn(),
      } as any,
    });

    const result = await service.synthesizeSpeech({
      text: 'Fale no dashboard.',
      surface: 'dashboard',
      requestedBy: 'dashboard-ui',
      sessionId: 'dashboard-session',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected successful audio synthesis');
    }
    expect(result.model).toBe('gemini-2.5-flash');

    const snapshot = await service.buildSnapshot();
    expect(snapshot.voiceMetrics).toEqual(
      expect.objectContaining({
        totalRequests: 1,
        successes: 1,
        surfaces: [
          expect.objectContaining({
            surface: 'dashboard',
            lastModel: 'gemini-2.5-flash',
            lastVoiceName: 'Kore',
          }),
        ],
      }),
    );
  });
});
