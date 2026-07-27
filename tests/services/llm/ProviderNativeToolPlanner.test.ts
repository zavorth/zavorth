import { planProviderNativeTools } from '../../../src/services/llm/ProviderNativeToolPlanner.js';

describe('ProviderNativeToolPlanner', () => {
  it('does not enable Gemini native Google Search from free-text news keywords', () => {
    expect(
      planProviderNativeTools({
        providerName: 'gemini',
        modelName: 'gemini-2.5-flash',
        text: 'Quais sao as noticias recentes de tecnologia-',
      }),
    ).toEqual([]);
  });

  it('enables Gemini native Google Search from structured enableWebTools flag', () => {
    expect(
      planProviderNativeTools({
        providerName: 'gemini',
        modelName: 'gemini-2.5-flash',
        text: 'Quais sao as noticias recentes de tecnologia-',
        metadata: { enableWebTools: true },
      }),
    ).toEqual([
      expect.objectContaining({
        name: 'google_search',
        requiredEvidence: 'grounding_metadata',
      }),
    ]);
  });

  it('does not enable provider-native tools for ordinary local questions', () => {
    expect(
      planProviderNativeTools({
        providerName: 'gemini',
        modelName: 'gemini-2.5-flash',
        text: 'Explique o que e uma promise em JavaScript.',
      }),
    ).toEqual([]);
  });

  it('plans generic provider web search for structured native preference', () => {
    expect(
      planProviderNativeTools({
        providerName: 'grok',
        modelName: 'grok-4-1-fast',
        text: 'search current x.ai cli release notes',
        metadata: {
          providerNativeTools: { mode: 'enabled' },
        },
      }),
    ).toEqual([
      expect.objectContaining({
        name: 'provider_web_search',
        requiredEvidence: 'citations',
      }),
    ]);
  });

  it('does not add Gemini code execution from free-text calculate keywords', () => {
    expect(
      planProviderNativeTools({
        providerName: 'gemini',
        modelName: 'gemini-2.5-flash',
        text: 'Calcule e simule isso em Python',
      }),
    ).toEqual([]);
  });

  it('adds Gemini code execution when structured enableCodeExecution is set', () => {
    expect(
      planProviderNativeTools({
        providerName: 'gemini',
        modelName: 'gemini-2.5-flash',
        text: 'Calcule e simule isso em Python',
        metadata: { enableCodeExecution: true },
      }),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'code_execution' })]));
  });
});
