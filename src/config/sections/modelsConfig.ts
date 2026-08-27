/**
 * Model Configuration
 *
 * Centralized model defaults and provider classifications.
 * All model defaults and provider classifications are configurable via environment variables.
 */

export type LiveProviderFamily = 'gemini' | 'openai' | 'anthropic';

export interface LiveProviderDefaults {
  model: string;
  transcriptionModel?: string;
  voiceModel?: string;
  visionModel?: string;
}

export interface ProviderModelsConfig {
  liveDefaults: Record<LiveProviderFamily, LiveProviderDefaults>;
  defaultModels: Record<string, string>;
  transcriptionModels: Record<string, string>;
  visionModels: Record<string, string>;
  voiceModels: Record<string, string>;
  transcriptionModelsByProvider: Record<string, string>;
  voiceModelsByProvider: Record<string, string>;
}

function getEnv(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

/**
 * Live Provider Default Models
 * Can be overridden via environment variables:
 * - ZAVORTH_LIVE_GEMINI_MODEL
 * - ZAVORTH_LIVE_OPENAI_MODEL
 * - ZAVORTH_LIVE_ANTHROPIC_MODEL
 */
export const LIVE_PROVIDER_DEFAULTS: Record<LiveProviderFamily, LiveProviderDefaults> = {
  gemini: {
    model: getEnv('ZAVORTH_LIVE_GEMINI_MODEL', 'gemini-2.5-flash'),
    transcriptionModel: getEnv('ZAVORTH_LIVE_GEMINI_TRANSCRIPTION_MODEL', 'gemini-2.5-flash'),
    voiceModel: getEnv('ZAVORTH_LIVE_GEMINI_VOICE_MODEL', 'gemini-2.5-flash'),
    visionModel: getEnv('ZAVORTH_LIVE_GEMINI_VISION_MODEL', 'gemini-2.5-flash'),
  },
  openai: {
    model: getEnv('ZAVORTH_LIVE_OPENAI_MODEL', 'gpt-4o-mini'),
    transcriptionModel: getEnv('ZAVORTH_LIVE_OPENAI_TRANSCRIPTION_MODEL', 'whisper-1'),
    voiceModel: getEnv('ZAVORTH_LIVE_OPENAI_VOICE_MODEL', 'tts-1'),
    visionModel: getEnv('ZAVORTH_LIVE_OPENAI_VISION_MODEL', 'gpt-4o'),
  },
  anthropic: {
    model: getEnv('ZAVORTH_LIVE_ANTHROPIC_MODEL', 'claude-3-5-haiku-latest'),
    transcriptionModel: getEnv('ZAVORTH_LIVE_ANTHROPIC_TRANSCRIPTION_MODEL', 'whisper-1'),
    voiceModel: getEnv('ZAVORTH_LIVE_ANTHROPIC_VOICE_MODEL', 'tts-1'),
    visionModel: getEnv('ZAVORTH_LIVE_ANTHROPIC_VISION_MODEL', 'claude-3-5-sonnet-latest'),
  },
};

/**
 * First-class provider identifiers
 * Can be extended via ZAVORTH_FIRST_CLASS_PROVIDERS env (comma-separated)
 */
export function getFirstClassProviders(): Set<string> {
  const defaults = [
    'gemini',
    'deepseek',
    'openai',
    'minimax',
    'aigateway',
    'qwen',
    'puter',
    'openrouter',
    'opencode',
    'ollama',
  ];
  const extra = process.env.ZAVORTH_FIRST_CLASS_PROVIDERS?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) || [];
  return new Set([...defaults, ...extra]);
}

/**
 * Anthropic-compatible route identifiers
 * Can be extended via ZAVORTH_ANTHROPIC_ROUTE_IDS env (comma-separated)
 */
export function getAnthropicRouteIds(): Set<string> {
  const defaults = [
    'anthropic',
    'claude',
    'anthropic-direct',
    'anthropic-vertex',
    'bedrock-claude',
    'anthropic-compatible',
    'anthropic_compatible',
  ];
  const extra = process.env.ZAVORTH_ANTHROPIC_ROUTE_IDS?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) || [];
  return new Set([...defaults, ...extra]);
}

/**
 * OpenAI-compatible route identifiers
 * Can be extended via ZAVORTH_OPENAI_COMPATIBLE_ROUTE_IDS env (comma-separated)
 */
export function getOpenAiCompatibleRouteIds(): Set<string> {
  const defaults = [
    'openai-compatible',
    'openai_compatible',
    'custom_compatible',
    'custom-compatible',
    'gateway',
  ];
  const extra = process.env.ZAVORTH_OPENAI_COMPATIBLE_ROUTE_IDS?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) || [];
  return new Set([...defaults, ...extra]);
}

/**
 * Default model for each provider family
 * Can be overridden via ZAVORTH_DEFAULT_<PROVIDER>_MODEL env vars
 */
