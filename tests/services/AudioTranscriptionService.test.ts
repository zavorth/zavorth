import { describe, it, expect, beforeEach } from '@jest/globals';
import { AudioTranscriptionService } from '../../src/services/AudioTranscriptionService.js';
import { SttBackendRegistry } from '../../src/adapters/speech/stt/SttBackendRegistry.js';
import type { ISpeechTranscriptionAdapter, SttTranscribeInput, SttTranscribeOutput } from '../../src/adapters/speech/stt/SpeechTranscriptionContract.js';

class MockSttAdapter implements ISpeechTranscriptionAdapter {
  constructor(
    public readonly providerId: string,
    public readonly transport = 'http' as const,
    private readonly shouldFail = false,
    private readonly outputText = 'Hello world transcription'
  ) {}

  async transcribe(_input: SttTranscribeInput): Promise<SttTranscribeOutput> {
    if (this.shouldFail) {
      throw new Error(`Provider ${this.providerId} rate limit exceeded`);
    }
    return {
      text: this.outputText,
      language: 'en',
      durationSeconds: 2.5,
      words: [],
      segments: [],
    };
  }
}

describe('AudioTranscriptionService (Vendor-Agnostic)', () => {
  let registry: SttBackendRegistry;
  let service: AudioTranscriptionService;

  beforeEach(() => {
    registry = new SttBackendRegistry();
    service = new AudioTranscriptionService({ registry });
  });

  it('should fail cleanly when audio buffer is empty or too small', async () => {
    const res = await service.transcribe({
      audio: Buffer.alloc(0),
      mimeType: 'audio/wav',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('empty');
  });

  it('should delegate to registered custom STT adapter without vendor bias', async () => {
    const mockAdapter = new MockSttAdapter('assemblyai', 'http', false, 'Clean agnostic transcript text');
    registry.registerAdapter(mockAdapter);

    // Create 2KB mock wav buffer (non-silent)
    const buf = Buffer.alloc(2048);
    buf.write('RIFF', 0);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20); // PCM
    buf.writeUInt16LE(1, 22); // Mono
    buf.writeUInt32LE(16000, 24); // 16kHz
    buf.writeUInt32LE(32000, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34); // 16 bits
    buf.write('data', 36);
    buf.writeUInt32LE(2000, 40);
    for (let i = 44; i < 2048; i += 2) {
      buf.writeInt16LE(10000, i); // non-silent sample
    }

    const res = await service.transcribe({
      audio: buf,
      mimeType: 'audio/wav',
      allowLegacyCascade: true,
    });

    expect(res.ok).toBe(true);
    expect(res.text).toBe('Clean agnostic transcript text');
    expect(res.provider).toBe('assemblyai');
  });

  it('should gracefully fallback across multiple registered providers', async () => {
    const failingAdapter = new MockSttAdapter('primary-stt', 'http', true);
    const fallbackAdapter = new MockSttAdapter('fallback-stt', 'http', false, 'Fallback transcript succeeded');
    registry.registerAdapter(failingAdapter);
    registry.registerAdapter(fallbackAdapter);

    const buf = Buffer.alloc(2048);
    buf.write('RIFF', 0);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(16000, 24);
    buf.writeUInt32LE(32000, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(2000, 40);
    for (let i = 44; i < 2048; i += 2) {
      buf.writeInt16LE(10000, i);
    }

    const res = await service.transcribe({
      audio: buf,
      mimeType: 'audio/wav',
      allowLegacyCascade: true,
    });

    expect(res.ok).toBe(true);
    expect(res.text).toBe('Fallback transcript succeeded');
    expect(res.provider).toBe('fallback-stt');
    expect(res.attempts.length).toBe(2);
    expect(res.attempts[0].status).toBe('failed');
    expect(res.attempts[1].status).toBe('succeeded');
  });
});
