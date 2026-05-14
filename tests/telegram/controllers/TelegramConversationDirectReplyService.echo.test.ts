import { TelegramConversationDirectReplyService } from '../../../src/telegram/controllers/TelegramConversationDirectReplyService';

describe('TelegramConversationDirectReplyService Echo replies', () => {
  function createService() {
    const deps = {
      stateService: {
        decorateReplyWithContinuation: jest.fn((text: string) => text),
        recordDirectResponseOutcome: jest.fn(),
      } as any,
      recordAssistantMessage: jest.fn(),
      echoAudioHandler: {
        synthesize: jest.fn().mockResolvedValue('C:/tmp/echo.mp3'),
        cleanup: jest.fn(),
      },
      echoPreferenceStore: {
        isEchoModeActive: jest.fn().mockResolvedValue(true),
      },
    };

    const ctx = {
      chat: { id: 123 },
      api: {
        sendChatAction: jest.fn().mockResolvedValue(undefined),
      },
      reply: jest.fn().mockResolvedValue(undefined),
      replyWithVoice: jest.fn().mockResolvedValue(undefined),
    } as any;

    const task = {
      task_id: 'task-1',
      result_summary: null,
      metadata: { traceId: 'trace-voice-1', voiceFlow: { startedAtMs: 1000, sttLatencyMs: 200, llmLatencyMs: 300 } },
    } as any;

    return {
      deps,
      ctx,
      task,
      service: new TelegramConversationDirectReplyService(deps),
    };
  }

  it('sends only voice when Echo mode succeeds', async () => {
    const { deps, ctx, task, service } = createService();

    await service.sendDirectReply({
      ctx,
      task,
      messageText: '[Automatically transcribed audio]\nDetected language: en-US\noi',
      responseText: 'Ola, tudo certo.',
      taskKind: 'conversation' as any,
      taskSubtype: 'general' as any,
      styleHints: [],
    });

    expect(ctx.api.sendChatAction).toHaveBeenCalledWith(123, 'record_voice');
    expect(deps.echoAudioHandler.synthesize).toHaveBeenCalledWith('Ola, tudo certo.', expect.objectContaining({
      preferredLanguageCode: 'en-US',
      policyHint: 'short_reply',
      traceId: 'trace-voice-1',
      surface: 'telegram',
      requestedBy: 'telegram-bot',
      sessionId: '123',
    }));
    expect(ctx.replyWithVoice).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(deps.echoAudioHandler.cleanup).toHaveBeenCalledWith('C:/tmp/echo.mp3');
  });
});