export const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  gemini: process.env.ZAVORTH_GEMINI_MODEL || 'gemini-2.5-flash',
  openai: process.env.OPENAI_MODEL || 'gpt-4o',
  anthropic: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
  deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  groq: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  groqTranscription: process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
  deepgramTranscription: process.env.DEEPGRAM_TRANSCRIPTION_MODEL || 'nova-2',
  groqTranscriptionModel: process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
  deepgramTranscriptionModel: process.env.DEEPGRAM_TRANSCRIPTION_MODEL || 'nova-2',
  mistral: process.env.MISTRAL_MODEL || 'mistral-large-latest',
  cerebras: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
  together: process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  ai21: process.env.AI21_MODEL || 'jamba-1.5-large',
  inflection: process.env.INFLECTION_MODEL || 'inflection-3',
  minimax: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
  xai: process.env.XAI_MODEL || 'grok-3',
  grok: process.env.XAI_MODEL || 'grok-3',
  qwen: process.env.QWEN_MODEL || 'openrouter:qwen/qwen3.5-plus-02-15',
  openRouter: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet:beta',
  openCode: process.env.OPENCODE_MODEL || 'opencode/minimax-m2.5-free',
  minimaxBaseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  gemmaModel: process.env.GEMMA_MODEL || 'gemma-2-27b-it',
  aiStudioModel: process.env.AISTUDIO_MODEL || 'gemini-2.5-flash',
  geminiVideoModel: process.env.GEMINI_VIDEO_MODEL || 'gemini-2.5-flash',
  geminiTranscriptionModel: process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-2.5-flash',
  geminiVoiceModel: process.env.GEMINI_VOICE_MODEL || 'gemini-2.5-flash',
  geminiVoiceName: process.env.GEMINI_VOICE_NAME || 'Kore',
  geminiVoiceLanguageCode: process.env.GEMINI_VOICE_LANGUAGE_CODE || 'en-US',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  xaiModel: process.env.XAI_MODEL || 'grok-3',
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-large-latest',
  cerebrasModel: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
  togetherModel: process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  ai21Model: process.env.AI21_MODEL || 'jamba-1.5-large',
  inflectionModel: process.env.INFLECTION_MODEL || 'inflection-3',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  minimaxModel: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
  AIGatewayModel: process.env.AIGATEWAY_MODEL || 'auto',
  AIGatewayUpstreamBaseUrl: process.env.AIGATEWAY_UPSTREAM_BASE_URL || 'http://127.0.0.1:20128/v1',
  openRouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet:beta',
  openCodeModel: process.env.OPENCODE_MODEL || 'opencode/minimax-m2.5-free',
  qwenModel: process.env.QWEN_MODEL || 'openrouter:qwen/qwen3.5-plus-02-15',
};

/**
 * Transcription models by provider
 */
export const TRANSCRIPTION_MODELS: Record<string, string> = {
  openai: process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1',
  groq: process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
  deepgram: process.env.DEEPGRAM_TRANSCRIPTION_MODEL || 'nova-2',
  gemini: process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-2.5-flash',
};

/**
 * Voice/TTS models by provider
 */
export const VOICE_MODELS: Record<string, string> = {
  openai: process.env.OPENAI_TTS_MODEL || 'tts-1',
  gemini: process.env.GEMINI_VOICE_MODEL || 'gemini-2.5-flash',
};

/**
 * Vision models by provider
 */
export const VISION_MODELS: Record<string, string> = {
  openai: process.env.OPENAI_VISION_MODEL || 'gpt-4o',
  gemini: process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash',
  anthropic: process.env.ANTHROPIC_VISION_MODEL || 'claude-3-5-sonnet-latest',
};

/**
 * Get model for a provider, with fallback chain
 */
export function getModelForProvider(providerId: string, modelType: 'default' | 'transcription' | 'voice' | 'vision' = 'default'): string {
  const normalized = providerId.toLowerCase().trim();

  switch (modelType) {
    case 'transcription':
      return TRANSCRIPTION_MODELS[normalized] || TRANSCRIPTION_MODELS.openai || 'whisper-1';
    case 'voice':
      return VOICE_MODELS[normalized] || VOICE_MODELS.openai || 'tts-1';
    case 'vision':
      return VISION_MODELS[normalized] || VISION_MODELS.openai || 'gpt-4o';
    default:
      return DEFAULT_PROVIDER_MODELS[normalized] || 'auto';
  }
}

export function getLiveProviderDefaults(family: 'gemini' | 'openai' | 'anthropic') {
  return LIVE_PROVIDER_DEFAULTS[family];
}

export function getFirstClassProvidersSet(): Set<string> {
  return getFirstClassProviders();
}

export function getAnthropicRouteIdsSet(): Set<string> {
  return getAnthropicRouteIds();
}

export function getOpenAiCompatibleRouteIdsSet(): Set<string> {
  return getOpenAiCompatibleRouteIds();
}