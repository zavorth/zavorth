import type { ProviderNativeToolRequest } from '../../providers/ILlmProvider.js';
import { ProviderNativeCapabilityMatrixService } from './ProviderNativeCapabilityMatrixService.js';

export type ProviderNativeToolPlanInput = {
  providerName?: string | null;
  modelName?: string | null;
  text: string;
  metadata?: Record<string, unknown>;
};

export function planProviderNativeTools(input: ProviderNativeToolPlanInput): ProviderNativeToolRequest[] {
  const matrix = new ProviderNativeCapabilityMatrixService();
  const provider = normalize(input.providerName);
  const text = normalize(input.text);
  const metadata = input.metadata || {};
  const nativePreference = resolveNativeToolPreference(metadata.providerNativeTools);
  const explicit = nativePreference.mode;
  const wantsSearch = nativePreference.requested.some(isSearchNativeToolName);
  const wantsCodeExecution = nativePreference.requested.some(isCodeExecutionNativeToolName);
  const shouldUseExternalKnowledge = wantsSearch
    || explicit === 'on'
    || explicit === 'true'
    || explicit === 'enabled'
    || Boolean(metadata.enableProviderNativeTools)
    || requestLikelyNeedsExternalKnowledge(text);
  const shouldUseCodeExecution = wantsCodeExecution || requestLikelyBenefitsFromCodeExecution(text);

  if (!shouldUseExternalKnowledge) {
    if (
      (provider === 'gemini' || provider === 'google-genai' || provider === 'gemini-interactions')
      && shouldUseCodeExecution
    ) {
      return matrix.plan({
        providerName: input.providerName,
        modelName: input.modelName,
        capabilities: ['native_code_execution'],
        reason: 'The request may benefit from provider-native sandboxed calculation or code execution.',
      });
    }
    return [];
  }

  if (provider === 'gemini' || provider === 'google-genai' || provider === 'gemini-interactions') {
    const capabilities: Array<'native_search' | 'native_code_execution'> = [];
    if (shouldUseExternalKnowledge) {
      capabilities.push('native_search');
    }
    if (shouldUseCodeExecution) {
      capabilities.push('native_code_execution');
    }
    if (capabilities.length === 0) return [];
    return matrix.plan({
      providerName: input.providerName,
      modelName: input.modelName,
      capabilities: uniqueCapabilities(capabilities),
      reason: 'The request benefits from provider-native capabilities before Zavorth fallback tools.',
    });
  }

  if (['grok', 'xai', 'kimi', 'moonshot', 'perplexity', 'minimax', 'openrouter'].includes(provider)) {
    return matrix.plan({
      providerName: input.providerName,
      modelName: input.modelName,
      capabilities: ['native_search'],
      reason: 'The request benefits from provider-native web/search when this adapter can prove it.',
    });
  }

  return [];
}

export function requestLikelyNeedsExternalKnowledge(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) {
    return false;
  }
  return /\b(today|latest|recent|current|now|news|search|browse|web|internet|source|sources|link|links|price|weather|release|version|changelog|who won|where can i find)\b/.test(normalized)
    || /\b(hoje|agora|atual|atuais|recente|recentes|ultim[ao]s?|noticia|noticias|pesquis|busc|internet|web|fonte|fontes|link|links|preco|cotacao|clima|tempo|lancamento|versao)\b/.test(normalized);
}

export function requestLikelyBenefitsFromCodeExecution(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) {
    return false;
  }
  return /\b(calculate|compute|simulate|run code|execute code|python|plot|solve numerically|benchmark)\b/.test(normalized)
    || /\b(calcule|calcular|computar|simular|rode codigo|executar codigo|python|grafico|resolver numericamente|benchmark)\b/.test(normalized);
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function resolveNativeToolPreference(value: unknown): { mode: string; requested: string[] } {
  if (Array.isArray(value)) {
    return {
      mode: '',
      requested: value
        .flatMap((entry) => {
          if (typeof entry === 'string') return [entry];
          const record = recordOrNull(entry);
          return record ? [record.name, record.id, record.capability] : [];
        })
        .map(normalize)
        .filter(Boolean),
    };
  }

  const record = recordOrNull(value);
  if (record) {
    return {
      mode: normalize(record.mode || record.status || (record.enabled === true ? 'enabled' : '')),
      requested: uniqueStrings([
        ...normalizeStringList(record.requested),
        ...normalizeStringList(record.preferred),
        ...normalizeStringList(record.enabled),
        ...normalizeStringList(record.activated),
      ]),
    };
  }

  return {
    mode: normalize(value),
    requested: [],
  };
}

function isSearchNativeToolName(value: string): boolean {
  const normalized = normalize(value);
  return [
    'google_search',
    'provider_web_search',
    'native_search',
    'web_search',
    'search',
  ].includes(normalized);
}

function isCodeExecutionNativeToolName(value: string): boolean {
  const normalized = normalize(value);
  return [
    'code_execution',
    'provider_code_execution',
    'native_code_execution',
    'run_sandbox_code',
    'sandbox.execute',
  ].includes(normalized);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalize(entry)).filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => normalize(entry)).filter(Boolean)));
}

function uniqueCapabilities<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
