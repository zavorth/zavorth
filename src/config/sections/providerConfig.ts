import fs from 'fs';
import path from 'path';
import { safeParseInt } from '../../ai-gateway/shared/utils/safeParseInt.js';import {
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
  const parsed = safeParseInt(rawValue, fallback);
  return parsed > 0 ? parsed : fallback;
}

function getEnv(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

function getEnvBool(key: string, fallback = false): boolean {
  return parseBooleanFlag(process.env[key], fallback);
}

function getEnvInt(key: string, fallback: number): number {
  return parsePositiveInt(process.env[key], fallback);
}

function getEnvUrl(key: string, fallback = ''): string {
  return normalizeUrl(process.env[key] || fallback);
}

/** Empty by default — fallbacks only when the user configures them. */
export const DEFAULT_ECHO_LLM_FALLBACK_ORDER = [] as const;

export function parseEchoLlmFallbackOrder(rawValue: string | undefined): string[] {
  const seen = new Set<string>();
  return parseList(rawValue || '')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => {
      if (!provider || seen.has(provider)) {
        return false;
      }
      seen.add(provider);
      return true;
    });
}

type PersistedProviderPreference = {
  providerId: string;
  modelId: string | null;
  secondaryModelId: string | null;
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
      secondaryModelId: String(parsed.secondaryModelId || '').trim() || null,
      routeId: String(parsed.routeId || '').trim() || null,
      familyId: String(parsed.familyId || '').trim() || null,
    };
  } catch (error: unknown) {return null;
  }
}

