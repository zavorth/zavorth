import { builtinTtsProviderConfigs } from '../../../../src/adapters/speech/tts/builtinTtsProviderConfigs';

describe('builtinTtsProviderConfigs', () => {
  it('registers the builtin providers', () => {
    const configs = builtinTtsProviderConfigs();
    const ids = configs.map((c) => c.providerId);
    expect(ids).toEqual(expect.arrayContaining(['local', 'azure', 'elevenlabs', 'gemini', 'deepgram', 'mlx']));
  });

  it('uses correct Japanese and Chinese Azure voices (honesty fix)', () => {
    const azure = builtinTtsProviderConfigs().find((c) => c.providerId === 'azure')!;
    const voiceIds = azure.voices!.map((v) => v.id);
    expect(voiceIds).toContain('ja-JP-NanamiNeural');
    expect(voiceIds).not.toContain('already-JP-NanamiNeural');
    expect(voiceIds).toContain('zh-CN-XiaoxiaoNeural');
  });

  it('configures Gemini to request real PCM16 audio (honesty fix)', () => {
    const gemini = builtinTtsProviderConfigs().find((c) => c.providerId === 'gemini')!;
    expect(gemini.transport).toBe('http');
    expect(gemini.audioSource).toBe('pcm16-json');
    expect(gemini.modelId).toBe('gemini-2.5-flash-preview-tts');
    expect(String(gemini.payloadTemplate)).toContain('responseModalities');
  });

  it('exposes apiKeyEnvVar for cloud providers and none for local', () => {
    const configs = builtinTtsProviderConfigs();
    const azure = configs.find((c) => c.providerId === 'azure')!;
    const elevenlabs = configs.find((c) => c.providerId === 'elevenlabs')!;
    const local = configs.find((c) => c.providerId === 'local')!;
    expect(azure.apiKeyEnvVar).toBe('AZURE_SPEECH_KEY');
    expect(elevenlabs.apiKeyEnvVar).toBe('ELEVENLABS_API_KEY');
    expect(local.apiKeyEnvVar).toBeUndefined();
  });
});
