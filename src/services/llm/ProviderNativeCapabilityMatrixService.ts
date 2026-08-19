import type { ProviderNativeToolRequest } from '../../providers/ILlmProvider.js';
import { findCatalogProvider } from '../providers/catalog/UniversalProviderCatalog.js';
import {
  PROVIDER_NATIVE_CAPABILITY_MATRIX_VERSION,
  type ProviderNativeCapability,
  type ProviderNativeCapabilityDecision,
  type ProviderNativeCapabilityEntry,
  type ProviderNativeCapabilityPolicy,
  type ProviderNativeFallbackAssessment,
} from '../../contracts/provider/ProviderNativeCapabilityContract.js';

const PROVIDER_FAMILY_ALIASES: Record<string, string> = {
  google: 'gemini',
  'google-genai': 'gemini',
  'gemini-interactions': 'gemini',
  'claude-agent-sdk': 'anthropic',
  'x.ai': 'grok',
  moonshot: 'kimi',
};

const SAFE_PUBLIC_SEARCH_POLICY: ProviderNativeCapabilityPolicy = {
  risk: 'safe_observation',
  approvalRequired: false,
  receiptRequired: true,
  allowWithoutApproval: true,
  outputTrust: 'verified_public_observation',
};

const GOVERNED_PROVIDER_OUTPUT_POLICY: ProviderNativeCapabilityPolicy = {
  risk: 'governed_observation',
  approvalRequired: false,
  receiptRequired: true,
  allowWithoutApproval: true,
  outputTrust: 'untrusted_provider_output',
};

const APPROVAL_REQUIRED_POLICY: ProviderNativeCapabilityPolicy = {
  risk: 'approval_required',
  approvalRequired: true,
  receiptRequired: true,
  allowWithoutApproval: false,
  outputTrust: 'local_governed_artifact',
};

const UNSUPPORTED_POLICY: ProviderNativeCapabilityPolicy = {
  risk: 'unsupported',
  approvalRequired: false,
  receiptRequired: false,
  allowWithoutApproval: false,
  outputTrust: 'untrusted_provider_output',
};

export class ProviderNativeCapabilityMatrixService {
  public resolve(input: {
    providerName?: string | null;
    modelName?: string | null;
    capability: ProviderNativeCapability;
  }): ProviderNativeCapabilityDecision {
    const providerName = normalize(input.providerName);
    const providerFamily = this.resolveProviderFamily(providerName);
    const entry = this.resolveEntry(providerFamily, input.capability);
    return {
      ...entry,
      providerName: providerName || 'unknown',
      modelName: normalize(input.modelName) || null,
    };
  }

  public plan(input: {
    providerName?: string | null;
    modelName?: string | null;
    capabilities: ProviderNativeCapability[];
    reason: string;
  }): ProviderNativeToolRequest[] {
    return input.capabilities
      .map((capability) => this.resolve({
        providerName: input.providerName,
        modelName: input.modelName,
        capability,
      }))
      .filter((decision) => decision.status === 'native_enabled' && decision.providerToolName)
      .map((decision) => ({
        name: decision.providerToolName!,
        reason: input.reason || decision.notes[0] || `Provider-native ${decision.capability}.`,
        requiredEvidence: decision.requiredEvidence === 'grounding_metadata'
          ? 'grounding_metadata'
          : decision.requiredEvidence === 'citations'
            ? 'citations'
            : 'none',
      }));
  }

  public assessFallback(input: {
    providerName?: string | null;
    modelName?: string | null;
    metadata?: Record<string, unknown> | null;
    content?: string | null;
  }): ProviderNativeFallbackAssessment[] {
    const nativeTools = record(input.metadata?.providerNativeTools);
    const requested = collectRequestedNativeToolNames(nativeTools);
    const activated = collectStringList(nativeTools.activated);
    const assessments: ProviderNativeFallbackAssessment[] = [];

    if (requested.has('google_search') || activated.has('google_search') || record(nativeTools.googleSearch).used === true) {
      assessments.push(this.assessSearch({
        providerName: input.providerName,
        modelName: input.modelName,
        providerToolName: 'google_search',
        metadata: input.metadata,
        content: input.content,
      }));
    }

    if (requested.has('provider_web_search') || activated.has('provider_web_search')) {
      assessments.push(this.assessSearch({
        providerName: input.providerName,
        modelName: input.modelName,
        providerToolName: 'provider_web_search',
        metadata: input.metadata,
        content: input.content,
      }));
    }

    return assessments;
  }

