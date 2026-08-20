import { buildSharedSurfaceTelegramContext } from '../../src/telegram/bot-gateway/support/BotGatewayMessageProcessing';

describe('BotGateway shared surface Echo reply', () => {
  function createRuntime() {
    return {
      telegramChannelContractService: {
        buildContract: jest.fn().mockReturnValue({ threadId: null }),
      },
      echoPreferenceStore: {
        isEchoModeActive: jest.fn().mockResolvedValue(true),
      },
      echoAudioHandler: {
        synthesize: jest.fn().mockResolvedValue('C:/tmp/echo.mp3'),
        cleanup: jest.fn(),
      },
    } as any;
  }

  function createRuntimeWithEchoInactive() {
    const runtime = createRuntime();
    runtime.echoPreferenceStore.isEchoModeActive = jest.fn().mockResolvedValue(false);
    return runtime;
  }

  function createContext() {
    return {
      chat: { id: 456, type: 'private' },
      msg: { message_id: 99 },
      api: {
        sendChatAction: jest.fn().mockResolvedValue(undefined),
        editMessageText: jest.fn().mockResolvedValue(undefined),
      },
      reply: jest.fn().mockResolvedValue(undefined),
      replyWithVoice: jest.fn().mockResolvedValue(undefined),
    } as any;
  }

  it('does not send a duplicate text message after voice succeeds', async () => {
    const runtime = createRuntime();
    const ctx = createContext();
    const surfaceCtx = buildSharedSurfaceTelegramContext(
      runtime,
      ctx,
      '[Automatically transcribed audio]\nDetected language: en-US\noi',
      '456',
      'user-1',
    );

    await surfaceCtx.reply('Ola por voz.');

    expect(ctx.api.sendChatAction).toHaveBeenCalledWith(456, 'record_voice');
    expect(runtime.echoAudioHandler.synthesize).toHaveBeenCalledWith(
      'Ola por voz.',
      expect.objectContaining({
        preferredLanguageCode: 'en-US',
        policyHint: 'short_reply',
      }),
    );
    expect(ctx.replyWithVoice).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('keeps text replies when inline controls are attached', async () => {
    const runtime = createRuntime();
    const ctx = createContext();
    const surfaceCtx = buildSharedSurfaceTelegramContext(runtime, ctx, 'menu', '456', 'user-1');

    await surfaceCtx.reply('Escolha uma opcao.', { reply_markup: { inline_keyboard: [] } });

    expect(runtime.echoAudioHandler.synthesize).not.toHaveBeenCalled();
    expect(ctx.replyWithVoice).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Escolha uma opcao.', { reply_markup: { inline_keyboard: [] } });
  });

  it('synthesizes voice for structured preferVoiceReply even before global Echo is enabled', async () => {
    const runtime = createRuntimeWithEchoInactive();
    const ctx = createContext();
    const surfaceCtx = buildSharedSurfaceTelegramContext(
      runtime,
      ctx,
      'voce pode me responder em audio?',
      '456',
      'user-1',
      undefined,
      { voiceFlow: { preferVoiceReply: true } },
    );

    await surfaceCtx.reply('Sim, posso responder por audio quando voce pedir.');

    expect(runtime.echoPreferenceStore.isEchoModeActive).not.toHaveBeenCalled();
    expect(runtime.echoAudioHandler.synthesize).toHaveBeenCalledWith(
      'Sim, posso responder por audio quando voce pedir.',
      expect.objectContaining({
        preferredLanguageCode: 'auto',
      }),
    );
    expect(ctx.replyWithVoice).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('does not synthesize voice from free-text voice phrases alone when Echo is inactive', async () => {
    const runtime = createRuntimeWithEchoInactive();
    const ctx = createContext();
    const surfaceCtx = buildSharedSurfaceTelegramContext(
      runtime,
      ctx,
      'voce pode me responder em audio?',
      '456',
      'user-1',
    );

    await surfaceCtx.reply('Sim, posso responder por audio quando voce pedir.');

    expect(runtime.echoAudioHandler.synthesize).not.toHaveBeenCalled();
    expect(ctx.replyWithVoice).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Sim, posso responder por audio quando voce pedir.', undefined);
  });

  it('keeps medium Telegram Echo replies on the low-latency path', async () => {
    const runtime = createRuntime();
    const ctx = createContext();
    const surfaceCtx = buildSharedSurfaceTelegramContext(
      runtime,
      ctx,
      '[Automatically transcribed audio]\nDetected language: en-US\nresuma isso',
      '456',
      'user-1',
    );
    const mediumReply = 'Resumo objetivo. '.repeat(35);

    await surfaceCtx.reply(mediumReply);

    expect(runtime.echoAudioHandler.synthesize).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        preferredLanguageCode: 'en-US',
        policyHint: 'short_reply',
      }),
    );
  });
});