export function buildProviderConfig(projectRoot?: string) {
  const persistedPreference = readPersistedProviderPreference(projectRoot);
  const directProviderDebug = getEnvBool('ZAVORTH_DIRECT_PROVIDER_DEBUG', false);
  // User choice only: env LLM_PROVIDER / preference file. Never invent gemini or aigateway.
  const envProvider = getEnv('LLM_PROVIDER', getEnv('ZAVORTH_PROVIDER', getEnv('ZAVORTH_LLM_PROVIDER', ''))).trim().toLowerCase();
  const preferredProvider = String(persistedPreference?.providerId || '').trim().toLowerCase();
  const selectedProvider = String(envProvider || preferredProvider || '').trim();
  const selectedModel = String(getEnv('ZAVORTH_MODEL_ID', getEnv('ZAVORTH_MODEL', persistedPreference?.modelId || ''))).trim();
  return {
    // LLM Provider — empty string means not configured (surfaces must not invent a vendor)
    llmProvider: selectedProvider,
    providerConfigured: Boolean(selectedProvider),
    secondaryModelId: String(
      getEnv('ZAVORTH_SECONDARY_MODEL_ID', getEnv('ZAVORTH_SECONDARY_MODEL', persistedPreference?.secondaryModelId || '')),
    ).trim() || null,
    directProviderDebug,
    echoLlmFallbackOrder: parseEchoLlmFallbackOrder(
      getEnv('ZAVORTH_ECHO_LLM_FALLBACK_ORDER', getEnv('ZAVORTH_ECHO_FALLBACK_ORDER', getEnv('ZAVORTH_PROVIDER_FALLBACK_ORDER'))),
    ),

    // API Keys
    geminiApiKey: getEnv('GEMINI_API_KEY'),
    geminiApiKeys: [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
    ].filter(Boolean) as string[],
    cloudflareAiGatewayAccountId: getEnv('CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID'),
    cloudflareAiGatewayId: getEnv('CLOUDFLARE_AI_GATEWAY_ID'),
    cloudflareAiGatewayBaseUrl: buildCloudflareAiGatewayBaseUrl(
      getEnv('CLOUDFLARE_AI_GATEWAY_BASE_URL'),
      getEnv('CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID'),
      getEnv('CLOUDFLARE_AI_GATEWAY_ID'),
    ),
    cloudflareAiGatewayToken: getEnv('CLOUDFLARE_AI_GATEWAY_TOKEN'),
    geminiApiBaseUrl: normalizeUrl(
      buildCloudflareAiGatewayBaseUrl(
        getEnv('CLOUDFLARE_AI_GATEWAY_BASE_URL'),
        getEnv('CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID'),
        getEnv('CLOUDFLARE_AI_GATEWAY_ID'),
      ) || getEnv('GEMINI_API_BASE_URL'),
    ),
    geminiApiVersion: getEnv('GEMINI_API_VERSION').trim(),
    geminiApiClient: getEnv('GEMINI_API_CLIENT', 'zavorth').trim(),
    geminiInteractionsEnabled: getEnvBool('ZAVORTH_GEMINI_INTERACTIONS_ENABLED', false),
    geminiInteractionsApiKey: getEnv('GEMINI_INTERACTIONS_API_KEY', getEnv('GEMINI_API_KEY')),
    geminiInteractionsBaseUrl: getEnvUrl('GEMINI_INTERACTIONS_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
    geminiInteractionsModel: getEnv('GEMINI_INTERACTIONS_MODEL', 'gemini-2.5-flash'),
    geminiManagedAgentsEnabled: getEnvBool('ZAVORTH_GEMINI_MANAGED_AGENTS_ENABLED', false),
    geminiManagedAgentsBaseUrl: getEnvUrl('GEMINI_MANAGED_AGENTS_BASE_URL', getEnv('GEMINI_INTERACTIONS_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta')),
    geminiManagedAgentsModel: getEnv('GEMINI_MANAGED_AGENTS_MODEL', getEnv('GEMINI_INTERACTIONS_MODEL', 'gemini-2.5-flash')),
    geminiManagedAgentsAgent: getEnv('GEMINI_MANAGED_AGENTS_AGENT', 'zavorth-managed-agent'),
    geminiManagedAgentsStore: getEnvBool('GEMINI_MANAGED_AGENTS_STORE', false),
    geminiCustomHeaders: (() => {
      const headers = parseStringMap(getEnv('GEMINI_CUSTOM_HEADERS_JSON'));
      const cloudflareToken = normalizeBearerToken(getEnv('CLOUDFLARE_AI_GATEWAY_TOKEN'));
      if (cloudflareToken) {
        headers['cf-aig-authorization'] = cloudflareToken;
      }
      return headers;
    })(),
    geminiCliCommand: getEnv('GEMINI_CLI_COMMAND', process.platform === 'win32' ? 'gemini.cmd' : 'gemini'),
    geminiTranscriptionApiKey: getEnv('GEMINI_TRANSCRIPTION_API_KEY'),
    geminiVoiceApiKey: getEnv('GEMINI_VOICE_API_KEY', getEnv('GEMINI_API_KEY')),
    aiStudioApiKey: getEnv('AISTUDIO_API_KEY', getEnv('GEMINI_API_KEY')),
    cloudflareTunnelPublicHostname: getEnv('CLOUDFLARE_TUNNEL_PUBLIC_HOSTNAME')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, ''),
    cloudflareAiGatewayEnabled:
      Boolean(
        buildCloudflareAiGatewayBaseUrl(
          getEnv('CLOUDFLARE_AI_GATEWAY_BASE_URL'),
          getEnv('CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID'),
          getEnv('CLOUDFLARE_AI_GATEWAY_ID'),
        ),
      ),

    deepseekApiKey: getEnv('DEEPSEEK_API_KEY'),
    openaiApiKey: getEnv('OPENAI_API_KEY'),
    openaiApiKeys: [
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_API_KEY_2,
      process.env.OPENAI_API_KEY_3,
      process.env.OPENAI_API_KEY_4,
      process.env.OPENAI_API_KEY_5,
    ].filter(Boolean) as string[],
    minimaxApiKey: getEnv('MINIMAX_API_KEY'),
    AIGatewayApiKey: getEnv('AIGateway_API_KEY'),
    puterAuthToken: getEnv('PUTER_AUTH_TOKEN', getEnv('QWEN_PUTER_AUTH_TOKEN')),
    groqApiKey: getEnv('GROQ_API_KEY'),
    xaiApiKey: getEnv('XAI_API_KEY'),
    mistralApiKey: getEnv('MISTRAL_API_KEY'),
    cerebrasApiKey: getEnv('CEREBRAS_API_KEY'),
    togetherApiKey: getEnv('TOGETHER_API_KEY'),
    ai21ApiKey: getEnv('AI21_API_KEY'),
    inflectionApiKey: getEnv('INFLECTION_API_KEY'),
    deepgramApiKey: getEnv('DEEPGRAM_API_KEY'),
    openRouterApiKey: getEnv('OPENROUTER_API_KEY'),
    openCodeApiKey: getEnv('OPENCODE_API_KEY'),
    julesApiKey: getEnv('JULES_API_KEY'),
    stitchApiKey: getEnv('JULES_API_KEY'), // Map stitching to Jules context where appropriate
    stitchAccessToken: getEnv('STITCH_ACCESS_TOKEN'),
    stitchGoogleCloudProject: getEnv('GOOGLE_CLOUD_PROJECT'),
    stitchHost: getEnv('STITCH_HOST', 'https://stitch.googleapis.com/mcp'),

    // Models
    modelSelectionFamilyId: getEnv('ZAVORTH_MODEL_FAMILY_ID', getEnv('ZAVORTH_MODEL_FAMILY', persistedPreference?.familyId || '')).trim(),
    modelSelectionRouteId: getEnv('ZAVORTH_MODEL_ROUTE_ID', getEnv('ZAVORTH_MODEL_ROUTE', persistedPreference?.routeId || '')).trim(),
    modelSelectionModelId: selectedModel,
    geminiDefaultModel: getEnv('GEMINI_MODEL', 'gemini-2.5-flash'),
    gemmaModel: getEnv('GEMMA_MODEL', 'gemma-2-27b-it'),
    geminiModel: getEnv('GEMINI_MODEL', 'gemini-2.5-flash'),
    aiStudioModel: getEnv('AISTUDIO_MODEL', getEnv('GEMINI_MODEL', 'gemini-2.5-flash')),
    geminiVideoModel: getEnv('GEMINI_VIDEO_MODEL', 'gemini-2.5-flash'),
    geminiTranscriptionModel: getEnv('GEMINI_TRANSCRIPTION_MODEL', getEnv('GEMINI_VIDEO_MODEL', 'gemini-2.5-flash')),
    openaiTranscriptionModel: getEnv('OPENAI_TRANSCRIPTION_MODEL', 'whisper-1'),
    groqModel: getEnv('GROQ_MODEL', 'llama-3.3-70b-versatile'),
    groqTranscriptionModel: getEnv('GROQ_TRANSCRIPTION_MODEL', 'whisper-large-v3-turbo'),
    deepgramTranscriptionModel: getEnv('DEEPGRAM_TRANSCRIPTION_MODEL', 'nova-2'),
    geminiVoiceModel: getEnv('GEMINI_VOICE_MODEL', 'gemini-2.5-flash'),
    geminiVoiceName: getEnv('GEMINI_VOICE_NAME', 'Kore'),
    geminiVoiceLanguageCode: getEnv('GEMINI_VOICE_LANGUAGE_CODE', 'en-US'),
    deepseekModel: getEnv('DEEPSEEK_MODEL', 'deepseek-chat'),
    xaiModel: getEnv('XAI_MODEL', 'grok-3'),
    mistralModel: getEnv('MISTRAL_MODEL', 'mistral-large-latest'),
    cerebrasModel: getEnv('CEREBRAS_MODEL', 'llama-3.3-70b'),
    togetherModel: getEnv('TOGETHER_MODEL', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'),
    ai21Model: getEnv('AI21_MODEL', 'jamba-1.5-large'),
    inflectionModel: getEnv('INFLECTION_MODEL', 'inflection-3'),
    openaiModel: getEnv('OPENAI_MODEL', 'gpt-4o'),
    minimaxModel: getEnv('MINIMAX_MODEL', 'MiniMax-M2.7'),
    minimaxBaseUrl: getEnvUrl('MINIMAX_BASE_URL', 'https://api.minimax.io/v1'),
    AIGatewayModel: getEnv('AIGateway_MODEL', getEnv('ZAVORTH_MODEL_ID', getEnv('ZAVORTH_MODEL', 'auto'))),
    AIGatewayUpstreamBaseUrl: getEnvUrl(
      'AIGateway_UPSTREAM_BASE_URL',
      getEnv('AIGateway_BASE_URL', 'http://127.0.0.1:20128/v1'),
    ),
    zavorthAIGatewayGatewayEnabled: (() => {
      const defaultEnabled = selectedProvider.trim().toLowerCase() === 'aigateway';
      const raw = process.env.ZAVORTH_AIGateway_GATEWAY_ENABLED;
      const resolved = typeof raw === 'string' && raw.length > 0
        ? raw
        : (defaultEnabled ? 'true' : 'false');
      return resolved.toLowerCase() !== 'false';
    })(),
    zavorthAIGatewayGatewayHost: getEnv('ZAVORTH_AIGateway_GATEWAY_HOST', '127.0.0.1'),
    zavorthAIGatewayGatewayPort: getEnvInt('ZAVORTH_AIGateway_GATEWAY_PORT', 21128),
    zavorthAIGatewayGatewayBaseUrl: (() => {
      const explicit = normalizeUrl(getEnv('ZAVORTH_AIGateway_GATEWAY_BASE_URL'));
      if (explicit) {
        return explicit;
      }
      const host = getEnv('ZAVORTH_AIGateway_GATEWAY_HOST', '127.0.0.1');
      const port = getEnvInt('ZAVORTH_AIGateway_GATEWAY_PORT', 21128);
      return normalizeUrl(`http://${host}:${port}/v1`);
    })(),
    AIGatewayBaseUrl: (() => {
      const gatewayEnabled = getEnv('ZAVORTH_AIGateway_GATEWAY_ENABLED', 'true').toLowerCase() !== 'false';
      const explicitGateway = normalizeUrl(getEnv('ZAVORTH_AIGateway_GATEWAY_BASE_URL'));
      if (gatewayEnabled) {
        return explicitGateway || normalizeUrl(
          `http://${getEnv('ZAVORTH_AIGateway_GATEWAY_HOST', '127.0.0.1')}:${getEnvInt('ZAVORTH_AIGateway_GATEWAY_PORT', 21128)}/v1`,
        );
      }
      return normalizeUrl(
        getEnv('AIGateway_UPSTREAM_BASE_URL', getEnv('AIGateway_BASE_URL', 'http://127.0.0.1:20128/v1')),
      );
    })(),
    AIGatewaySidecarEnabled:
      getEnv('AIGateway_SIDECAR_ENABLED', selectedProvider.trim().toLowerCase() === 'aigateway' ? 'true' : 'false').toLowerCase() === 'true',
    AIGatewaySidecarInstallOnBoot:
      getEnv('AIGateway_SIDECAR_INSTALL_ON_BOOT', 'true').toLowerCase() !== 'false',
    AIGatewaySidecarStartCommand:
      getEnv('AIGateway_SIDECAR_START_COMMAND', process.platform === 'win32' ? 'npm.cmd' : 'npm'),
    AIGatewaySidecarStartArgs: parseList(getEnv('AIGateway_SIDECAR_START_ARGS', 'run,dev')),
    AIGatewaySidecarBootstrapCommand:
      getEnv('AIGateway_SIDECAR_BOOTSTRAP_COMMAND', process.platform === 'win32' ? 'npm.cmd' : 'npm'),
    AIGatewaySidecarBootstrapArgs: parseList(getEnv('AIGateway_SIDECAR_BOOTSTRAP_ARGS', 'install')),
    AIGatewaySidecarReadyTimeoutMs: getEnvInt('AIGateway_SIDECAR_READY_TIMEOUT_MS', 120000),
    ZavorthTerminalBaseUrl: getEnvUrl('ZAVORTH_BRIDGE_REMOTE_BASE_URL', 'http://127.0.0.1:4747'),
    ZavorthTerminalPublicUrl: getEnvUrl('ZAVORTH_BRIDGE_REMOTE_PUBLIC_URL'),
    ZavorthTerminalSidecarEnabled:
      getEnv('ZAVORTH_BRIDGE_REMOTE_SIDECAR_ENABLED', getEnv('ZAVORTH_BRIDGE_AUTOMATION_ENABLED', 'true')).toLowerCase() === 'true',
    ZavorthTerminalSidecarInstallOnBoot:
      getEnv('ZAVORTH_BRIDGE_REMOTE_SIDECAR_INSTALL_ON_BOOT', 'true').toLowerCase() !== 'false',
    ZavorthTerminalSidecarStartCommand:
      getEnv('ZAVORTH_BRIDGE_REMOTE_SIDECAR_START_COMMAND', process.platform === 'win32' ? 'npm.cmd' : 'npm'),
    ZavorthTerminalSidecarStartArgs: parseList(
      getEnv('ZAVORTH_BRIDGE_REMOTE_SIDECAR_START_ARGS', 'run,dev'),
    ),
    ZavorthTerminalSidecarBootstrapCommand:
      getEnv('ZAVORTH_BRIDGE_REMOTE_SIDECAR_BOOTSTRAP_COMMAND', process.platform === 'win32' ? 'npm.cmd' : 'npm'),
    ZavorthTerminalSidecarBootstrapArgs: parseList(
      getEnv('ZAVORTH_BRIDGE_REMOTE_SIDECAR_BOOTSTRAP_ARGS', 'install'),
    ),
    ZavorthTerminalSidecarReadyTimeoutMs: getEnvInt(
      'ZAVORTH_BRIDGE_REMOTE_SIDECAR_READY_TIMEOUT_MS',
      120000,
    ),
    ZavorthTerminalAppPassword:
      getEnv('ZAVORTH_BRIDGE_REMOTE_APP_PASSWORD', getEnv('ZAVORTH_WEB_AUTH_TOKEN')),
    qwenModel: getEnv('QWEN_MODEL', 'openrouter:qwen/qwen3.5-plus-02-15'),
    openRouterModel: getEnv('OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet:beta'),
    openCodeModel: getEnv('OPENCODE_MODEL', 'opencode/minimax-m2.5-free'),
    tools: {
      media: {
        audio: {
          sttEnabled: getEnvBool('ZAVORTH_AUDIO_STT_ENABLED', true),
          sttProviderOrder: parseList(
            getEnv('ZAVORTH_AUDIO_STT_PROVIDERS', 'gemini,openai,groq,deepgram,whisper.cpp'),
          ),
          sttTimeoutMs: getEnvInt('ZAVORTH_AUDIO_STT_TIMEOUT_MS', 45_000),
          sttMaxBytes: getEnvInt('ZAVORTH_AUDIO_STT_MAX_BYTES', 24 * 1024 * 1024),
          sttMaxSeconds: getEnvInt('ZAVORTH_AUDIO_STT_MAX_SECONDS', 10 * 60),
          echoTranscript: getEnvBool('ZAVORTH_AUDIO_ECHO_TRANSCRIPT', false),
          forwardRawAudio: getEnvBool('ZAVORTH_TELEGRAM_FORWARD_RAW_AUDIO') || getEnvBool('ZAVORTH_AUDIO_FORWARD_RAW'),
          ttsTimeoutMs: getEnvInt('ZAVORTH_AUDIO_TTS_TIMEOUT_MS', 18_000),
          ttsMaxChars: getEnvInt('ZAVORTH_AUDIO_TTS_MAX_CHARS', 520),
          ttsCacheEnabled: getEnvBool('ZAVORTH_AUDIO_TTS_CACHE_ENABLED', true),
          ttsCacheTtlMs: getEnvInt('ZAVORTH_AUDIO_TTS_CACHE_TTL_MS', 10 * 60 * 1000),
          newsMinResults: getEnvInt('ZAVORTH_WEB_SEARCH_MIN_FRESH_NEWS_RESULTS', 3),
        },
      },
    },
  };
}
