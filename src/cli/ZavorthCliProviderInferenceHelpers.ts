import {
  readFlag,
  idWithTime,
  getEnv
} from './ZavorthCliSharedHelpers.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';


type JsonObject = Record<string, unknown>;

export function getFirstEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  return undefined;
}

export function envPrefix(value: string): string {
  return value.replace(/[^a-z0-9]+/giu, '_').replace(/^_+|_+$/gu, '').toUpperCase() || 'CHANNEL';
}

export function isProviderConfigured(provider: string): boolean {
  const normalized = provider.toLowerCase();
  if (normalized === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  if (normalized === 'openrouter') return Boolean(process.env.OPENROUTER_API_KEY);
  if (normalized === 'groq') return Boolean(process.env.GROQ_API_KEY);
  if (normalized === 'deepseek') return Boolean(process.env.DEEPSEEK_API_KEY);
  if (normalized === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
  if (normalized === 'ollama') return Boolean(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL);
  return false;
}

export async function inferText(provider: string, prompt: string, args: string[]): Promise<JsonObject> {
  if (!prompt.trim()) return { ok: false, reason: 'empty-prompt' };
  try {
    if (provider === 'ollama') {
      const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/u, '');
      const model = readFlag(args, 'model') || process.env.OLLAMA_MODEL || 'llama3.1';
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
      });
      const data = await response.json() as JsonObject;
      return { ok: response.ok, status: response.status, provider, model, text: data.response || data.error || '' };
    }
    if (provider === 'gemini') {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return { ok: false, reason: 'missing-gemini-api-key' };
      const model = readFlag(args, 'model') || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent...key=${key}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await response.json() as JsonObject;
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const first = (candidates[0] || {}) as JsonObject;
      const content = (first.content || {}) as JsonObject;
      const parts = Array.isArray(content.parts) ? content.parts : [];
      return { ok: response.ok, status: response.status, provider, model, text: String((parts[0] as JsonObject | undefined)?.text || data.error || '') };
    }
    const openAiLike = resolveOpenAiLikeProvider(provider, args);
    if (!openAiLike.apiKey) return { ok: false, reason: `missing-${provider}-api-key` };
    const response = await fetch(`${openAiLike.baseUrl.replace(/\/$/u, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${openAiLike.apiKey}`,
      },
      body: JSON.stringify({ model: openAiLike.model, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await response.json() as JsonObject;
    const choices = Array.isArray(data.choices) ? data.choices : [];
    const message = ((choices[0] as JsonObject | undefined)?.message || {}) as JsonObject;
    return { ok: response.ok, status: response.status, provider, model: openAiLike.model, text: String(message.content || data.error || '') };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[Zavorth Cli Live Namespaces] filesystem check failed', error);
    return { ok: false, reason: error instanceof Error ? err.message : String(error) };
  }
}

export function resolveOpenAiLikeProvider(provider: string, args: string[]): { baseUrl: string; apiKey?: string; model: string } {
  if (provider === 'openrouter') {
    return {
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: readFlag(args, 'model') || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    };
  }
  if (provider === 'groq') {
    return {
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      model: readFlag(args, 'model') || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    };
  }
  if (provider === 'deepseek') {
    return {
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: readFlag(args, 'model') || process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    };
  }
  return {
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: readFlag(args, 'model') || process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };
}

export function idFromSpec(spec: string): string {
  return spec.replace(/[^a-z0-9._-]+/giu, '-').replace(/^-+|-+$/gu, '').toLowerCase() || idWithTime('plugin');
}

export function resolveNpmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

export async function postJson(url: string, body: unknown): Promise<JsonObject> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: response.ok, status: response.status };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[Zavorth Cli Live Namespaces] network request failed', error);
    return { ok: false, reason: error instanceof Error ? err.message : String(error) };
  }
}
