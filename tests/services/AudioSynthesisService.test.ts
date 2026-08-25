import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';

import { config } from '../../src/config/index';
import { AudioSynthesisService, type MsEdgeTTSModule } from '../../src/services/AudioSynthesisService';
import { CapabilityUnavailableError } from '../../src/services/OptionalCapabilityGuard';

type EdgeTtsFake = {
  MsEdgeTTS: MsEdgeTTSModule;
  setMetadata: jest.Mock;
  toStream: jest.Mock;
  close: jest.Mock;
};

function buildEdgeTtsFake(): EdgeTtsFake {
  const setMetadata = jest.fn(async () => undefined);
  const toStream = jest.fn(() => ({
    audioStream: Readable.from([Buffer.from('edge-audio')]),
  }));
  const close = jest.fn();
  class FakeMsEdgeTTS {
    public setMetadata = setMetadata;
    public toStream = toStream;
    public close = close;
  }
  return { MsEdgeTTS: FakeMsEdgeTTS as unknown as MsEdgeTTSModule, setMetadata, toStream, close };
}

function buildVoiceTelemetryFake() {
  return {
    recordSuccess: jest.fn(async () => undefined),
    recordFailure: jest.fn(async () => undefined),
  };
}

describe('AudioSynthesisService', () => {
  let tmpDir: string;
  let generatedFiles: string[];

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-audio-synthesis-'));
    generatedFiles = [];
  });

  afterEach(async () => {
    await Promise.all(
      generatedFiles.map((filePath) => fs.promises.rm(filePath, { force: true }).catch(() => undefined)),
    );
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  function track(filePath: string | null): void {
    if (filePath) {
      generatedFiles.push(filePath);
    }
  }

  it('prefers Edge-TTS for short telegram replies when the local voice matches the language', async () => {
    const edge = buildEdgeTtsFake();
    const voiceTelemetryService = buildVoiceTelemetryFake();
    const geminiVoiceService = {
      isConfigured: jest.fn(() => true),
      synthesizeDetailed: jest.fn(async () => null),
      synthesize: jest.fn(async () => null),
      cleanup: jest.fn(),
    };
    const service = new AudioSynthesisService({
      geminiVoiceService,
      voiceTelemetryService,
      loadEdgeTts: async () => ({ MsEdgeTTS: edge.MsEdgeTTS }),
      tmpDir,
    });

    const output = await service.synthesize('Short telegram answer.', {
      surface: 'telegram',
      preferredLanguageCode: 'en-US',
      policyHint: 'short_reply',
    });

    track(output);
    expect(output).toMatch(/tts_.*\.mp3$/);
    expect(edge.setMetadata).toHaveBeenCalledWith(config.ttsVoiceEnglish || config.ttsVoice, 'audio-24khz-48kbitrate-mono-mp3');
    expect(geminiVoiceService.synthesizeDetailed).not.toHaveBeenCalled();
    expect(voiceTelemetryService.recordSuccess).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'edge-tts',
      surface: 'telegram',
      requestedBy: 'telegram-bot',
      mimeType: 'audio/mpeg',
    }));
  });

  it('prefers Gemini for long replies', async () => {
    const geminiFile = path.join(tmpDir, 'gemini-long.wav');
    await fs.promises.writeFile(geminiFile, 'wav');
    const loadEdgeTts = jest.fn(async () => {
      throw new Error('edge should not run for a long reply');
    });
    const geminiVoiceService = {
      isConfigured: jest.fn(() => true),
      synthesizeDetailed: jest.fn(async () => ({
        filePath: geminiFile,
        model: 'gemini-2.5-flash',
        voiceName: 'Kore',
        languageCode: 'en-US',
        mimeType: 'audio/wav',
        sourceMimeType: 'audio/pcm',
        latencyMs: 42,
        inputChars: 700,
        outputBytes: 3,
      })),
      synthesize: jest.fn(async () => geminiFile),
      cleanup: jest.fn(),
    };
    const service = new AudioSynthesisService({ geminiVoiceService, loadEdgeTts, tmpDir });

    const output = await service.synthesize('A'.repeat(700), {
      preferredLanguageCode: 'en-US',
      policyHint: 'long_reply',
    });

    expect(output).toBe(geminiFile);
    expect(geminiVoiceService.synthesizeDetailed).toHaveBeenCalledWith('A'.repeat(700), {
      languageCode: 'en-US',
    });
    expect(loadEdgeTts).not.toHaveBeenCalled();
  });

  it('honors forceProvider over the short-reply policy', async () => {
    const geminiFile = path.join(tmpDir, 'gemini-forced.wav');
    await fs.promises.writeFile(geminiFile, 'wav');
    const loadEdgeTts = jest.fn(async () => {
      throw new Error('edge should not run when gemini is forced');
    });
    const geminiVoiceService = {
      isConfigured: jest.fn(() => true),
      synthesizeDetailed: jest.fn(async () => ({
        filePath: geminiFile,
        model: 'gemini-2.5-flash',
        voiceName: 'Kore',
        languageCode: 'en-US',
        mimeType: 'audio/wav',
        sourceMimeType: 'audio/pcm',
        latencyMs: 7,
        inputChars: 6,
        outputBytes: 3,
      })),
      synthesize: jest.fn(async () => geminiFile),
      cleanup: jest.fn(),
    };
    const service = new AudioSynthesisService({ geminiVoiceService, loadEdgeTts, tmpDir });

    const output = await service.synthesize('Tiny.', { forceProvider: 'gemini' });

    expect(output).toBe(geminiFile);
    expect(loadEdgeTts).not.toHaveBeenCalled();
  });

  it('prefers Gemini when the requested language has no matching Edge voice', async () => {
    const geminiFile = path.join(tmpDir, 'gemini-es.wav');
    await fs.promises.writeFile(geminiFile, 'wav');
    const loadEdgeTts = jest.fn(async () => {
      throw new Error('edge should not run on language mismatch');
    });
    const geminiVoiceService = {
      isConfigured: jest.fn(() => true),
      synthesizeDetailed: jest.fn(async () => ({
        filePath: geminiFile,
        model: 'gemini-2.5-flash',
        voiceName: 'Kore',
        languageCode: 'es',
        mimeType: 'audio/wav',
        sourceMimeType: 'audio/pcm',
        latencyMs: 21,
        inputChars: 19,
        outputBytes: 3,
      })),
      synthesize: jest.fn(async () => geminiFile),
      cleanup: jest.fn(),
    };
    const service = new AudioSynthesisService({ geminiVoiceService, loadEdgeTts, tmpDir });

    const output = await service.synthesize('Puedes escucharme?', {
      surface: 'telegram',
      preferredLanguageCode: 'es',
      voiceId: 'en-US-JennyNeural',
    });

    expect(output).toBe(geminiFile);
    expect(geminiVoiceService.synthesizeDetailed).toHaveBeenCalledWith('Puedes escucharme?', {
      languageCode: 'es',
    });
    expect(loadEdgeTts).not.toHaveBeenCalled();
  });

  it('serves repeated synthesis from the cache by writing a fresh temp file', async () => {
    const previousCacheEnabled = config.tools.media.audio.ttsCacheEnabled;
    config.tools.media.audio.ttsCacheEnabled = true;
    try {
      const edge = buildEdgeTtsFake();
      const service = new AudioSynthesisService({
        loadEdgeTts: async () => ({ MsEdgeTTS: edge.MsEdgeTTS }),
        tmpDir,
      });

      const first = await service.synthesize('Cache this exact sentence.', { surface: 'telegram' });
      const second = await service.synthesize('Cache this exact sentence.', { surface: 'telegram' });

      track(first);
      track(second);
      expect(first).toMatch(/tts_.*\.mp3$/);
      expect(second).toMatch(/tts_cached_.*\.mp3$/);
      expect(fs.existsSync(second as string)).toBe(true);
      expect(fs.readFileSync(second as string)).toEqual(fs.readFileSync(first as string));
    } finally {
      config.tools.media.audio.ttsCacheEnabled = previousCacheEnabled;
    }
  });

  it('serializes concurrent synthesize calls through the shared queue', async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const startOrder: number[] = [];
    let loaderCalls = 0;
    const loadEdgeTts = jest.fn(async () => {
      loaderCalls += 1;
      startOrder.push(loaderCalls);
      if (loaderCalls === 1) {
        await firstGate;
      }
      return { MsEdgeTTS: buildEdgeTtsFake().MsEdgeTTS };
    });
    const service = new AudioSynthesisService({ loadEdgeTts, tmpDir });

    const first = service.synthesize('Queue first sentence.', { surface: 'telegram' });
    const second = service.synthesize('Queue second sentence.', { surface: 'telegram' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(startOrder).toEqual([1]);

    releaseFirst();
    const [firstPath, secondPath] = await Promise.all([first, second]);

    track(firstPath);
    track(secondPath);
    expect(startOrder).toEqual([1, 2]);
    expect(firstPath).toMatch(/tts_.*\.mp3$/);
    expect(secondPath).toMatch(/tts_.*\.mp3$/);
  });

  it('records gemini success telemetry with provider payload fields', async () => {
    const geminiFile = path.join(tmpDir, 'gemini-telemetry.wav');
    await fs.promises.writeFile(geminiFile, 'wav-bytes');
    const voiceTelemetryService = buildVoiceTelemetryFake();
    const geminiVoiceService = {
      isConfigured: jest.fn(() => true),
      synthesize: jest.fn(async () => geminiFile),
      cleanup: jest.fn(),
    };
    const service = new AudioSynthesisService({ geminiVoiceService, voiceTelemetryService, tmpDir });

    const output = await service.synthesize('Plain gemini telemetry payload.', {
      forceProvider: 'gemini',
      sessionId: 'session-77',
    });

    expect(output).toBe(geminiFile);
    expect(voiceTelemetryService.recordSuccess).toHaveBeenCalledWith(expect.objectContaining({
      surface: 'telegram',
      provider: 'gemini',
      mimeType: 'audio/wav',
      inputChars: 'Plain gemini telemetry payload.'.length,
      latencyMs: 0,
      fallbackFrom: null,
      requestedBy: 'telegram-bot',
      sessionId: 'session-77',
      traceId: null,
    }));
  });

  it('propagates CapabilityUnavailableError when edge lacks the capability and gemini is unconfigured', async () => {
    const voiceTelemetryService = buildVoiceTelemetryFake();
    const geminiVoiceService = {
      isConfigured: jest.fn(() => false),
      synthesize: jest.fn(),
      cleanup: jest.fn(),
    };
    const service = new AudioSynthesisService({
      geminiVoiceService,
      voiceTelemetryService,
      loadEdgeTts: async () => {
        throw new CapabilityUnavailableError({ capabilityId: 'media', reason: 'edge-tts absent' });
      },
      tmpDir,
    });

    await expect(service.synthesize('Capability gap sentence.')).rejects.toBeInstanceOf(CapabilityUnavailableError);

    expect(voiceTelemetryService.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'edge-tts',
      fallbackFrom: 'edge-tts',
    }));
    expect(geminiVoiceService.synthesize).not.toHaveBeenCalled();
  });

  it('returns null when both providers fail', async () => {
    const voiceTelemetryService = buildVoiceTelemetryFake();
    const geminiVoiceService = {
      isConfigured: jest.fn(() => true),
      synthesizeDetailed: jest.fn(async () => {
        throw new Error('gemini exploded');
      }),
      synthesize: jest.fn(async () => null),
      cleanup: jest.fn(),
    };
    const service = new AudioSynthesisService({
      geminiVoiceService,
      voiceTelemetryService,
      loadEdgeTts: async () => {
        throw new Error('edge exploded');
      },
      tmpDir,
    });

    const output = await service.synthesize('Everything fails sentence.');

    expect(output).toBeNull();
    expect(voiceTelemetryService.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'gemini',
      error: 'gemini exploded',
    }));
  });

  it('emits tts.policy.selected and tts.provider.completed trace events to the injected tracer', async () => {
    const onTrace = jest.fn();
    const edge = buildEdgeTtsFake();
    const service = new AudioSynthesisService({
      loadEdgeTts: async () => ({ MsEdgeTTS: edge.MsEdgeTTS }),
      onTrace,
      tmpDir,
    });

    const output = await service.synthesize('Traced synthesis sentence.', {
      traceId: 'voice-trace-1',
      surface: 'telegram',
      preferredLanguageCode: 'en-US',
    });

    track(output);
    expect(output).toMatch(/tts_.*\.mp3$/);
    expect(onTrace).toHaveBeenCalledWith('voice-trace-1', 'tts.policy.selected', expect.objectContaining({
      providers: 'edge-tts>gemini',
      policyHint: 'default',
    }));
    expect(onTrace).toHaveBeenCalledWith('voice-trace-1', 'tts.provider.completed', expect.objectContaining({
      provider: 'edge-tts',
    }));
    const events = onTrace.mock.calls.map((call) => call[1]);
    expect(events).toContain('tts.policy.selected');
    expect(events).toContain('tts.provider.completed');
  });
});
