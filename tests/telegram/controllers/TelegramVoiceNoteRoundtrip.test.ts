import fs from 'fs';
import os from 'os';
import path from 'path';
import { TelegramMediaController } from '../../../src/gateways/channels/telegram/controllers/TelegramMediaController';
import type { AudioHandler } from '../../../src/gateways/channels/telegram/AudioHandler';
import type { VideoHandler } from '../../../src/services/media/VideoHandler';
import type { Context } from 'grammy';
import { config } from '../../../src/config/index';

const USER_ID = 777;
const CHAT_ID = 10;
const OGG_BYTES = Buffer.from('fake-ogg-audio-bytes', 'utf8');

type AudioHandlerFake = {
  transcribeDetailed: jest.Mock;
  transcribe: jest.Mock;
  synthesize: jest.Mock;
  cleanup: jest.Mock;
};

function buildAudioHandlerFake(overrides: Partial<AudioHandlerFake> = {}): AudioHandlerFake {
  return {
    transcribeDetailed: jest.fn(),
    transcribe: jest.fn(),
    synthesize: jest.fn().mockResolvedValue(path.join(os.tmpdir(), 'safety-reply.mp3')),
    cleanup: jest.fn(),
    ...overrides,
  };
}

function buildVideoHandlerStub(): VideoHandler {
  return { isVideoDocument: jest.fn().mockReturnValue(false) } as unknown as VideoHandler;
}

function buildContext(): Context & { reply: jest.Mock; replyWithVoice: jest.Mock } {
  return {
    from: { id: USER_ID, language_code: 'en-us' },
    chat: { id: CHAT_ID },
    message: {
      voice: {
        file_id: 'voice-golden-1',
        duration: 3,
        mime_type: 'audio/ogg',
      },
    },
    api: {
      sendChatAction: jest.fn().mockResolvedValue(undefined),
      getFile: jest.fn().mockResolvedValue({ file_path: 'audio/x.ogg' }),
    },
    reply: jest.fn().mockResolvedValue(undefined),
    replyWithVoice: jest.fn().mockResolvedValue(undefined),
  } as unknown as Context & { reply: jest.Mock; replyWithVoice: jest.Mock };
}

function spyFetchWithOggBytes(): jest.Mock {
  const response = {
    arrayBuffer: async () =>
      OGG_BYTES.buffer.slice(
        OGG_BYTES.byteOffset,
        OGG_BYTES.byteOffset + OGG_BYTES.byteLength,
      ),
  };
  return jest.spyOn(global, 'fetch').mockResolvedValue(response as unknown as Response);
}

