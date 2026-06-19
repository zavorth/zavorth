import { describe, it, expect } from 'vitest';
import { CustomCompatibleProviderOnboardingService } from '../../../../src/services/providers/catalog/CustomCompatibleProviderOnboardingService.js';

describe('CustomCompatibleProviderOnboardingService', () => {
  it('creates a declared OpenAI-compatible manifest for long-tail vendors', () => {
    const result = new CustomCompatibleProviderOnboardingService().createDraft({
      id: 'acme-ai',
      label: 'Acme AI',
      compatibility: 'openai_compatible',
      authKind: 'api_key',
      baseUrl: 'https://api.acme.example/v1',
      modelId: 'acme-chat-latest',
    });

    expect(result.manifest).toEqual(expect.objectContaining({
      id: 'acme-ai',
      routeKind: 'custom_compatible',
      authKind: 'api_key',
    }));
    expect(result.manifest.routes[0]).toEqual(expect.objectContaining({
      providerName: 'acme-ai',
      catalogSource: 'custom_model',
      credentialRefs: expect.arrayContaining(['ACME_AI_BASE_URL', 'ACME_AI_API_KEY']),
    }));
    expect(result.classification).toEqual(expect.objectContaining({
      kind: 'openai_compatible',
      runtimeSupported: true,
    }));
    expect(result.explanation.join(' ')).toContain('authKind');
  });

  it('refuses endpoints without explicit auth kind and compatibility', () => {
    expect(() => new CustomCompatibleProviderOnboardingService().createDraft({
      id: 'unsafe',
      label: 'Unsafe',
      compatibility: '' as any,
      authKind: '' as any,
      baseUrl: 'https://unsafe.example/v1',
    })).toThrow(/compatibility/i);
  });

  it('keeps Anthropic-compatible onboarding honest about runtime support', () => {
    const result = new CustomCompatibleProviderOnboardingService().createDraft({
      id: 'claude-compatible',
      label: 'Claude Compatible',
      compatibility: 'anthropic_compatible',
      authKind: 'api_key',
      baseUrl: 'https://api.anthropic-compatible.example',
      modelId: 'claude-like',
    });

    expect(result.classification).toEqual(expect.objectContaining({
      kind: 'anthropic_compatible',
      runtimeSupported: true,
      runtimeAdapter: 'anthropic_compatible',
    }));
    // The warning "adapter generico" was removed because anthropic_compatible is now natively supported.
    expect(result.warnings.join(' ')).toContain('Base URL precisa permanecer');
  });
});
