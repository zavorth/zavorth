import { HttpSynthesisAdapter } from '../../../../src/adapters/speech/tts/transports/HttpSynthesisAdapter';
import { ttsProviderConfigSchema } from '../../../../src/adapters/speech/tts/TtsProviderConfigSchema';

function jsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function audioResponse(bytes: Buffer, contentType = 'audio/mpeg'): Response {
  return new Response(bytes, { status: 200, headers: { 'content-type': contentType } });
}

describe('HttpSynthesisAdapter', () => {
  it('throws when the API key env var is missing', async () => {
    process.env.TTS_HTTP_TEST_KEY = '';
    const config = ttsProviderConfigSchema.parse({
      providerId: 'test',
      transport: 'http',
      synthesizeUrl: 'https://example.com',
      apiKeyEnvVar: 'TTS_HTTP_TEST_KEY',
    });
    const adapter = new HttpSynthesisAdapter(config, { fetch: jest.fn() });
    await expect(adapter.synthesize({ text: 'hello' })).rejects.toThrow('requires TTS_HTTP_TEST_KEY');
  });

  it('returns raw body audio for audioSource=body (Deepgram/Azure/ElevenLabs)', async () => {
    process.env.TTS_HTTP_TEST_KEY = 'k';
    const bytes = Buffer.from([0x49, 0x44, 0x33]);
    const config = ttsProviderConfigSchema.parse({
      providerId: 'deepgram',
      transport: 'http',
      synthesizeUrl: 'https://api.deepgram.com/v1/speak?model={voice}',
      requestStyle: 'raw-text',
      authHeaderName: 'Authorization',
      authScheme: 'Token',
      apiKeyEnvVar: 'TTS_HTTP_TEST_KEY',
      defaultVoiceId: 'asteria',
    });
    const fetchImpl = jest.fn().mockResolvedValue(audioResponse(bytes));
    const adapter = new HttpSynthesisAdapter(config, { fetch: fetchImpl });
    const output = await adapter.synthesize({ text: 'hello' });
    expect(output.audio.equals(bytes)).toBe(true);
    expect(output.format).toBe('mp3');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('model=asteria');
    expect(init.headers.Authorization).toBe('Token k');
    delete process.env.TTS_HTTP_TEST_KEY;
  });

  it('builds Azure SSML and sends X-Microsoft-OutputFormat header', async () => {
    process.env.AZURE_SPEECH_REGION = 'eastus';
    process.env.TTS_AZURE_KEY = 'azurekey';
    const config = ttsProviderConfigSchema.parse({
      providerId: 'azure',
      transport: 'http',
      synthesizeUrl: 'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1',
      requestStyle: 'ssml',
      authHeaderName: 'Ocp-Apim-Subscription-Key',
      authScheme: null,
      apiKeyEnvVar: 'TTS_AZURE_KEY',
      outputFormatHeader: 'X-Microsoft-OutputFormat',
      outputFormatHeaderValue: 'audio-24khz-48kbitrate-mono-mp3',
      defaultVoiceId: 'en-US-GuyNeural',
    });
    const fetchImpl = jest.fn().mockResolvedValue(audioResponse(Buffer.from([9, 9])));
    const adapter = new HttpSynthesisAdapter(config, { fetch: fetchImpl });
    const output = await adapter.synthesize({ text: 'Hello <world>', speed: 1.25 });
    expect(output.audio.length).toBe(2);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('eastus');
    expect(init.headers['Ocp-Apim-Subscription-Key']).toBe('azurekey');
    expect(init.headers['X-Microsoft-OutputFormat']).toBe('audio-24khz-48kbitrate-mono-mp3');
    const ssml = String(init.body);
    expect(ssml).toContain("name='en-US-GuyNeural'");
    expect(ssml).toContain("rate='25%'");
    expect(ssml).toContain('Hello &lt;world&gt;');
    delete process.env.AZURE_SPEECH_REGION;
    delete process.env.TTS_AZURE_KEY;
  });

  it('extracts base64 audio from a JSON field (audioSource=base64-json)', async () => {
    process.env.TTS_HTTP_TEST_KEY = 'k';
    const raw = Buffer.from([1, 2, 3, 4]);
    const config = ttsProviderConfigSchema.parse({
      providerId: 'json-tts',
      transport: 'http',
      synthesizeUrl: 'https://example.com',
      requestStyle: 'raw-text',
      apiKeyEnvVar: 'TTS_HTTP_TEST_KEY',
      audioSource: 'base64-json',
      audioPath: 'result.audio',
    });
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({ result: { audio: raw.toString('base64') } }),
    );
    const adapter = new HttpSynthesisAdapter(config, { fetch: fetchImpl });
    const output = await adapter.synthesize({ text: 'hi' });
    expect(output.audio.equals(raw)).toBe(true);
    delete process.env.TTS_HTTP_TEST_KEY;
  });

  it('wraps Gemini PCM16 into a WAV container (audioSource=pcm16-json)', async () => {
    process.env.TTS_HTTP_TEST_KEY = 'k';
    const pcm = Buffer.from([0, 1, 0, 2, 0, 3]);
    const config = ttsProviderConfigSchema.parse({
      providerId: 'gemini',
      transport: 'http',
      synthesizeUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}',
      requestStyle: 'template',
      apiKeyEnvVar: 'TTS_HTTP_TEST_KEY',
      audioSource: 'pcm16-json',
      audioPath: 'candidates.0.content.parts.0.inlineData.data',
      payloadTemplate:
        '{"contents":[{"parts":[{"text":"{text}"}]}],"generationConfig":{"responseModalities":["AUDIO"]}}',
      modelId: 'gemini-2.5-flash-preview-tts',
    });
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{
          content: { parts: [{ inlineData: { data: pcm.toString('base64') } }] },
        }],
      }),
    );
    const adapter = new HttpSynthesisAdapter(config, { fetch: fetchImpl });
    const output = await adapter.synthesize({ text: 'hello' });
    expect(output.format).toBe('wav');
    const header = output.audio.subarray(0, 4).toString('ascii');
    expect(header).toBe('RIFF');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('gemini-2.5-flash-preview-tts');
    expect(String(init.body)).toContain('responseModalities');
    delete process.env.TTS_HTTP_TEST_KEY;
  });

  it('throws a readable error for non-ok responses', async () => {
    process.env.TTS_HTTP_TEST_KEY = 'k';
    const config = ttsProviderConfigSchema.parse({
      providerId: 'bad',
      transport: 'http',
      synthesizeUrl: 'https://example.com',
      apiKeyEnvVar: 'TTS_HTTP_TEST_KEY',
    });
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({ error: { message: 'nope' } }, 400),
    );
    const adapter = new HttpSynthesisAdapter(config, { fetch: fetchImpl });
    await expect(adapter.synthesize({ text: 'x' })).rejects.toThrow('nope');
    delete process.env.TTS_HTTP_TEST_KEY;
  });
});
