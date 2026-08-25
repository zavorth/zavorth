import { z } from 'zod';
import type { TtsTransportType } from './SpeechSynthesisContract.js';

/**
 * Environment variable naming convention used by the TTS config layer.
 * Packs reference env vars by name so secrets never live in provider.json.
 */
export const ttsApiKeyEnvSchema = z.string().min(1);

/**
 * Voice descriptor shared by every transport variant.
 */
const ttsVoiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  language: z.string().min(1),
  gender: z.enum(['male', 'female', 'neutral']).default('neutral'),
});

/**
 * Shared fields for every transport variant.
 */
const ttsProviderBaseSchema = z.object({
  providerId: z.string().min(1),
  label: z.string().min(1).optional(),
  apiKeyEnvVar: ttsApiKeyEnvSchema.optional(),
  modelId: z.string().min(1).optional(),
  /** Voice used when the caller does not pick one. */
  defaultVoiceId: z.string().min(1).optional(),
  /** Language applied when the caller does not provide one (ISO 639-1). */
  languageCode: z.string().min(1).optional(),
  voices: z.array(ttsVoiceSchema).default([]),
});

/**
 * HTTP transport: raw REST synthesis APIs (Azure, ElevenLabs, Deepgram, Gemini, ...).
 * `requestStyle` selects how the text/SSML payload is sent and how audio is read:
 * - 'body'      -> response body is the audio bytes
 * - 'base64-json' -> audio arrives base64-encoded inside a JSON field
 * - 'pcm16-json'  -> base64 PCM16 audio that must be wrapped into a WAV file
 */
const httpTtsProviderSchema = ttsProviderBaseSchema.extend({
  transport: z.literal('http'),
  synthesizeUrl: z.string().min(1),
  requestStyle: z
    .enum(['json-text', 'ssml', 'template', 'raw-text'])
    .default('json-text'),
  authHeaderName: z.string().min(1).default('Authorization'),
  authScheme: z.string().min(1).nullable().default('Bearer'),
  authQueryParam: z.string().min(1).optional(),
  requestHeaderNames: z
    .object({
      contentType: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
      outputFormat: z.string().min(1).optional(),
    })
    .optional(),
  /** Explicit header value to request a given audio output format (Azure X-Microsoft-OutputFormat). */
  outputFormatHeader: z.string().min(1).optional(),
  outputFormatHeaderValue: z.string().min(1).optional(),
  /** Fixed response content type when the provider does not send one (e.g. Azure). */
  responseContentType: z.string().min(1).optional(),
  /** Where the audio bytes come from. */
  audioSource: z.enum(['body', 'base64-json', 'pcm16-json']).default('body'),
  /** Path to the audio field inside a JSON response (audioSource != 'body'). */
  audioPath: z.string().min(1).optional(),
  /** PCM16 format used when audioSource is 'pcm16-json'. */
  pcm: z
    .object({
      sampleRate: z.number().int().positive().default(24000),
      channels: z.number().int().positive().default(1),
    })
    .default({ sampleRate: 24000, channels: 1 }),
  payloadTemplate: z.string().optional(),
  queryParamNames: z
    .object({
      voice: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
      outputFormat: z.string().min(1).optional(),
      speed: z.string().min(1).optional(),
    })
    .optional(),
  timeoutMs: z.number().int().positive().default(120_000),
});

/**
 * SDK transport: a dedicated client library loaded at runtime.
 */
const sdkTtsProviderSchema = ttsProviderBaseSchema.extend({
  transport: z.literal('sdk'),
  sdkModule: z.string().min(1),
  factoryFunction: z.string().min(1),
  configField: z.string().min(1).optional(),
  synthesizeFunction: z.string().min(1).optional(),
  /** Response audio format produced by the SDK. */
  responseFormat: z.string().min(1).default('mp3'),
  responseContentType: z.string().min(1).default('audio/mpeg'),
});

/**
 * CLI transport: a local command-line synthesizer (say, espeak, PowerShell, MLX, ...).
 * Placeholders inside `args` are expanded at runtime.
 */
