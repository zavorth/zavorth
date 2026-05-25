import { planProviderNativeTools } from '../../../src/services/llm/ProviderNativeToolPlanner.js';

describe('ProviderNativeToolPlanner', () => {
  it('enables Gemini native Google Search for current external knowledge', () => {
    expect(planProviderNativeTools({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      text: 'Quais sao as noticias recentes de tecnologia?',
    })).toEqual([
      expect.objectContaining({
        name: 'google_search',
        requiredEvidence: 'grounding_metadata',
      }),
    ]);
  });

  it('does not enable provider-native tools for ordinary local questions', () => {
    expect(planProviderNativeTools({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      text: 'Explique o que e uma promise em JavaScript.',
    })).toEqual([]);
  });

  it('plans generic provider web search for providers with native search contracts', () => {
    expect(planProviderNativeTools({
      providerName: 'grok',
      modelName: 'grok-4-1-fast',
      text: 'search current x.ai cli release notes',
    })).toEqual([
      expect.objectContaining({
        name: 'provider_web_search',
        requiredEvidence: 'citations',
      }),
    ]);
  });

  it('adds Gemini code execution when the task benefits from provider-native execution', () => {
    expect(planProviderNativeTools({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      text: 'Calcule e simule isso em Python',
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'code_execution' }),
    ]));
  });
});
