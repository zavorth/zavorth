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
  const explicit = normalize(metadata.providerNativeTools);
  const shouldUseExternalKnowledge = explicit === 'on'
    || explicit === 'true'
    || explicit === 'enabled'
    || Boolean(metadata.enableProviderNativeTools)
    || requestLikelyNeedsExternalKnowledge(text);

  if (!shouldUseExternalKnowledge) {
    if (
      (provider === 'gemini' || provider === 'google-genai' || provider === 'gemini-interactions')
      && requestLikelyBenefitsFromCodeExecution(text)
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
    const capabilities: Array<'native_search' | 'native_code_execution'> = ['native_search'];
    if (requestLikelyBenefitsFromCodeExecution(text)) {
      capabilities.push('native_code_execution');
    }
    return matrix.plan({
      providerName: input.providerName,
      modelName: input.modelName,
      capabilities,
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