describe('TelegramMediaController voice note roundtrip', () => {
  let tempDir: string;
  const originalTmpDir = config.tmpDir;
  const originalAudioConfig = config.tools.media.audio;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-voice-roundtrip-'));
    config.tmpDir = tempDir;
    config.tools.media.audio = {
      ...originalAudioConfig,
      echoTranscript: false,
      forwardRawAudio: false,
    };
  });

  afterEach(() => {
    config.tmpDir = originalTmpDir;
    config.tools.media.audio = originalAudioConfig;
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('dispatches the transcript conversationally with full voice-flow metadata and cleans up the download', async () => {
    spyFetchWithOggBytes();
    const dispatchConversational = jest.fn().mockResolvedValue(undefined);
    const audioHandler = buildAudioHandlerFake({
      transcribeDetailed: jest.fn().mockResolvedValue({
        text: 'hello there',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        languageCode: 'en-US',
        latencyMs: 123,
        warnings: [],
        failures: [],
      }),
    });
    const controller = new TelegramMediaController(
      audioHandler as unknown as AudioHandler,
      buildVideoHandlerStub(),
      dispatchConversational,
      undefined,
      { isEchoModeActive: jest.fn().mockResolvedValue(true) },
    );
    const ctx = buildContext();

    await controller.handleVoice(ctx);

    expect(ctx.api.sendChatAction).toHaveBeenCalledWith(CHAT_ID, 'record_voice');
    expect(ctx.api.getFile).toHaveBeenCalledWith('voice-golden-1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.telegram.org/file/bot'),
      expect.objectContaining({ redirect: 'manual' }),
    );

    expect(dispatchConversational).toHaveBeenCalledTimes(1);
    const [dispatchCtx, messageText, inlineData, ingressMetadata] =
      dispatchConversational.mock.calls[0];
    expect(dispatchCtx).toBe(ctx);
    expect(messageText).toBe('hello there');
    expect(inlineData).toBeUndefined();
    expect(ingressMetadata).toEqual(
      expect.objectContaining({
        traceId: expect.stringContaining('telegram-voice-'),
        transport: 'voice',
        requestedBy: String(USER_ID),
        preferredLanguageCode: 'en-US',
        voiceFlow: expect.objectContaining({
          sttProvider: 'gemini',
          sttModel: 'gemini-2.5-flash',
          sttLanguageCode: 'en-US',
          sttLatencyMs: 123,
          durationSeconds: 3,
          inputBytes: OGG_BYTES.length,
          transcriptChars: 'hello there'.length,
          source: 'voice_dictation',
        }),
      }),
    );

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('hello there'));
    expect(ctx.replyWithVoice).not.toHaveBeenCalled();
    expect(audioHandler.synthesize).not.toHaveBeenCalled();
    expect(audioHandler.cleanup).toHaveBeenCalledTimes(1);
    expect(audioHandler.cleanup).toHaveBeenCalledWith(expect.stringContaining(tempDir));
  });

  it('answers with the safety voice reply and skips conversational dispatch when the transcript is impossible for the duration', async () => {
    spyFetchWithOggBytes();
    const dispatchConversational = jest.fn().mockResolvedValue(undefined);
    const oversizedTranscript = 'alpha '.repeat(120).trim();
    const audioHandler = buildAudioHandlerFake({
      transcribeDetailed: jest.fn().mockResolvedValue({
        text: oversizedTranscript,
        provider: 'openai',
        model: 'whisper-1',
        languageCode: 'en-US',
        latencyMs: 40,
        warnings: [],
        failures: [],
      }),
    });
    const controller = new TelegramMediaController(
      audioHandler as unknown as AudioHandler,
      buildVideoHandlerStub(),
      dispatchConversational,
      undefined,
      { isEchoModeActive: jest.fn().mockResolvedValue(true) },
    );
    const ctx = buildContext();

    await controller.handleVoice(ctx);

    expect(dispatchConversational).not.toHaveBeenCalled();
    expect(audioHandler.synthesize).toHaveBeenCalledWith(
      expect.stringContaining('I received your audio'),
      expect.anything(),
    );
    expect(ctx.replyWithVoice).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(audioHandler.cleanup).toHaveBeenCalledTimes(2);
    expect(audioHandler.cleanup).toHaveBeenNthCalledWith(
      1,
      path.join(os.tmpdir(), 'safety-reply.mp3'),
    );
    expect(audioHandler.cleanup).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(tempDir),
    );
  });

  it('answers with the safety voice reply when every STT provider fails', async () => {
    spyFetchWithOggBytes();
    const dispatchConversational = jest.fn().mockResolvedValue(undefined);
    const audioHandler = buildAudioHandlerFake({
      transcribeDetailed: jest.fn().mockRejectedValue(new Error('all speech providers failed')),
    });
    const controller = new TelegramMediaController(
      audioHandler as unknown as AudioHandler,
      buildVideoHandlerStub(),
      dispatchConversational,
      undefined,
      { isEchoModeActive: jest.fn().mockResolvedValue(true) },
    );
    const ctx = buildContext();

    await controller.handleVoice(ctx);

    expect(dispatchConversational).not.toHaveBeenCalled();
    expect(audioHandler.synthesize).toHaveBeenCalledWith(
      expect.stringContaining('I received your audio'),
      expect.anything(),
    );
    expect(ctx.replyWithVoice).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(audioHandler.cleanup).toHaveBeenCalledTimes(2);
    expect(audioHandler.cleanup).toHaveBeenNthCalledWith(
      1,
      path.join(os.tmpdir(), 'safety-reply.mp3'),
    );
    expect(audioHandler.cleanup).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(tempDir),
    );
  });
});