  public summarizeMetadata(input: {
    providerName?: string | null;
    modelName?: string | null;
    metadata?: Record<string, unknown> | null;
    content?: string | null;
  }): Record<string, unknown> {
    const assessments = this.assessFallback(input);
    const nativeTokenStreaming = record(input.metadata).providerNativeTokenStreaming === true
      ? this.resolve({
        providerName: input.providerName,
        modelName: input.modelName,
        capability: 'native_token_streaming',
      })
      : null;
    return {
      version: PROVIDER_NATIVE_CAPABILITY_MATRIX_VERSION,
      assessments,
      ...(nativeTokenStreaming ? { nativeTokenStreaming } : {}),
      fallbackRecommended: assessments.some((assessment) => assessment.fallbackRecommended),
    };
  }

  private assessSearch(input: {
    providerName?: string | null;
    modelName?: string | null;
    providerToolName: 'google_search' | 'provider_web_search';
    metadata?: Record<string, unknown> | null;
    content?: string | null;
  }): ProviderNativeFallbackAssessment {
    const decision = this.resolve({
      providerName: input.providerName,
      modelName: input.modelName,
      capability: 'native_search',
    });
    const citationCount = countProviderCitations(input.metadata);
    const contentHasSourceUrl = /https?:\/\/\S+/iu.test(String(input.content || ''));
    const evidenceSatisfied = citationCount > 0 || contentHasSourceUrl;
    return {
      capability: 'native_search',
      providerToolName: input.providerToolName,
      fallbackToolName: decision.fallbackToolName,
      fallbackRecommended: decision.status === 'native_enabled'
        && Boolean(decision.fallbackToolName)
        && !evidenceSatisfied,
      reason: evidenceSatisfied ? 'Provider-native search returned verifiable citation evidence.'
        : 'Provider-native search did not return verifiable citations or source URLs.',
      evidenceSatisfied,
      citationCount,
      policy: decision.policy,
    };
  }

