import type { TransportAdapter } from './transports/TransportAdapter.js';
import { OpenAITransport } from './transports/OpenAITransport.js';
import { AnthropicTransport } from './transports/AnthropicTransport.js';
import { BedrockTransport } from './transports/BedrockTransport.js';
import { CodexTransport } from './transports/CodexTransport.js';

import type { CompatLayer } from './compat/types.js';
import { registerCompat, getCompat } from './compat/Registry.js';
import { OpenAICompat } from './compat/OpenAICompat.js';
import { AnthropicCompat } from './compat/AnthropicCompat.js';
import { GoogleCompat } from './compat/GoogleCompat.js';
import { DeepSeekCompat } from './compat/DeepSeekCompat.js';

import type { ThinkingAdapter } from './thinking/types.js';
import { registerThinking, getThinking } from './thinking/Registry.js';
import { OpenAIThinking } from './thinking/OpenAIThinking.js';
import { AnthropicThinking } from './thinking/AnthropicThinking.js';
import { GoogleThinking } from './thinking/GoogleThinking.js';
import { DeepSeekThinking } from './thinking/DeepSeekThinking.js';

import type { ModelCatalog } from './catalog/types.js';
import { registerCatalog, getCatalog } from './catalog/Registry.js';
import { FetchCatalog } from './catalog/FetchCatalog.js';

import type { AuthProvider } from './auth/types.js';
import { registerAuth, getAuth } from './auth/Registry.js';
import { ApiKeyAuth } from './auth/ApiKeyAuth.js';
import { OAuthAuth } from './auth/OAuthAuth.js';
import { AwsSdkAuth } from './auth/AwsSdkAuth.js';
import { VertexAuth } from './auth/VertexAuth.js';

export interface ResolvedProvider {
  name: string;
  apiMode: string;
  authType: string;
  baseUrl: string | null;
  apiKey: string | null;
  defaultModel: string | null;
  defaultHeaders: Record<string, string>;
  transport: TransportAdapter;
  compat: CompatLayer | null;
  thinking: ThinkingAdapter | null;
  catalog: ModelCatalog | null;
  auth: AuthProvider | null;
}

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
  cerebras: 'https://api.cerebras.ai/v1',
};

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.5-flash',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  cerebras: 'llama-3.3-70b',
};

const PROVIDER_API_MODES: Record<string, string> = {
  openai: 'openai_completions',
  anthropic: 'anthropic_messages',
  google: 'openai_completions',
  deepseek: 'openai_completions',
  groq: 'openai_completions',
  together: 'openai_completions',
  cerebras: 'openai_completions',
  bedrock: 'bedrock_converse',
  codex: 'codex_responses',
};

const PROVIDER_AUTH_TYPES: Record<string, string> = {
  openai: 'api_key',
  anthropic: 'api_key',
  google: 'api_key',
  deepseek: 'api_key',
  groq: 'api_key',
  together: 'api_key',
  cerebras: 'api_key',
  bedrock: 'aws_sdk',
  vertex: 'vertex',
};

const PROVIDER_COMPAT_MAP: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  deepseek: 'deepseek',
  gemini: 'gemini',
};

const PROVIDER_THINKING_MAP: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  deepseek: 'deepseek',
};

const PROVIDER_CATALOG_MAP: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  groq: 'groq',
  deepseek: 'deepseek',
  together: 'together',
  cerebras: 'cerebras',
};

const transports = new Map<string, () => TransportAdapter>();

function registerTransport(apiMode: string, factory: () => TransportAdapter): void {
  transports.set(apiMode, factory);
}

export class ProviderBootstrap {
  private static initialized = false;

