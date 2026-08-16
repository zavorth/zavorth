import {
  ttsProviderConfigSchema,
  type TtsProviderConfig,
} from './TtsProviderConfigSchema.js';

/**
 * Built-in TTS provider configs.
 * These preserve the exact backends the tool shipped with (local/OS, Azure,
 * ElevenLabs, MLX, Gemini, Deepgram) as plain data — no provider logic lives in
 * the core anymore. Users can override them via tts-providers packs.
 *
 * Honesty fixes included here:
 * - Azure voice list typos corrected (`ja-JP-NanamiNeural`, `zh-CN-XiaoxiaoNeural`).
 * - Gemini now returns real audio via the official `generateContent` TTS shape
 *   (AUDIO modality + inline PCM16) instead of writing a `.json` file.
 *
 * Each config is validated through the schema so Zod defaults are applied.
 */
export function builtinTtsProviderConfigs(): TtsProviderConfig[] {
  const raw: Array<Record<string, unknown>> = [
    {
      providerId: 'local',
      label: 'local (native OS)',
      transport: 'cli',
      command: 'say',
      args: ['-r', '{rate}', '-o', '{output}', '--data-format=LEI16@22050', '{text}'],
      platformCommands: {
        darwin: {
          command: 'say',
          args: ['-r', '{rate}', '-o', '{output}', '--data-format=LEI16@22050', '{text}'],
          voiceArgs: ['-v', '{voice}'],
          rateMode: 'multiply',
          rateBase: 200,
        },
        linux: {
          command: 'espeak',
          args: ['-s', '{rate}', '-w', '{output}', '{text}'],
          rateMode: 'multiply',
          rateBase: 175,
        },
        win32: {
          command: 'powershell',
          args: [
            '-NoProfile',
            '-Command',
            "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.SetOutputToWaveFile('{output}'); $synth.Rate = {rate}; $synth.Speak((Get-Content -Raw '{textFile}').Trim()); $synth.SetOutputToNull()",
          ],
          rateMode: 'delta',
          rateBase: 10,
        },
      },
      rateMode: 'multiply',
      rateBase: 175,
      outputFormat: 'wav',
      responseContentType: 'audio/wav',
      languageCode: 'en-US',
      defaultVoiceId: 'default',
      voices: [
        { id: 'default', name: 'System default', language: 'en-US', gender: 'neutral' },
        { id: 'Alex', name: 'Alex', language: 'en-US', gender: 'male' },
        { id: 'Samantha', name: 'Samantha', language: 'en-US', gender: 'female' },
        { id: 'Luciana', name: 'Luciana', language: 'pt-BR', gender: 'female' },
      ],
    },
    {
      providerId: 'azure',
      label: 'Azure Speech',
      transport: 'http',
      synthesizeUrl: 'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1',
      requestStyle: 'ssml',
      authHeaderName: 'Ocp-Apim-Subscription-Key',
      authScheme: null,
      apiKeyEnvVar: 'AZURE_SPEECH_KEY',
      defaultVoiceId: 'en-US-GuyNeural',
      responseContentType: 'audio/mpeg',
      outputFormatHeader: 'X-Microsoft-OutputFormat',
      outputFormatHeaderValue: 'audio-24khz-48kbitrate-mono-mp3',
      languageCode: 'en-US',
      voices: [
        { id: 'pt-BR-AntonioNeural', name: 'Antonio', language: 'pt-BR', gender: 'male' },
        { id: 'pt-BR-FranciscaNeural', name: 'Francisca', language: 'pt-BR', gender: 'female' },
        { id: 'en-US-GuyNeural', name: 'Guy', language: 'en-US', gender: 'male' },
        { id: 'en-US-JennyNeural', name: 'Jenny', language: 'en-US', gender: 'female' },
        { id: 'es-ES-ElviraNeural', name: 'Elvira', language: 'es-ES', gender: 'female' },
        { id: 'fr-FR-DeniseNeural', name: 'Denise', language: 'fr-FR', gender: 'female' },
        { id: 'de-DE-KatjaNeural', name: 'Katja', language: 'de-DE', gender: 'female' },
        { id: 'ja-JP-NanamiNeural', name: 'Nanami', language: 'ja-JP', gender: 'female' },
        { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao', language: 'zh-CN', gender: 'female' },
      ],
    },
    {
      providerId: 'elevenlabs',
      label: 'ElevenLabs',
      transport: 'http',
      synthesizeUrl: 'https://api.elevenlabs.io/v1/text-to-speech/{voice}',
      requestStyle: 'json-text',
      authHeaderName: 'xi-api-key',
      authScheme: null,
      apiKeyEnvVar: 'ELEVENLABS_API_KEY',
      modelId: 'eleven_multilingual_v2',
      defaultVoiceId: '21m00Tcm4TlvDq8ikWAM',
      languageCode: 'en-US',
      voices: [
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', language: 'en-US', gender: 'female' },
        { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', language: 'en-US', gender: 'male' },
        { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', language: 'en-US', gender: 'female' },
        { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', language: 'en-US', gender: 'male' },
      ],
    },
    {
      providerId: 'gemini',
      label: 'Gemini TTS',
      transport: 'http',
      synthesizeUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}',
      requestStyle: 'template',
      apiKeyEnvVar: 'GEMINI_API_KEY',
      modelId: 'gemini-2.5-flash-preview-tts',
      defaultVoiceId: 'Kore',
      languageCode: 'en-US',
      audioSource: 'pcm16-json',
      audioPath: 'candidates.0.content.parts.0.inlineData.data',
      pcm: { sampleRate: 24000, channels: 1 },
      payloadTemplate:
        '{"contents":[{"parts":[{"text":"{text}"}]}],'
        + '"generationConfig":{"responseModalities":["AUDIO"],'
        + '"speechConfig":{"voiceConfig":{"prebuiltVoiceConfig":{"voiceName":"{voice}"}},"languageCode":"{language}"}},"model":"{model}"}',
      voices: [
        { id: 'Kore', name: 'Kore', language: 'en-US', gender: 'female' },
        { id: 'Puck', name: 'Puck', language: 'en-US', gender: 'male' },
        { id: 'Zephyr', name: 'Zephyr', language: 'en-US', gender: 'female' },
        { id: 'Aoede', name: 'Aoede', language: 'en-US', gender: 'female' },
        { id: 'Charon', name: 'Charon', language: 'en-US', gender: 'male' },
        { id: 'Fenrir', name: 'Fenrir', language: 'en-US', gender: 'male' },
        { id: 'Leda', name: 'Leda', language: 'en-US', gender: 'female' },
        { id: 'Orus', name: 'Orus', language: 'en-US', gender: 'male' },
      ],
    },
    {
      providerId: 'deepgram',
      label: 'Deepgram Aura',
      transport: 'http',
      synthesizeUrl: 'https://api.deepgram.com/v1/speak?model={voice}&encoding={format}&container={format}',
      requestStyle: 'raw-text',
      authHeaderName: 'Authorization',
      authScheme: 'Token',
      apiKeyEnvVar: 'DEEPGRAM_API_KEY',
      defaultVoiceId: 'asteria',
      languageCode: 'en-US',
      voices: [
        { id: 'asteria', name: 'Asteria', language: 'en-US', gender: 'female' },
        { id: 'luna', name: 'Luna', language: 'en-US', gender: 'female' },
        { id: 'stella', name: 'Stella', language: 'en-US', gender: 'female' },
        { id: 'athena', name: 'Athena', language: 'en-US', gender: 'female' },
        { id: 'hera', name: 'Hera', language: 'en-US', gender: 'female' },
        { id: 'orion', name: 'Orion', language: 'en-US', gender: 'male' },
        { id: 'arcas', name: 'Arcas', language: 'en-US', gender: 'male' },
        { id: 'perseus', name: 'Perseus', language: 'en-US', gender: 'male' },
        { id: 'angus', name: 'Angus', language: 'en-US', gender: 'male' },
        { id: 'orpheus', name: 'Orpheus', language: 'en-US', gender: 'male' },
      ],
    },
    {
      providerId: 'mlx',
      label: 'MLX (Apple Silicon)',
      transport: 'cli',
      command: 'mlx-tts',
      args: ['{text}', '--output', '{output}'],
      platformCommands: {
        darwin: {
          command: 'mlx-tts',
          args: ['{text}', '--output', '{output}'],
          rateMode: 'multiply',
          rateBase: 175,
        },
      },
      rateMode: 'multiply',
      rateBase: 175,
      outputFormat: 'wav',
      responseContentType: 'audio/wav',
      languageCode: 'en-US',
      voices: [],
    },
  ];
  return raw.map((config) => ttsProviderConfigSchema.parse(config));
}
