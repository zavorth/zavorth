import { config } from '../../src/config/index.js';
import { CodexRemoteNotificationService } from '../../src/services/CodexRemoteNotificationService';

describe('CodexRemoteNotificationService', () => {
  const originalToken = config.telegramBotToken;

  afterEach(() => {
    jest.restoreAllMocks();
    config.telegramBotToken = originalToken;
  });

  it('formats runtime presence and guardrail details into Telegram notifications', async () => {
    config.telegramBotToken = 'test-token';
    const fetchImpl = jest.fn(async (_url: string, init-: RequestInit) => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({}),
    } as any));
    const service = new CodexRemoteNotificationService({
      fetchImpl: fetchImpl as any,
    });

    const result = await service.notifySessionEvent(
      {
        sessionId: 'codex-1',
        title: 'Session 1',
        prompt: 'continue',
        profileId: 'default',
        workspaceRoot: 'C:\\repo',
        requestedBy: 'telegram-user',
        sourceSurface: 'telegram',
        sourceChatId: 'telegram:1657675475',
        status: 'running',
        createdAt: '2026-04-07T18:00:00.000Z',
        updatedAt: '2026-04-07T18:05:00.000Z',
        startedAt: '2026-04-07T18:00:00.000Z',
        finishedAt: null,
        lastHeartbeatAt: '2026-04-07T18:04:50.000Z',
        pid: 1234,
        runCount: 1,
        maxRuntimeSeconds: 1800,
        handoffWebSessionId: null,
        handoffCommand: null,
        logFilePath: null,
        outputFilePath: null,
        lastOutput: 'final answer',
        lastError: null,
        lastExitCode: null,
        metadata: {
          codexRemotePresence: {
            state: 'running',
            runtimeSeconds: 300,
            heartbeatAgeMs: 10000,
            stale: false,
          },
          codexRemoteGuardrails: {
            state: 'healthy',
            summary: 'Guardrail saudavel; faltam 1500s de 1800s.',
            timeoutSeconds: 1800,
            remainingSeconds: 1500,
          },
        },
        events: [],
      },
      {
        headline: 'Codex Remote completed',
        status: 'completed',
        summary: 'Session completed successfully.',
      },
    );

    expect(result.delivered).toBe(true);
    expect(result.targetChatId).toBe('1657675475');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    const text = new URLSearchParams(String(init?.body || '')).get('text') || '';
    expect(text).toContain('Presence: running');
    expect(text).toContain('Guardrail: healthy');
  });

  it('normalizes Telegram chat ids consistently', () => {
    const service = new CodexRemoteNotificationService({
      fetchImpl: jest.fn() as any,
    });

    expect(service.normalizeTelegramChatId('telegram:1657675475')).toBe('1657675475');
    expect(service.normalizeTelegramChatId('  -12345  ')).toBe('-12345');
    expect(service.normalizeTelegramChatId('')).toBeNull();
  });
});