  static initialize(): void {
    if (ProviderBootstrap.initialized) return;

    registerCompat('openai', OpenAICompat);
    registerCompat('anthropic', AnthropicCompat);
    registerCompat('google', GoogleCompat);
    registerCompat('deepseek', DeepSeekCompat);
    registerCompat('gemini', GoogleCompat);

    registerAuth('api_key', new ApiKeyAuth('API_KEY'));
    registerAuth('oauth', new OAuthAuth('OAUTH_TOKEN'));
    registerAuth('aws_sdk', new AwsSdkAuth());
    registerAuth('vertex', new VertexAuth('', ''));

    registerThinking('openai', new OpenAIThinking());
    registerThinking('anthropic', new AnthropicThinking());
    registerThinking('google', new GoogleThinking());
    registerThinking('deepseek', new DeepSeekThinking());

    registerCatalog('openai', new FetchCatalog('openai', []));
    registerCatalog('anthropic', new FetchCatalog('anthropic', []));
    registerCatalog('google', new FetchCatalog('google', []));
    registerCatalog('groq', new FetchCatalog('groq', []));
    registerCatalog('deepseek', new FetchCatalog('deepseek', []));
    registerCatalog('together', new FetchCatalog('together', []));
    registerCatalog('cerebras', new FetchCatalog('cerebras', []));

    registerTransport('openai_completions', () => {
      const keys = resolveEnvKeys('OPENAI_API_KEY');
      return new OpenAITransport(keys, 'gpt-4o');
    });
    registerTransport('anthropic_messages', () => {
      const keys = resolveEnvKeys('ANTHROPIC_API_KEY');
      return new AnthropicTransport(keys, 'claude-sonnet-4-20250514');
    });
    registerTransport('bedrock_converse', () => {
      const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
      return new BedrockTransport(region, accessKeyId, secretAccessKey, 'anthropic.claude-sonnet-4-20250514');
    });
    registerTransport('codex_responses', () => {
      const keys = resolveEnvKeys('OPENAI_API_KEY');
      return new CodexTransport(keys, 'o3');
    });

    ProviderBootstrap.initialized = true;
  }

  static getTransport(apiMode: string): TransportAdapter | undefined {
    const factory = transports.get(apiMode);
    if (!factory) return undefined;
    return factory();
  }

  static getCompat(providerId: string): CompatLayer | undefined {
    return getCompat(providerId);
  }

  static getThinking(providerId: string): ThinkingAdapter | undefined {
    return getThinking(providerId);
  }

  static getCatalog(providerId: string): ModelCatalog | undefined {
    return getCatalog(providerId);
  }

  static getAuth(authType: string): AuthProvider | undefined {
    return getAuth(authType);
  }

  static resolveProvider(name: string): ResolvedProvider {
    const normalized = String(name || '').trim().toLowerCase();
    if (!ProviderBootstrap.initialized) {
      ProviderBootstrap.initialize();
    }

    const apiMode = PROVIDER_API_MODES[normalized] || 'openai_completions';
    const authType = PROVIDER_AUTH_TYPES[normalized] || 'api_key';
    const compatKey = PROVIDER_COMPAT_MAP[normalized] || null;
    const thinkingKey = PROVIDER_THINKING_MAP[normalized] || null;
    const catalogKey = PROVIDER_CATALOG_MAP[normalized] || null;

    const transport = ProviderBootstrap.getTransport(apiMode);
    if (!transport) {
      throw new Error(`No transport registered for apiMode "${apiMode}"`);
    }

    const compat = compatKey ? ProviderBootstrap.getCompat(compatKey) || null : null;
    const thinking = thinkingKey ? ProviderBootstrap.getThinking(thinkingKey) || null : null;
    const catalog = catalogKey ? ProviderBootstrap.getCatalog(catalogKey) || null : null;
    const auth = ProviderBootstrap.getAuth(authType) || null;

    const envPrefix = normalized.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const baseUrl = resolveBaseUrl(normalized, envPrefix);
    const apiKey = resolveApiKey(normalized, envPrefix, authType);
    const defaultModel = DEFAULT_MODELS[normalized] || null;
    const defaultHeaders: Record<string, string> = {};

    if (normalized === 'anthropic') {
      defaultHeaders['anthropic-version'] = process.env.ANTHROPIC_VERSION || '2023-06-01';
    }

    return {
      name: normalized,
      apiMode,
      authType,
      baseUrl,
      apiKey,
      defaultModel,
      defaultHeaders,
      transport,
      compat,
      thinking,
      catalog,
      auth,
    };
  }
}

function resolveEnvKeys(envKey: string): string[] {
  const value = process.env[envKey];
  if (!value) return [];
  return value.split(',').map((k) => k.trim()).filter(Boolean);
}

function resolveBaseUrl(name: string, envPrefix: string): string | null {
  const envUrl = process.env[`${envPrefix}_BASE_URL`];
  if (envUrl) return envUrl;
  return DEFAULT_BASE_URLS[name] || null;
}

function resolveApiKey(name: string, envPrefix: string, authType: string): string | null {
  if (authType === 'aws_sdk' || authType === 'vertex') return null;
  const envKey = process.env[`${envPrefix}_API_KEY`];
  if (envKey) return envKey;
  const fallbackKeys: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_AI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    groq: 'GROQ_API_KEY',
    together: 'TOGETHER_API_KEY',
    cerebras: 'CEREBRAS_API_KEY',
  };
  const fallback = fallbackKeys[name];
  return fallback ? process.env[fallback] || null : null;
}
