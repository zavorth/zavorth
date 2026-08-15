import {
  sttProviderConfigSchema,
  type SttProviderConfig,
} from './SttProviderConfigSchema.js';

/**
 * Built-in STT provider configs.
 * These preserve the exact backends the tool shipped with (Whisper/OpenAI,
 * Deepgram, Gemini, Azure, local/whisper.cpp) as plain data — no provider logic
 * lives in the core anymore. Users can override them via stt-providers packs.
 * Each config is validated through the schema so Zod defaults are applied.
 */
export function builtinSttProviderConfigs(): SttProviderConfig[] {
  const raw: Array<Record<string, unknown>> = [
    {
      providerId: 'openai',
      label: 'Whisper (OpenAI)',
      transport: 'http',
      transcribeUrl: 'https://api.openai.com/v1/audio/transcriptions',
      requestStyle: 'multipart',
      authHeaderName: 'Authorization',
      authScheme: 'Bearer',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      modelId: 'whisper-1',
      transcriptPath: 'text',
      languagePath: 'language',
    },
    {
      providerId: 'deepgram',
      label: 'Deepgram Nova',
      transport: 'http',
      transcribeUrl: 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
      requestStyle: 'raw-audio',
      authHeaderName: 'Authorization',
      authScheme: 'Token',
      apiKeyEnvVar: 'DEEPGRAM_API_KEY',
      transcriptPath: 'results.channels.0.alternatives.0.transcript',
      languagePath: 'results.language',
      queryParamNames: {
        prompt: 'prompt',
        temperature: 'temperature',
        wordTimestamps: 'word_timestamps',
      },
    },
    {
      providerId: 'gemini',
      label: 'Gemini',
      transport: 'http',
      transcribeUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={apiKey}',
      requestStyle: 'template',
      apiKeyEnvVar: 'GEMINI_API_KEY',
      transcriptPath: 'candidates.0.content.parts.0.text',
      payloadTemplate:
        '{"contents":[{"parts":[{"text":"Transcribe this audio precisely."},'
        + '{"inline_data":{"mime_type":"{contentType}","data":"{audio}"}}]}],'
        + '"generationConfig":{"temperature":0}}',
    },
    {
      providerId: 'azure',
      label: 'Azure Speech',
      transport: 'http',
      transcribeUrl: 'https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language={language}',
      requestStyle: 'raw-audio',
      authHeaderName: 'Ocp-Apim-Subscription-Key',
      authScheme: null,
      apiKeyEnvVar: 'AZURE_SPEECH_KEY',
      transcriptPath: 'DisplayText',
      languagePath: 'locale',
    },
    {
      providerId: 'whisper.cpp',
      label: 'Local (whisper.cpp)',
      transport: 'cli',
      command: 'whisper',
      args: ['{audio}', '--output_format', 'txt'],
      modelId: 'base',
      transcriptPath: 'text',
    },
  ];
  return raw.map((config) => sttProviderConfigSchema.parse(config));
}
