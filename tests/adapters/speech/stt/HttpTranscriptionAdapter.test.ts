import { HttpTranscriptionAdapter } from '../../../../src/adapters/speech/stt/transports/HttpTranscriptionAdapter';
import { sttProviderConfigSchema } from '../../../../src/adapters/speech/stt/SttProviderConfigSchema';

function makeFetchMock(payload: unknown, ok = true, status = 200) {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: jest.fn().mockResolvedValue(payload),
    headers: { get: () => 'application/json' },
  });
}

const audio = Buffer.from([1, 2, 3, 4, 5]);

describe('HttpTranscriptionAdapter', () => {
  it('is available when fetch is provided', () => {
    const config = sttProviderConfigSchema.parse({
      providerId: 'openai',
      transport: 'http',
      transcribeUrl: 'https://api.openai.com/v1/audio/transcriptions',
      requestStyle: 'multipart',
      apiKeyEnvVar: 'OPENAI_API_KEY',
    });
    const adapter = new HttpTranscriptionAdapter(config, { fetch: makeFetchMock({ text: 'hi' }) });
    expect(adapter.isAvailable()).toBe(true);
  });

  it('uses the injected fetch for transcribe', async () => {
    const fetchImpl = makeFetchMock({ text: 'ok' });
    const config = sttProviderConfigSchema.parse({
      providerId: 'openai',
      transport: 'http',
      transcribeUrl: 'https://api.openai.com/v1/audio/transcriptions',
    });
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    const output = await adapter.transcribe({ audio, contentType: 'audio/mpeg' });
    expect(output.text).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('extracts text from a simple response payload', async () => {
    const fetchImpl = makeFetchMock({ text: 'hello world' });
    const config = sttProviderConfigSchema.parse({
      providerId: 'openai',
      transport: 'http',
      transcribeUrl: 'https://api.openai.com/v1/audio/transcriptions',
      requestStyle: 'multipart',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      transcriptPath: 'text',
    });
    process.env.OPENAI_API_KEY = 'test-key';
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    const output = await adapter.transcribe({ audio, contentType: 'audio/mpeg' });
    expect(output.text).toBe('hello world');
    expect(output.providerEvidence.providerId).toBe('openai');

    const call = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('api.openai.com');
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toContain('Bearer test-key');
    delete process.env.OPENAI_API_KEY;
  });

  it('extracts transcripts from deepgram-shaped payloads', async () => {
    const fetchImpl = makeFetchMock({
      results: {
        channels: [{ alternatives: [{ transcript: 'deepgram words', confidence: 0.9 }] }],
        language: 'pt',
      },
    });
    const config = sttProviderConfigSchema.parse({
      providerId: 'deepgram',
      transport: 'http',
      transcribeUrl: 'https://api.deepgram.com/v1/listen',
      requestStyle: 'raw-audio',
      transcriptPath: 'results.channels.0.alternatives.0.transcript',
      languagePath: 'results.language',
    });
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    const output = await adapter.transcribe({ audio, contentType: 'audio/mp3' });
    expect(output.text).toBe('deepgram words');
    expect(output.language).toBe('pt');
  });

  it('extracts transcripts from azure-shaped payloads', async () => {
    const fetchImpl = makeFetchMock({ DisplayText: 'azure words', locale: 'pt-BR' });
    const config = sttProviderConfigSchema.parse({
      providerId: 'azure',
      transport: 'http',
      transcribeUrl: 'https://{region}.stt.speech.microsoft.com/v1?language={language}',
      requestStyle: 'raw-audio',
      transcriptPath: 'DisplayText',
      authHeaderName: 'Ocp-Apim-Subscription-Key',
      authScheme: null,
    });
    process.env.AZURE_SPEECH_REGION = 'eastus';
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    const output = await adapter.transcribe({ audio, contentType: 'audio/wav', languageHint: 'pt-BR' });
    expect(output.text).toBe('azure words');
    const call = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('eastus');
    expect(call[0]).toContain('language=pt-BR');
    delete process.env.AZURE_SPEECH_REGION;
  });

  it('extracts transcripts from gemini-shaped payloads', async () => {
    const fetchImpl = makeFetchMock({
      candidates: [{ content: { parts: [{ text: 'gemini words' }] } }],
    });
    const config = sttProviderConfigSchema.parse({
      providerId: 'gemini',
      transport: 'http',
      transcribeUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={apiKey}',
      requestStyle: 'template',
      transcriptPath: 'candidates.0.content.parts.0.text',
      apiKeyEnvVar: 'GEMINI_API_KEY',
    });
    process.env.GEMINI_API_KEY = 'gemini-key';
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    const output = await adapter.transcribe({ audio, contentType: 'audio/mpeg' });
    expect(output.text).toBe('gemini words');
    const call = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('key=gemini-key');
    delete process.env.GEMINI_API_KEY;
  });

  it('throws a helpful error on HTTP failure', async () => {
    const fetchImpl = makeFetchMock({ error: { message: 'bad key' } }, false, 401);
    const config = sttProviderConfigSchema.parse({
      providerId: 'openai',
      transport: 'http',
      transcribeUrl: 'https://api.openai.com/v1/audio/transcriptions',
    });
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    await expect(
      adapter.transcribe({ audio, contentType: 'audio/mpeg' }),
    ).rejects.toThrow('bad key');
  });

  it('throws when the transcript is empty', async () => {
    const fetchImpl = makeFetchMock({ text: '' });
    const config = sttProviderConfigSchema.parse({
      providerId: 'openai',
      transport: 'http',
      transcribeUrl: 'https://api.openai.com/v1/audio/transcriptions',
    });
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    await expect(
      adapter.transcribe({ audio, contentType: 'audio/mpeg' }),
    ).rejects.toThrow('empty transcript');
  });

  it('requests verbose_json with temperature and prompt for openai multipart', async () => {
    const fetchImpl = makeFetchMock({ text: 'hi' });
    const config = sttProviderConfigSchema.parse({
      providerId: 'openai',
      transport: 'http',
      transcribeUrl: 'https://api.openai.com/v1/audio/transcriptions',
      requestStyle: 'multipart',
      apiKeyEnvVar: 'OPENAI_API_KEY',
    });
    process.env.OPENAI_API_KEY = 'test-key';
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    await adapter.transcribe({
      audio,
      contentType: 'audio/mpeg',
      wordTimestamps: true,
      temperature: 0.3,
      prompt: 'domain terms',
    });
    const call = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = call[1].body as FormData;
    expect(body.get('response_format')).toBe('verbose_json');
    expect(body.get('temperature')).toBe('0.3');
    expect(body.get('prompt')).toBe('domain terms');
    delete process.env.OPENAI_API_KEY;
  });

  it('keeps response_format json when word timestamps are not requested', async () => {
    const fetchImpl = makeFetchMock({ text: 'hi' });
    const config = sttProviderConfigSchema.parse({
      providerId: 'openai',
      transport: 'http',
      transcribeUrl: 'https://api.openai.com/v1/audio/transcriptions',
      requestStyle: 'multipart',
      apiKeyEnvVar: 'OPENAI_API_KEY',
    });
    process.env.OPENAI_API_KEY = 'test-key';
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    await adapter.transcribe({ audio, contentType: 'audio/mpeg' });
    const call = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = call[1].body as FormData;
    expect(body.get('response_format')).toBe('json');
    delete process.env.OPENAI_API_KEY;
  });

  it('expands prompt and temperature placeholders in template payloads', async () => {
    const fetchImpl = makeFetchMock({ text: 'hi' });
    const config = sttProviderConfigSchema.parse({
      providerId: 'gemini',
      transport: 'http',
      transcribeUrl: 'https://example.com/transcribe?key={apiKey}',
      requestStyle: 'template',
      apiKeyEnvVar: 'GEMINI_API_KEY',
      payloadTemplate: '{"prompt":"{prompt}","temperature":{temperature}}',
    });
    process.env.GEMINI_API_KEY = 'g-key';
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    await adapter.transcribe({ audio, contentType: 'audio/mpeg', prompt: 'my prompt', temperature: 0.7 });
    const call = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(call[1].body).toContain('"prompt":"my prompt"');
    expect(call[1].body).toContain('"temperature":0.7');
    delete process.env.GEMINI_API_KEY;
  });

  it('appends deepgram query params for prompt, temperature and word timestamps', async () => {
    const fetchImpl = makeFetchMock({ results: { channels: [{ alternatives: [{ transcript: 'hi' }] }] } });
    const config = sttProviderConfigSchema.parse({
      providerId: 'deepgram',
      transport: 'http',
      transcribeUrl: 'https://api.deepgram.com/v1/listen?model=nova-2',
      requestStyle: 'raw-audio',
      apiKeyEnvVar: 'DEEPGRAM_API_KEY',
      transcriptPath: 'results.channels.0.alternatives.0.transcript',
      queryParamNames: { prompt: 'prompt', temperature: 'temperature', wordTimestamps: 'word_timestamps' },
    });
    process.env.DEEPGRAM_API_KEY = 'dg-key';
    const adapter = new HttpTranscriptionAdapter(config, { fetch: fetchImpl });
    await adapter.transcribe({ audio, contentType: 'audio/mp3', prompt: 'p', temperature: 0.5, wordTimestamps: true });
    const call = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('prompt=p');
    expect(call[0]).toContain('temperature=0.5');
    expect(call[0]).toContain('word_timestamps=true');
    delete process.env.DEEPGRAM_API_KEY;
  });
});
