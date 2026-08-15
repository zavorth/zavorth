import { z } from 'zod';
import type { SttTransportType } from './SpeechTranscriptionContract.js';

/**
 * Environment variable naming convention used by the STT config layer.
 * Packs reference env vars by name so secrets never live in provider.json.
 */
export const sttApiKeyEnvSchema = z.string().min(1);

/**
 * Shared fields for every transport variant.
 */
const sttProviderBaseSchema = z.object({
  providerId: z.string().min(1),
  label: z.string().min(1).optional(),
  apiKeyEnvVar: sttApiKeyEnvSchema.optional(),
  modelId: z.string().min(1).optional(),
});

/**
 * HTTP transport: raw HTTP/REST transcription APIs (OpenAI, Deepgram, Azure, Gemini, ...).
 * Request style selects how the audio payload is sent.
 */
const httpSttProviderSchema = sttProviderBaseSchema.extend({
  transport: z.literal('http'),
  transcribeUrl: z.string().min(1),
  requestStyle: z
    .enum(['raw-audio', 'json-base64', 'multipart', 'template'])
    .default('raw-audio'),
  authHeaderName: z.string().min(1).default('Authorization'),
  authScheme: z.string().min(1).nullable().default('Bearer'),
  authQueryParam: z.string().min(1).optional(),
  requestHeaderNames: z
    .object({
      contentType: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
    })
    .optional(),
  transcriptPath: z.string().min(1).default('text'),
  languagePath: z.string().min(1).optional(),
  queryParamNames: z
    .object({
      prompt: z.string().min(1).optional(),
      temperature: z.string().min(1).optional(),
      wordTimestamps: z.string().min(1).optional(),
    })
    .optional(),
  payloadTemplate: z.string().optional(),
  timeoutMs: z.number().int().positive().default(120_000),
});

/**
 * WebSocket transport: streaming transcription over a live socket.
 */
const websocketSttProviderSchema = sttProviderBaseSchema.extend({
  transport: z.literal('websocket'),
  wsUrl: z.string().min(1),
  protocol: z.string().min(1).optional(),
  transcriptPath: z.string().min(1).default('text'),
  timeoutMs: z.number().int().positive().default(120_000),
});

/**
 * SDK transport: a dedicated client library loaded at runtime.
 */
const sdkSttProviderSchema = sttProviderBaseSchema.extend({
  transport: z.literal('sdk'),
  sdkModule: z.string().min(1),
  factoryFunction: z.string().min(1),
  configField: z.string().min(1).optional(),
  transcriptPath: z.string().min(1).optional(),
});

/**
 * CLI transport: a local command-line transcriber (whisper.cpp, faster-whisper, ...).
 */
const cliSttProviderSchema = sttProviderBaseSchema.extend({
  transport: z.literal('cli'),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  transcriptPath: z.string().min(1).default('text'),
  timeoutMs: z.number().int().positive().default(120_000),
});

/**
 * In-process transport: a transcriber imported from a local module.
 */
const inProcessSttProviderSchema = sttProviderBaseSchema.extend({
  transport: z.literal('in-process'),
  engineModule: z.string().min(1),
  engineFunction: z.string().min(1),
  modelId: z.string().optional(),
});

/**
 * MCP transport: an MCP server exposing a transcription tool.
 */
const mcpSttProviderSchema = sttProviderBaseSchema.extend({
  transport: z.literal('mcp'),
  mcpServerId: z.string().min(1),
  toolName: z.string().min(1),
  serverArgs: z.array(z.string()).optional(),
});

/**
 * Discriminated union: the `transport` field selects the config variant,
 * guaranteeing every provider config is fully validated at load time.
 */
export const sttProviderConfigSchema = z.discriminatedUnion('transport', [
  httpSttProviderSchema,
  websocketSttProviderSchema,
  sdkSttProviderSchema,
  cliSttProviderSchema,
  inProcessSttProviderSchema,
  mcpSttProviderSchema,
]);

export type SttProviderConfig = z.infer<typeof sttProviderConfigSchema>;
export type HttpSttProviderConfig = z.infer<typeof httpSttProviderSchema>;
export type WebsocketSttProviderConfig = z.infer<typeof websocketSttProviderSchema>;
export type SdkSttProviderConfig = z.infer<typeof sdkSttProviderSchema>;
export type CliSttProviderConfig = z.infer<typeof cliSttProviderSchema>;
export type InProcessSttProviderConfig = z.infer<typeof inProcessSttProviderSchema>;
export type McpSttProviderConfig = z.infer<typeof mcpSttProviderSchema>;

/**
 * Resolves the API key for a provider config from the environment.
 * Returns null when the key is required but missing.
 */
export function resolveSttApiKey(config: SttProviderConfig): string | null {
  const envVar = config.apiKeyEnvVar;
  if (!envVar) return null;
  const value = process.env[envVar];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export const STT_TRANSPORT_TYPES: readonly SttTransportType[] = [
  'http',
  'websocket',
  'sdk',
  'cli',
  'in-process',
  'mcp',
] as const;
