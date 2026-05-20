import fs from 'fs';
import path from 'path';

import {
  buildCloudflareAiGatewayBaseUrl,
  normalizeBearerToken,
  normalizeUrl,
  parseList,
  parseStringMap,
} from '../configHelpers';

function parseBooleanFlag(rawValue: string | undefined, fallback: boolean): boolean {
  const normalized = String(rawValue ?? '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return !['0', 'false', 'no', 'off', 'disabled'].includes(normalized);
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(rawValue || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const DEFAULT_ECHO_LLM_FALLBACK_ORDER = [
  'aigateway',
  'gemini',
  'ollama',
  'lmstudio',
  'vllm',
  'deepseek',
  'openrouter',
  'openai',
  'opencode',
] as const;

export function parseEchoLlmFallbackOrder(rawValue: string | undefined): string[] {
  const seen = new Set<string>();
  const parsed = parseList(rawValue || '')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => {
      if (!provider || seen.has(provider)) {
        return false;
      }
      seen.add(provider);
      return true;
    });
  return parsed.length > 0 ? parsed : [...DEFAULT_ECHO_LLM_FALLBACK_ORDER];
}

type PersistedProviderPreference = {
  providerId: string;
  modelId: string | null;
  routeId: string | null;
  familyId: string | null;
};

function readPersistedProviderPreference(projectRoot?: string): PersistedProviderPreference | null {
  if (!projectRoot) {
    return null;
  }
  const preferencePath = path.join(projectRoot, 'data', 'runtime', 'provider-selection-preferences.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(preferencePath, 'utf8')) as Partial<PersistedProviderPreference>;
    const providerId = String(parsed.providerId || '').trim().toLowerCase();
    if (!providerId) {
      return null;
    }
    return {
      providerId,
      modelId: String(parsed.modelId || '').trim() || null,
      routeId: String(parsed.routeId || '').trim() || null,
      familyId: String(parsed.familyId || '').trim() || null,
    };
  } catch {
    return null;
  }
}

export function buildProviderConfig(projectRoot?: string) {
  const persistedPreference = readPersistedProviderPreference(projectRoot);
  const selectedProvider = String(process.env.LLM_PROVIDER || persistedPreference?.providerId || 'gemini').trim();
  const selectedModel = String(process.env.ZAVORTH_MODEL_ID || process.env.ZAVORTH_MODEL || persistedPreference?.modelId || '').trim();
  return {
    // LLM Provider
    llmProvider: selectedProvider,
    echoLlmFallbackOrder: parseEchoLlmFallbackOrder(
      process.env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER || process.env.ZAVORTH_ECHO_FALLBACK_ORDER,
    ),

    // API Keys
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiApiKeys: [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
    ].filter(Boolean) as string[],
    cloudflareAiGatewayAccountId: process.env.CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID || '',
    cloudflareAiGatewayId: process.env.CLOUDFLARE_AI_GATEWAY_ID || '',
    cloudflareAiGatewayBaseUrl: buildCloudflareAiGatewayBaseUrl(
      process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL || '',
      process.env.CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID || '',
      process.env.CLOUDFLARE_AI_GATEWAY_ID || '',
    ),
    cloudflareAiGatewayToken: process.env.CLOUDFLARE_AI_GATEWAY_TOKEN || '',
    geminiApiBaseUrl: normalizeUrl(
      buildCloudflareAiGatewayBaseUrl(
        process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL || '',
        process.env.CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID || '',
        process.env.CLOUDFLARE_AI_GATEWAY_ID || '',
      ) || process.env.GEMINI_API_BASE_URL || '',
    ),
    geminiApiVersion: String(process.env.GEMINI_API_VERSION || '').trim(),
    geminiApiClient: String(process.env.GEMINI_API_CLIENT || 'zavorth').trim(),
    geminiInteractionsEnabled: parseBooleanFlag(process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED, false),
    geminiInteractionsApiKey: process.env.GEMINI_INTERACTIONS_API_KEY || process.env.GEMINI_API_KEY || '',
    geminiInteractionsBaseUrl: normalizeUrl(process.env.GEMINI_INTERACTIONS_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'),
    geminiInteractionsModel: process.env.GEMINI_INTERACTIONS_MODEL || 'gemini-3.5-flash',
    geminiManagedAgentsEnabled: parseBooleanFlag(process.env.ZAVORTH_GEMINI_MANAGED_AGENTS_ENABLED, false),
    geminiManagedAgentsBaseUrl: normalizeUrl(process.env.GEMINI_MANAGED_AGENTS_BASE_URL || process.env.GEMINI_INTERACTIONS_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'),
    geminiManagedAgentsModel: process.env.GEMINI_MANAGED_AGENTS_MODEL || process.env.GEMINI_INTERACTIONS_MODEL || 'gemini-3.5-flash',
    geminiManagedAgentsAgent: process.env.GEMINI_MANAGED_AGENTS_AGENT || 'antigravity',
    geminiManagedAgentsStore: parseBooleanFlag(process.env.GEMINI_MANAGED_AGENTS_STORE, false),
    geminiCustomHeaders: (() => {
      const headers = parseStringMap(process.env.GEMINI_CUSTOM_HEADERS_JSON || '');
      const cloudflareToken = normalizeBearerToken(process.env.CLOUDFLARE_AI_GATEWAY_TOKEN || '');
      if (cloudflareToken) {
        headers['cf-aig-authorization'] = cloudflareToken;
      }
      return headers;
    })(),
    geminiCliCommand: process.env.GEMINI_CLI_COMMAND || (process.platform === 'win32' ? 'gemini.cmd' : 'gemini'),
    geminiTranscriptionApiKey: process.env.GEMINI_TRANSCRIPTION_API_KEY || '',
    geminiVoiceApiKey: process.env.GEMINI_VOICE_API_KEY || process.env.GEMINI_API_KEY || '',
    aiStudioApiKey: process.env.AISTUDIO_API_KEY || process.env.GEMINI_API_KEY || '',
    cloudflareTunnelPublicHostname: String(process.env.CLOUDFLARE_TUNNEL_PUBLIC_HOSTNAME || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, ''),
    cloudflareAiGatewayEnabled:
      Boolean(
        buildCloudflareAiGatewayBaseUrl(
          process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL || '',
          process.env.CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID || '',
          process.env.CLOUDFLARE_AI_GATEWAY_ID || '',
        ),
      ),

    deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    minimaxApiKey: process.env.MINIMAX_API_KEY || '',
    AIGatewayApiKey: process.env.AIGateway_API_KEY || '',
    puterAuthToken: process.env.PUTER_AUTH_TOKEN || process.env.QWEN_PUTER_AUTH_TOKEN || '',
    groqApiKey: process.env.GROQ_API_KEY || '',
    deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openCodeApiKey: process.env.OPENCODE_API_KEY || '',
    julesApiKey: process.env.JULES_API_KEY || '',
    stitchApiKey: process.env.STITCH_API_KEY || '',
    stitchAccessToken: process.env.STITCH_ACCESS_TOKEN || '',
    stitchGoogleCloudProject: process.env.GOOGLE_CLOUD_PROJECT || '',
    stitchHost: process.env.STITCH_HOST || 'https://stitch.googleapis.com/mcp',

    // Models
    modelSelectionFamilyId: String(process.env.ZAVORTH_MODEL_FAMILY_ID || process.env.ZAVORTH_MODEL_FAMILY || persistedPreference?.familyId || '').trim(),
    modelSelectionRouteId: String(process.env.ZAVORTH_MODEL_ROUTE_ID || process.env.ZAVORTH_MODEL_ROUTE || persistedPreference?.routeId || '').trim(),
    modelSelectionModelId: selectedModel,
    geminiDefaultModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    gemmaModel: process.env.GEMMA_MODEL || 'gemma-4-31b-it',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    aiStudioModel: process.env.AISTUDIO_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    geminiVideoModel: process.env.GEMINI_VIDEO_MODEL || 'gemini-2.5-flash',
    geminiTranscriptionModel: process.env.GEMINI_TRANSCRIPTION_MODEL || process.env.GEMINI_VIDEO_MODEL || 'gemini-2.5-flash',
    openaiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
    groqTranscriptionModel: process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
    deepgramTranscriptionModel: process.env.DEEPGRAM_TRANSCRIPTION_MODEL || 'nova-3',
    geminiVoiceModel: process.env.GEMINI_VOICE_MODEL || 'gemini-3.1-flash-tts-preview',
    geminiVoiceName: process.env.GEMINI_VOICE_NAME || 'Kore',
    geminiVoiceLanguageCode: process.env.GEMINI_VOICE_LANGUAGE_CODE || 'en-US',
    deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
    minimaxModel: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
    minimaxBaseUrl: normalizeUrl(process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1'),
    AIGatewayModel: process.env.AIGateway_MODEL || process.env.OPENAI_MODEL || 'gpt-4o',
    AIGatewayUpstreamBaseUrl: normalizeUrl(
      process.env.AIGateway_UPSTREAM_BASE_URL
      || process.env.AIGateway_BASE_URL
      || 'http://127.0.0.1:20128/v1',
    ),
    zavorthAIGatewayGatewayEnabled: (() => {
      const defaultEnabled = (process.env.LLM_PROVIDER || 'gemini').trim().toLowerCase() === 'aigateway';
      const raw = process.env.ZAVORTH_AIGateway_GATEWAY_ENABLED;
      const resolved = typeof raw === 'string' && raw.length > 0
        ? raw
        : (defaultEnabled ? 'true' : 'false');
      return resolved.toLowerCase() !== 'false';
    })(),
    zavorthAIGatewayGatewayHost: process.env.ZAVORTH_AIGateway_GATEWAY_HOST || '127.0.0.1',
    zavorthAIGatewayGatewayPort: parseInt(process.env.ZAVORTH_AIGateway_GATEWAY_PORT || '21128', 10),
    zavorthAIGatewayGatewayBaseUrl: (() => {
      const explicit = normalizeUrl(process.env.ZAVORTH_AIGateway_GATEWAY_BASE_URL || '');
      if (explicit) {
        return explicit;
      }
      const host = process.env.ZAVORTH_AIGateway_GATEWAY_HOST || '127.0.0.1';
      const port = parseInt(process.env.ZAVORTH_AIGateway_GATEWAY_PORT || '21128', 10);
      return normalizeUrl(`http://${host}:${port}/v1`);
    })(),
    AIGatewayBaseUrl: (() => {
      const gatewayEnabled = (process.env.ZAVORTH_AIGateway_GATEWAY_ENABLED || 'true').toLowerCase() !== 'false';
      const explicitGateway = normalizeUrl(process.env.ZAVORTH_AIGateway_GATEWAY_BASE_URL || '');
      if (gatewayEnabled) {
        return explicitGateway || normalizeUrl(
          `http://${process.env.ZAVORTH_AIGateway_GATEWAY_HOST || '127.0.0.1'}:${parseInt(process.env.ZAVORTH_AIGateway_GATEWAY_PORT || '21128', 10)}/v1`,
        );
      }
      return normalizeUrl(
        process.env.AIGateway_UPSTREAM_BASE_URL
        || process.env.AIGateway_BASE_URL
        || 'http://127.0.0.1:20128/v1',
      );
    })(),
    AIGatewaySidecarEnabled:
      (
        process.env.AIGateway_SIDECAR_ENABLED ||
        ((process.env.LLM_PROVIDER || 'gemini').trim().toLowerCase() === 'aigateway' ? 'true' : 'false')
      ).toLowerCase() === 'true',
    AIGatewaySidecarInstallOnBoot:
      (process.env.AIGateway_SIDECAR_INSTALL_ON_BOOT || 'true').toLowerCase() !== 'false',
    AIGatewaySidecarStartCommand:
      process.env.AIGateway_SIDECAR_START_COMMAND || (process.platform === 'win32' ? 'npm.cmd' : 'npm'),
    AIGatewaySidecarStartArgs: parseList(process.env.AIGateway_SIDECAR_START_ARGS || 'run,dev'),
    AIGatewaySidecarBootstrapCommand:
      process.env.AIGateway_SIDECAR_BOOTSTRAP_COMMAND || (process.platform === 'win32' ? 'npm.cmd' : 'npm'),
    AIGatewaySidecarBootstrapArgs: parseList(process.env.AIGateway_SIDECAR_BOOTSTRAP_ARGS || 'install'),
    AIGatewaySidecarReadyTimeoutMs: parseInt(process.env.AIGateway_SIDECAR_READY_TIMEOUT_MS || '120000', 10),
    ZavorthTerminalBaseUrl: normalizeUrl(
      process.env.ZAVORTH_BRIDGE_REMOTE_BASE_URL || 'http://127.0.0.1:4747',
    ),
    ZavorthTerminalPublicUrl: normalizeUrl(
      process.env.ZAVORTH_BRIDGE_REMOTE_PUBLIC_URL || '',
    ),
    ZavorthTerminalSidecarEnabled:
      (
        process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_ENABLED ||
        (process.env.ZAVORTH_BRIDGE_AUTOMATION_ENABLED || 'true')
      ).toLowerCase() === 'true',
    ZavorthTerminalSidecarInstallOnBoot:
      (process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_INSTALL_ON_BOOT || 'true').toLowerCase() !== 'false',
    ZavorthTerminalSidecarStartCommand:
      process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_START_COMMAND || (process.platform === 'win32' ? 'npm.cmd' : 'npm'),
    ZavorthTerminalSidecarStartArgs: parseList(
      process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_START_ARGS || 'run,dev',
    ),
    ZavorthTerminalSidecarBootstrapCommand:
      process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_BOOTSTRAP_COMMAND || (process.platform === 'win32' ? 'npm.cmd' : 'npm'),
    ZavorthTerminalSidecarBootstrapArgs: parseList(
      process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_BOOTSTRAP_ARGS || 'install',
    ),
    ZavorthTerminalSidecarReadyTimeoutMs: parseInt(
      process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_READY_TIMEOUT_MS || '120000',
      10,
    ),
    ZavorthTerminalAppPassword:
      process.env.ZAVORTH_BRIDGE_REMOTE_APP_PASSWORD || process.env.ZAVORTH_WEB_AUTH_TOKEN || '',
    qwenModel: process.env.QWEN_MODEL || 'openrouter:qwen/qwen3.5-plus-02-15',
    openRouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet:beta',
    openCodeModel: process.env.OPENCODE_MODEL || 'opencode/minimax-m2.5-free',
    tools: {
      media: {
        audio: {
          sttEnabled: parseBooleanFlag(process.env.ZAVORTH_AUDIO_STT_ENABLED, true),
          sttProviderOrder: parseList(
            process.env.ZAVORTH_AUDIO_STT_PROVIDERS || 'gemini,openai,groq,deepgram,whisper.cpp',
          ),
          sttTimeoutMs: parsePositiveInt(process.env.ZAVORTH_AUDIO_STT_TIMEOUT_MS, 45_000),
          sttMaxBytes: parsePositiveInt(process.env.ZAVORTH_AUDIO_STT_MAX_BYTES, 24 * 1024 * 1024),
          sttMaxSeconds: parsePositiveInt(process.env.ZAVORTH_AUDIO_STT_MAX_SECONDS, 10 * 60),
          echoTranscript: parseBooleanFlag(process.env.ZAVORTH_AUDIO_ECHO_TRANSCRIPT, false),
          forwardRawAudio: parseBooleanFlag(
            process.env.ZAVORTH_TELEGRAM_FORWARD_RAW_AUDIO || process.env.ZAVORTH_AUDIO_FORWARD_RAW,
            false,
          ),
          ttsTimeoutMs: parsePositiveInt(process.env.ZAVORTH_AUDIO_TTS_TIMEOUT_MS, 18_000),
          ttsMaxChars: parsePositiveInt(process.env.ZAVORTH_AUDIO_TTS_MAX_CHARS, 520),
          ttsCacheEnabled: parseBooleanFlag(process.env.ZAVORTH_AUDIO_TTS_CACHE_ENABLED, true),
          ttsCacheTtlMs: parsePositiveInt(process.env.ZAVORTH_AUDIO_TTS_CACHE_TTL_MS, 10 * 60 * 1000),
          newsMinResults: parsePositiveInt(process.env.ZAVORTH_WEB_SEARCH_MIN_FRESH_NEWS_RESULTS, 3),
        },
      },
    },
  };
}
