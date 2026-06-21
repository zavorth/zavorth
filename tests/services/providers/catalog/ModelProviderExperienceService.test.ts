import { describe, it, expect } from 'vitest';
import { ModelProviderExperienceService } from '../../../../src/services/providers/catalog/ModelProviderExperienceService.js';

describe('ModelProviderExperienceService', () => {
  it('exposes a curated daily-use provider experience instead of a flat provider dump', () => {
    const service = new ModelProviderExperienceService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildExperience({ includeAdvanced: true });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.generatedAt).toBe('2026-05-13T12:00:00.000Z');
    expect(snapshot.essentialCoverage.entries.map((entry) => entry.providerId)).toEqual(expect.arrayContaining([
      'openai',
      'anthropic',
      'gemini',
      'openrouter',
      'ollama',
      'custom-openai-compatible',
    ]));
    expect(snapshot.essentialCoverage.present).toBe(snapshot.essentialCoverage.required);
    expect(snapshot.categories.map((entry) => entry.id)).toEqual([
      'fast_and_budget',
      'highest_intelligence',
      'local_private',
      'openai_compatible',
    ]);
    expect(snapshot.categories.find((entry) => entry.id === 'local_private')?.recommendedRouteIds).toEqual(expect.arrayContaining([
      'ollama',
      'custom-openai-compatible',
    ]));
    expect(snapshot.categories.find((entry) => entry.id === 'openai_compatible')?.recommendedRouteIds).toEqual(expect.arrayContaining([
      'custom-openai-compatible',
      'openrouter',
      'azure-openai',
    ]));
    expect(snapshot.fallbackPolicy).toEqual(expect.objectContaining({
      requiresPolicyBrokerForExternalUse: true,
      supportsLastKnownGoodProvider: true,
    }));
  });

  it('tracks power-user providers without making them the default user experience', () => {
    const service = new ModelProviderExperienceService();

    const snapshot = service.buildExperience({ includeAdvanced: true });

    expect(snapshot.powerUserCoverage.entries.map((entry) => entry.providerId)).toEqual(expect.arrayContaining([
      'groq',
      'mistral',
      'xai',
      'deepseek',
      'together',
      'cerebras',
      'amazon-bedrock',
      'azure-openai',
    ]));
    expect(snapshot.powerUserCoverage.present).toBe(snapshot.powerUserCoverage.tracked);
    expect(snapshot.productPromise).toContain('Use any model');
  });
});
