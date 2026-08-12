import { ZavorthSessionPlaneService } from '../../src/services/ZavorthSessionPlaneService.js';

describe('ZavorthSessionPlaneService', () => {
  it('builds an official session plane snapshot from gateway and session tools', async () => {
    const service = new ZavorthSessionPlaneService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      sessionToolsService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            tools: 4,
            sessions: 2,
            historyItems: 3,
            linkedSurfaces: 2,
          },
          history: [{ id: 'task-1' }],
          narrative: {
            headline: 'Session tools prontos.',
            operatorSummary: 'Contexto pronto.',
          },
        })),
      } as any,
      gatewaySessionToolsService: {
        buildDescriptors: jest.fn(() => [
          { id: 'sessions_list', readiness: 'ready' },
          { id: 'sessions_send', readiness: 'ready' },
          { id: 'sessions_spawn', readiness: 'partial' },
        ]),
        listSessions: jest.fn(async () => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          runtimeUserId: 'runtime-user',
          total: 2,
          entries: [
            {
              id: 'web:session-1',
              label: 'web:session-1',
              latestTaskLabel: 'Retomar sessao 1',
              updatedAt: '2026-04-02T11:58:00.000Z',
            },
          ],
        })),
        readHistory: jest.fn(async () => ({
          replay: {
            headline: 'Replay pronto.',
            timeline: [{ label: 'Task', detail: 'Retomar task-1' }],
          },
          handoff: {
            operatorSummary: 'Handoff pronto.',
          },
          permissions: [{ status: 'pending' }],
        })),
      } as any,
      sessionStoreService: {
        resolveTarget: jest.fn(() => ({
          platform: 'web',
          chatId: 'web:session-1',
          sessionId: 'session-1',
          runtimeUserId: 'runtime-user',
          sourceUserId: 'session-1',
          label: 'web:session-1',
        })),
        canSpawn: jest.fn(() => true),
      } as any,
      channelRegistryService: {
        getChannel: jest.fn(() => ({
          id: 'web',
          label: 'Web',
          features: {
            sessionSend: true,
          },
        })),
      } as any,
    });

    const snapshot = await service.buildSnapshot({
      userId: 'runtime-user',
      sessionId: 'session-1',
      chatId: 'web:session-1',
      platform: 'web',
    });

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        commands: 4,
        tools: 3,
        sessions: 1,
        pendingPermissions: 1,
        sendReady: true,
        spawnReady: true,
      }),
    );
    expect(snapshot.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: '/sessions' }),
        expect.objectContaining({ command: '/sessionsend', readiness: 'ready' }),
      ]),
    );
    expect(snapshot.current).toEqual(
      expect.objectContaining({
        history: expect.objectContaining({
          handoff: expect.objectContaining({
            operatorSummary: 'Handoff pronto.',
          }),
        }),
      }),
    );
  });

  it('renders overview and history reports', async () => {
    const service = new ZavorthSessionPlaneService({
      sessionToolsService: {
        buildSnapshot: jest.fn(() => ({
          summary: { linkedSurfaces: 1 },
          history: [],
          narrative: {
            headline: 'Session tools prontos.',
            operatorSummary: 'Operator summary.',
          },
        })),
      } as any,
      gatewaySessionToolsService: {
        buildDescriptors: jest.fn(() => []),
        listSessions: jest.fn(async () => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          runtimeUserId: 'user-1',
          total: 1,
          entries: [],
        })),
        readHistory: jest.fn(async () => ({
          replay: {
            headline: 'Replay pronto.',
            operatorSummary: 'Leitura consolidada.',
            recommendedEntry: {
              label: 'Retomar task-1',
              reason: 'Ainda e o melhor ponto de entrada.',
            },
            timeline: [{ label: 'Task', detail: 'Passo importante' }],
          },
          handoff: {
            operatorSummary: 'Handoff pronto.',
          },
          tasks: [
            {
              task_id: 'task-1',
              command_type: '/task',
              raw_message: 'continue',
              result_summary: 'Resumo recente',
            },
          ],
          transcript: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'continue',
              createdAt: '2026-04-02T11:55:00.000Z',
            },
            {
              id: 'msg-2',
              role: 'assistant',
              content: 'Resumo recente',
              createdAt: '2026-04-02T11:56:00.000Z',
            },
          ],
          permissions: [],
        })),
        sendToSession: jest.fn(),
        spawnSession: jest.fn(),
      } as any,
      sessionStoreService: {
        resolveTarget: jest.fn(() => ({
          platform: 'web',
          chatId: 'web:session-1',
          sessionId: 'session-1',
          runtimeUserId: 'user-1',
          sourceUserId: 'session-1',
          label: 'web:session-1',
        })),
        canSpawn: jest.fn(() => false),
      } as any,
    });

    const overview = await service.renderOverviewReport({
      userId: 'user-1',
      sessionId: 'session-1',
      platform: 'web',
      chatId: 'web:session-1',
    });
    const history = await service.renderHistoryReport({
      userId: 'user-1',
      sessionId: 'session-1',
      platform: 'web',
      chatId: 'web:session-1',
    });

    expect(overview).toContain('Session plane do Zavorth');
    expect(overview).toContain('/sessions');
    expect(history).toContain('Historico oficial da sessao');
    expect(history).toContain('Retomar task-1');
    expect(history).toContain('Resumo recente');
    expect(history).toContain('Transcript recente:');
    expect(history).toContain('assistant: Resumo recente');
  });

  it('builds a shallow status summary without loading current session history when no target is selected', async () => {
    const buildSessionTools = jest.fn(() => ({
      summary: { linkedSurfaces: 1 },
      history: [{ id: 'task-1' }],
      narrative: {
        headline: 'Session tools prontos.',
        operatorSummary: 'Operator summary.',
      },
    }));
    const readHistory = jest.fn(async () => ({
      replay: {
        headline: 'Replay pronto.',
        timeline: [{ label: 'Task', detail: 'Passo importante' }],
      },
      handoff: {
        operatorSummary: 'Handoff pronto.',
      },
      permissions: [],
    }));
    const listSessions = jest.fn(async () => ({
      generatedAt: '2026-04-02T12:00:00.000Z',
      runtimeUserId: 'user-1',
      total: 2,
      entries: [
        {
          id: 'web:session-1',
          label: 'web:session-1',
          latestTaskLabel: 'Retomar sessao 1',
          updatedAt: '2026-04-02T11:58:00.000Z',
        },
      ],
    }));
    const listSessionsSummary = jest.fn(() => ({
      generatedAt: '2026-04-02T12:00:00.000Z',
      runtimeUserId: 'user-1',
      total: 2,
      visible: 1,
    }));

    const service = new ZavorthSessionPlaneService({
      sessionToolsService: {
        buildSnapshot: buildSessionTools,
      } as any,
      gatewaySessionToolsService: {
        buildDescriptors: jest.fn(() => [
          { id: 'sessions_list', readiness: 'ready' },
          { id: 'sessions_send', readiness: 'ready' },
        ]),
        listSessionsSummary,
        listSessions,
        readHistory,
        sendToSession: jest.fn(),
        spawnSession: jest.fn(),
      } as any,
      sessionStoreService: {
        resolveTarget: jest.fn(() => null),
        canSpawn: jest.fn(() => true),
      } as any,
    });

    const snapshot = await service.buildStatusSummary({
      userId: 'user-1',
      platform: 'web',
      chatId: null,
      sessionId: null,
    });

    expect(snapshot.summary).toEqual({
      sessions: 1,
      historyItems: 0,
      sendReady: true,
      spawnReady: true,
    });
    expect(listSessionsSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
      }),
    );
    expect(listSessions).not.toHaveBeenCalled();
    expect(readHistory).not.toHaveBeenCalled();
    expect(buildSessionTools).not.toHaveBeenCalled();
  });

  it('delegates send and spawn through the official gateway session tools', async () => {
    const sendToSession = jest.fn(async () => ({
      ok: true,
      taskId: 'task-123',
      chatId: 'web:session-2',
      sessionId: 'session-2',
      platform: 'web',
      snapshot: null,
    }));
    const spawnSession = jest.fn(async () => ({
      ok: true,
      platform: 'web',
      sessionId: 'session-3',
      chatId: 'web:session-3',
      sourceUserId: 'session-3',
      runtimeUserId: 'user-1',
      handoffCommand: '/open-session session-3',
    }));

    const service = new ZavorthSessionPlaneService({
      gatewaySessionToolsService: {
        buildDescriptors: jest.fn(() => []),
        listSessions: jest.fn(async () => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          runtimeUserId: 'user-1',
          total: 0,
          entries: [],
        })),
        readHistory: jest.fn(async () => null),
        sendToSession,
        spawnSession,
      } as any,
      sessionStoreService: {
        resolveTarget: jest.fn(() => null),
        canSpawn: jest.fn(() => true),
      } as any,
    });

    const sendResult = await service.sendToSession({
      userId: 'user-1',
      platform: 'web',
      chatId: 'web:session-2',
      sessionId: 'session-2',
      text: 'continue',
    });
    const spawnResult = await service.spawnSession({
      userId: 'user-1',
      platform: 'web',
    });

    expect(sendResult.taskId).toBe('task-123');
    expect(spawnResult.sessionId).toBe('session-3');
    expect(sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-2',
        text: 'continue',
      }),
    );
    expect(spawnSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        platform: 'web',
      }),
    );
  });

  it('propagates gateway session tool failures for send and spawn', async () => {
    const sendToSession = jest.fn(async () => {
      throw new Error('envio bloqueado');
    });
    const spawnSession = jest.fn(async () => {
      throw new Error('spawn bloqueado');
    });
    const service = new ZavorthSessionPlaneService({
      gatewaySessionToolsService: {
        buildDescriptors: jest.fn(() => []),
        listSessions: jest.fn(async () => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          runtimeUserId: 'user-1',
          total: 0,
          entries: [],
        })),
        readHistory: jest.fn(async () => null),
        sendToSession,
        spawnSession,
      } as any,
      sessionStoreService: {
        resolveTarget: jest.fn(() => null),
        canSpawn: jest.fn(() => true),
      } as any,
    });

    await expect(
      service.sendToSession({
        userId: 'user-1',
        platform: 'web',
        chatId: 'web:session-2',
        sessionId: 'session-2',
        text: 'continue',
      }),
    ).rejects.toThrow('envio bloqueado');

    await expect(
      service.spawnSession({
        userId: 'user-1',
        platform: 'web',
      }),
    ).rejects.toThrow('spawn bloqueado');
  });
});
