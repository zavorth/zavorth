import { EchoOutputStageService } from '../../src/services/EchoOutputStageService';

describe('EchoOutputStageService', () => {
  function createDeps(active = true) {
    return {
      audioHandler: {
        synthesize: jest.fn().mockResolvedValue('C:/tmp/echo-output.mp3'),
        cleanup: jest.fn(),
      },
      preferenceStore: {
        isEchoModeActive: jest.fn().mockResolvedValue(active),
      },
    };
  }

  it('sends only voice when Echo is active and the surface supports voice', async () => {
    const deps = createDeps(true);
    const sink = {
      sendText: jest.fn().mockResolvedValue(undefined),
      sendVoice: jest.fn().mockResolvedValue(undefined),
      sendChatAction: jest.fn().mockResolvedValue(undefined),
    };

    const result = await new EchoOutputStageService(deps).deliver({
      surface: 'telegram',
      text: 'Ola, consigo responder por voz.',
      rawInput: '[Automatically transcribed audio]\nDetected language: en-US\noi',
      requestedBy: 'user-1',
      sessionId: 'chat-1',
      sink,
    });

    expect(result.delivered).toBe('voice');
    expect(sink.sendChatAction).toHaveBeenCalledWith('record_voice');
    expect(deps.audioHandler.synthesize).toHaveBeenCalledWith(
      'Ola, consigo responder por voz.',
      expect.objectContaining({
        preferredLanguageCode: 'en-US',
        policyHint: 'short_reply',
        surface: 'telegram',
        requestedBy: 'user-1',
        sessionId: 'chat-1',
      }),
    );
    expect(sink.sendVoice).toHaveBeenCalledWith('C:/tmp/echo-output.mp3');
    expect(deps.audioHandler.cleanup).toHaveBeenCalledWith('C:/tmp/echo-output.mp3');
    expect(sink.sendText).not.toHaveBeenCalled();
  });

  it('falls back to text when the surface has no voice sink', async () => {
    const deps = createDeps(true);
    const sink = {
      sendText: jest.fn().mockResolvedValue(undefined),
    };

    const result = await new EchoOutputStageService(deps).deliver({
      surface: 'web',
      text: 'Resposta textual no dashboard.',
      rawInput: 'mensagem web',
      sink,
    });

    expect(result.delivered).toBe('text');
    expect(deps.audioHandler.synthesize).not.toHaveBeenCalled();
    expect(sink.sendText).toHaveBeenCalledWith('Resposta textual no dashboard.', undefined);
  });

  it('can attempt voice without sending duplicate text fallback', async () => {
    const deps = createDeps(false);
    const sink = {
      sendText: jest.fn().mockResolvedValue(undefined),
      sendVoice: jest.fn().mockResolvedValue(undefined),
    };

    const result = await new EchoOutputStageService(deps).deliver({
      surface: 'telegram',
      text: 'Recebi seu audio, mas a transcricao veio inconsistente.',
      preferredLanguageCode: 'en-US',
      policyHint: 'safety',
      fallbackToText: false,
      sink,
    });

    expect(result.delivered).toBe('text');
    expect(deps.audioHandler.synthesize).not.toHaveBeenCalled();
    expect(sink.sendVoice).not.toHaveBeenCalled();
    expect(sink.sendText).not.toHaveBeenCalled();
  });

  it('honors a structured voice reply flag even when Echo mode is not globally active', async () => {
    const deps = createDeps(false);
    const sink = {
      sendText: jest.fn().mockResolvedValue(undefined),
      sendVoice: jest.fn().mockResolvedValue(undefined),
      sendChatAction: jest.fn().mockResolvedValue(undefined),
    };

    const result = await new EchoOutputStageService(deps).deliver({
      surface: 'telegram',
      text: 'Sim, posso responder por audio quando voce pedir.',
      rawInput: 'voce pode me responder em audio?',
      preferredLanguageCode: 'en-US',
      preferVoiceReply: true,
      sink,
    });

    expect(result.delivered).toBe('voice');
    expect(deps.preferenceStore.isEchoModeActive).not.toHaveBeenCalled();
    expect(deps.audioHandler.synthesize).toHaveBeenCalledWith(
      'Sim, posso responder por audio quando voce pedir.',
      expect.objectContaining({
        preferredLanguageCode: 'en-US',
      }),
    );
    expect(sink.sendVoice).toHaveBeenCalledWith('C:/tmp/echo-output.mp3');
    expect(sink.sendText).not.toHaveBeenCalled();
  });

  it('does not enable voice replies from free-text voice phrases alone', async () => {
    const deps = createDeps(false);
    const sink = {
      sendText: jest.fn().mockResolvedValue(undefined),
      sendVoice: jest.fn().mockResolvedValue(undefined),
      sendChatAction: jest.fn().mockResolvedValue(undefined),
    };

    const result = await new EchoOutputStageService(deps).deliver({
      surface: 'telegram',
      text: 'Sim, posso responder por audio quando voce pedir.',
      rawInput: 'voce pode me responder em audio?',
      preferredLanguageCode: 'en-US',
      sink,
    });

    expect(result.delivered).toBe('text');
    expect(deps.audioHandler.synthesize).not.toHaveBeenCalled();
    expect(sink.sendVoice).not.toHaveBeenCalled();
    expect(sink.sendText).toHaveBeenCalled();
  });

  it('keeps interactive replies as text', async () => {
    const deps = createDeps(true);
    const sink = {
      sendText: jest.fn().mockResolvedValue(undefined),
      sendVoice: jest.fn().mockResolvedValue(undefined),
    };

    await new EchoOutputStageService(deps).deliver({
      surface: 'telegram',
      text: 'Escolha uma opcao.',
      options: { reply_markup: { inline_keyboard: [] } },
      sink,
    });

    expect(deps.audioHandler.synthesize).not.toHaveBeenCalled();
    expect(sink.sendVoice).not.toHaveBeenCalled();
    expect(sink.sendText).toHaveBeenCalledWith('Escolha uma opcao.', {
      reply_markup: { inline_keyboard: [] },
    });
  });

  it('trims short-reply voice output to a latency-friendly size before synthesis', async () => {
    const deps = createDeps(true);
    const sink = {
      sendText: jest.fn().mockResolvedValue(undefined),
      sendVoice: jest.fn().mockResolvedValue(undefined),
      sendChatAction: jest.fn().mockResolvedValue(undefined),
    };
    const longReply = 'Resumo objetivo. '.repeat(50);

    await new EchoOutputStageService(deps).deliver({
      surface: 'telegram',
      text: longReply,
      rawInput: '[Automatically transcribed audio]\nDetected language: en-US\nresuma isso',
      requestedBy: 'user-1',
      sessionId: 'chat-1',
      sink,
    });

    const synthesizedText = (deps.audioHandler.synthesize as jest.Mock).mock.calls[0][0] as string;
    expect(synthesizedText.length).toBeLessThanOrEqual(320);
    expect(sink.sendVoice).toHaveBeenCalledWith('C:/tmp/echo-output.mp3');
    expect(sink.sendText).not.toHaveBeenCalled();
  });
});
