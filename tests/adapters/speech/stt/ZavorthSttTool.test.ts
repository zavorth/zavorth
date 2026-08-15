import os from 'os';
import path from 'path';
import fs from 'fs';
import { ZavorthSttTool } from '../../../../src/tools/ZavorthSttTool';
import { SttBackendRegistry } from '../../../../src/adapters/speech/stt/SttBackendRegistry';
import type { ISpeechTranscriptionAdapter, SttTranscribeInput, SttTranscribeOutput } from '../../../../src/adapters/speech/stt/SpeechTranscriptionContract';

const AUDIO_WAV = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

function makeFakeAdapter(received: { current?: SttTranscribeInput }): ISpeechTranscriptionAdapter {
  return {
    providerId: 'openai',
    transport: 'http',
    modelId: 'whisper-1',
    isAvailable: () => true,
    async transcribe(input: SttTranscribeInput): Promise<SttTranscribeOutput> {
      received.current = input;
      return {
        text: 'hello world',
        language: 'en',
        segments: [],
        providerEvidence: { providerId: 'openai', mode: 'batch', transport: 'http' },
      };
    },
  };
}

describe('ZavorthSttTool (registry-based)', () => {
  it('still registers as zavorth_stt', () => {
    const tool = new ZavorthSttTool();
    expect(tool.name).toBe('zavorth_stt');
  });

  it('lists backends from the default registry', async () => {
    const tool = new ZavorthSttTool();
    const result = await tool.execute({ action: 'list_backends' });
    expect(result).toContain('Available STT backends');
    expect(result).toContain('openai');
    expect(result).toContain('deepgram');
    expect(result).toContain('gemini');
    expect(result).toContain('azure');
    expect(result).toContain('whisper.cpp');
  });

  it('rejects an invalid action', async () => {
    const tool = new ZavorthSttTool();
    const result = await tool.execute({ action: 'explode' });
    expect(result).toContain('Error');
  });

  it('requires action', async () => {
    const tool = new ZavorthSttTool();
    const result = await tool.execute({});
    expect(result).toContain('action');
  });

  it('set_default accepts legacy aliases and maps them to registry ids', async () => {
    const tool = new ZavorthSttTool();
    const result = await tool.execute({ action: 'set_default', backend: 'whisper' });
    expect(result).toContain('openai');
  });

  it('set_default rejects unknown backends', async () => {
    const tool = new ZavorthSttTool();
    const result = await tool.execute({ action: 'set_default', backend: 'telepathy' });
    expect(result).toContain('Error');
  });

  it('transcribe requires audio_path', async () => {
    const tool = new ZavorthSttTool();
    const result = await tool.execute({ action: 'transcribe' });
    expect(result).toContain('audio_path');
  });

  it('detect_language requires audio_path', async () => {
    const tool = new ZavorthSttTool();
    const result = await tool.execute({ action: 'detect_language' });
    expect(result).toContain('audio_path');
  });

  it('transcribe reports a missing file', async () => {
    const tool = new ZavorthSttTool();
    const result = await tool.execute({ action: 'transcribe', audio_path: 'Z:\\definitely-missing.mp3' });
    expect(result).toContain('not found');
  });

  it('reports when a chosen backend is not registered', async () => {
    const tool = new ZavorthSttTool();
    const result = await tool.execute({
      action: 'set_default',
      backend: 'not-registered',
    });
    expect(result).toContain('Error');
  });

  it('propagates word_timestamps, temperature and prompt to the adapter', async () => {
    const received: { current?: SttTranscribeInput } = {};
    const registry = new SttBackendRegistry();
    registry.registerAdapter(makeFakeAdapter(received));

    const tool = new ZavorthSttTool({ registry });
    const audioPath = path.join(os.tmpdir(), 'zavorth-stt-tool-test.wav');
    fs.writeFileSync(audioPath, AUDIO_WAV);

    const result = await tool.execute({
      action: 'transcribe',
      audio_path: audioPath,
      backend: 'openai',
      word_timestamps: true,
      temperature: 0.4,
      prompt: 'some context',
    });
    expect(result).toContain('hello world');
    expect(received.current).toBeDefined();
    expect(received.current?.wordTimestamps).toBe(true);
    expect(received.current?.temperature).toBe(0.4);
    expect(received.current?.prompt).toBe('some context');

    fs.rmSync(audioPath, { force: true });
  });
});