const cliTtsProviderSchema = ttsProviderBaseSchema.extend({
  transport: z.literal('cli'),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  /** Per-platform overrides so one provider.json can cover darwin/linux/win32. */
  platformCommands: z
    .object({
      darwin: z
        .object({
          command: z.string().min(1),
          args: z.array(z.string()).optional(),
          /** Prefix args injected before the text arg when a voice is requested. */
          voiceArgs: z.array(z.string()).optional(),
          /** Rate formula for this platform; falls back to the top-level value. */
          rateMode: z.enum(['multiply', 'delta']).optional(),
          rateBase: z.number().int().positive().optional(),
        })
        .optional(),
      linux: z
        .object({
          command: z.string().min(1),
          args: z.array(z.string()).optional(),
          voiceArgs: z.array(z.string()).optional(),
          rateMode: z.enum(['multiply', 'delta']).optional(),
          rateBase: z.number().int().positive().optional(),
        })
        .optional(),
      win32: z
        .object({
          command: z.string().min(1),
          args: z.array(z.string()).optional(),
          voiceArgs: z.array(z.string()).optional(),
          rateMode: z.enum(['multiply', 'delta']).optional(),
          rateBase: z.number().int().positive().optional(),
        })
        .optional(),
    })
    .optional(),
  /** Rate formula for local engines: base * speed or delta (speed-1)*10. */
  rateMode: z.enum(['multiply', 'delta']).default('multiply'),
  /** Base words-per-minute for rateMode 'multiply'. */
  rateBase: z.number().int().positive().default(175),
  /** Audio format the CLI writes to disk. */
  outputFormat: z.string().min(1).default('mp3'),
  responseContentType: z.string().min(1).default('audio/mpeg'),
  timeoutMs: z.number().int().positive().default(60_000),
});

/**
 * In-process transport: a synthesizer imported from a local module.
 */
const inProcessTtsProviderSchema = ttsProviderBaseSchema.extend({
  transport: z.literal('in-process'),
  engineModule: z.string().min(1),
  engineFunction: z.string().min(1),
  responseFormat: z.string().min(1).default('mp3'),
  responseContentType: z.string().min(1).default('audio/mpeg'),
});

/**
 * MCP transport: an MCP server exposing a synthesis tool.
 */
const mcpTtsProviderSchema = ttsProviderBaseSchema.extend({
  transport: z.literal('mcp'),
  mcpServerId: z.string().min(1),
  toolName: z.string().min(1),
  serverArgs: z.array(z.string()).optional(),
  /** Result field that carries the base64 audio (when the tool returns JSON). */
  audioResultPath: z.string().min(1).default('audio'),
  audioSource: z.enum(['body', 'base64-json']).default('base64-json'),
});

/**
 * Gemini voice service transport: the local GeminiVoiceService provider
 * (generateContent TTS shape -> PCM16 wrapped into a WAV file). The service
 * resolves its own config/env defaults; only an optional API base URL override.
 */
const geminiVoiceServiceTtsProviderSchema = ttsProviderBaseSchema.extend({
  transport: z.literal('gemini-voice-service'),
  apiBaseUrl: z.string().min(1).optional(),
});

/**
 * Discriminated union: the `transport` field selects the config variant,
 * guaranteeing every provider config is fully validated at load time.
 */
export const ttsProviderConfigSchema = z.discriminatedUnion('transport', [
  httpTtsProviderSchema,
  sdkTtsProviderSchema,
  cliTtsProviderSchema,
  inProcessTtsProviderSchema,
  mcpTtsProviderSchema,
  geminiVoiceServiceTtsProviderSchema,
]);

export type TtsProviderConfig = z.infer<typeof ttsProviderConfigSchema>;
export type HttpTtsProviderConfig = z.infer<typeof httpTtsProviderSchema>;
export type SdkTtsProviderConfig = z.infer<typeof sdkTtsProviderSchema>;
export type CliTtsProviderConfig = z.infer<typeof cliTtsProviderSchema>;
export type InProcessTtsProviderConfig = z.infer<typeof inProcessTtsProviderSchema>;
export type McpTtsProviderConfig = z.infer<typeof mcpTtsProviderSchema>;
export type GeminiVoiceServiceTtsProviderConfig = z.infer<typeof geminiVoiceServiceTtsProviderSchema>;

/**
 * Resolves the API key for a provider config from the environment.
 * Returns null when the key is required but missing.
 */
export function resolveTtsApiKey(config: TtsProviderConfig): string | null {
  const envVar = config.apiKeyEnvVar;
  if (!envVar) return null;
  const value = process.env[envVar];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export const TTS_TRANSPORT_TYPES: readonly TtsTransportType[] = [
  'http',
  'sdk',
  'cli',
  'in-process',
  'mcp',
  'gemini-voice-service',
] as const;