  private resolveEntry(providerFamily: string, capability: ProviderNativeCapability): ProviderNativeCapabilityEntry {
    if (capability === 'native_token_streaming') {
      if (['gemini', 'openai', 'openrouter', 'anthropic', 'aigateway'].includes(providerFamily)) {
        return entry(providerFamily, capability, 'native_enabled', null, null, 'none', GOVERNED_PROVIDER_OUTPUT_POLICY, [
          'This adapter can forward provider-native response deltas before the final model response is complete.',
          'Streamed text remains untrusted provider output until Zavorth finalizes the governed run.',
        ]);
      }
      return entry(providerFamily, capability, 'unsupported', null, null, 'none', UNSUPPORTED_POLICY, [
        'No provider-native token streaming adapter is registered for this provider family yet.',
      ]);
    }

    if (providerFamily === 'gemini') {
      if (capability === 'native_search') {
        return entry(providerFamily, capability, 'native_enabled', 'google_search', 'web_search', 'grounding_metadata', SAFE_PUBLIC_SEARCH_POLICY, [
          'Gemini can use provider-native Google Search/Grounding when enabled in the request.',
          'Zavorth requires grounding metadata, citations or source URLs before treating it as verified web evidence.',
        ]);
      }
      if (capability === 'native_code_execution') {
        return entry(providerFamily, capability, 'native_enabled', 'code_execution', 'run_sandbox_code', 'execution_result', GOVERNED_PROVIDER_OUTPUT_POLICY, [
          'Gemini code execution is provider-native and stays separate from host shell execution.',
          'Local or persistent code effects still require Zavorth sandbox/effect boundary.',
        ]);
      }
      if (capability === 'native_vision' || capability === 'native_audio' || capability === 'native_media_generation') {
        return entry(providerFamily, capability, 'native_enabled', capability === 'native_media_generation' ? 'provider_media_generation' : capability === 'native_audio' ? 'provider_audio' : 'provider_vision', null, 'none', GOVERNED_PROVIDER_OUTPUT_POLICY, [
          'Gemini multimodal input/output can be used through provider payload support when configured by the caller.',
        ]);
      }
    }

    if (['grok', 'xai', 'kimi', 'moonshot', 'perplexity'].includes(providerFamily)) {
      if (capability === 'native_search') {
        return entry(providerFamily, capability, 'native_enabled', 'provider_web_search', 'web_search', 'citations', SAFE_PUBLIC_SEARCH_POLICY, [
          'Provider supports a native web/search mode when enabled by the adapter.',
          'Zavorth falls back to governed web_search if citations are not returned.',
        ]);
      }
    }

    if (['openrouter', 'minimax'].includes(providerFamily)) {
      if (capability === 'native_search') {
        return entry(providerFamily, capability, 'zavorth_fallback', null, 'web_search', 'citations', SAFE_PUBLIC_SEARCH_POLICY, [
          'Provider routes may expose native search per model, but this adapter does not claim universal native search.',
          'Zavorth uses governed web_search until route-specific proof exists.',
        ]);
      }
    }

    if (['openai', 'anthropic', 'deepseek', 'groq', 'mistral', 'cohere', 'sambanova', 'together', 'cerebras', 'huggingface'].includes(providerFamily)) {
      if (capability === 'native_search') {
        return entry(providerFamily, capability, 'zavorth_fallback', null, 'web_search', 'citations', SAFE_PUBLIC_SEARCH_POLICY, [
          'This chat adapter does not enable provider-native search directly.',
          'Zavorth can still provide governed public web search through its own tool runtime.',
        ]);
      }
    }

    if (capability === 'native_code_execution' || capability === 'native_browser' || capability === 'native_connector') {
      return entry(providerFamily, capability, 'unsupported', null, capability === 'native_code_execution' ? 'run_sandbox_code' : null, capability === 'native_code_execution' ? 'execution_result' : 'none', capability === 'native_code_execution' ? APPROVAL_REQUIRED_POLICY : UNSUPPORTED_POLICY, [
        'No provider-native adapter is registered for this capability yet.',
      ]);
    }

    return entry(providerFamily, capability, 'unsupported', null, null, 'none', UNSUPPORTED_POLICY, [
      'No provider-native adapter is registered for this capability yet.',
    ]);
  }

  private resolveProviderFamily(providerName: string): string {
    const normalized = normalize(providerName);
    if (!normalized) return 'unknown';
    const catalogEntry = findCatalogProvider(normalized);
    if (catalogEntry) {
      return catalogEntry.id;
    }
    return PROVIDER_FAMILY_ALIASES[normalized] || normalized;
  }
}

function entry(
  providerFamily: string,
  capability: ProviderNativeCapability,
  status: ProviderNativeCapabilityEntry['status'],
  providerToolName: ProviderNativeCapabilityEntry['providerToolName'],
  fallbackToolName: string | null,
  requiredEvidence: ProviderNativeCapabilityEntry['requiredEvidence'],
  policy: ProviderNativeCapabilityPolicy,
  notes: string[],
): ProviderNativeCapabilityEntry {
  return {
    version: PROVIDER_NATIVE_CAPABILITY_MATRIX_VERSION,
    providerFamily,
    capability,
    status,
    providerToolName,
    fallbackToolName,
    requiredEvidence,
    policy,
    notes,
  };
}

function countProviderCitations(metadata: Record<string, unknown> | null | undefined): number {
  const nativeTools = record(metadata?.providerNativeTools);
  const googleSearch = record(nativeTools.googleSearch);
  const citationCount = Number(googleSearch.citationCount || 0);
  if (Number.isFinite(citationCount) && citationCount > 0) {
    return citationCount;
  }
  const citations = Array.isArray(googleSearch.citations) ? googleSearch.citations : [];
  if (citations.length > 0) {
    return citations.length;
  }
  const genericCitations = Array.isArray(nativeTools.citations) ? nativeTools.citations : [];
  return genericCitations.length;
}

function collectRequestedNativeToolNames(value: Record<string, unknown>): Set<string> {
  const requested = value.requested;
  if (!Array.isArray(requested)) {
    return new Set();
  }
  return new Set(requested
    .map((item) => typeof item === 'string' ? item : record(item).name)
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0));
}

function collectStringList(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    return new Set();
  }
  return new Set(value.map((item) => String(item || '').trim()).filter(Boolean));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}
