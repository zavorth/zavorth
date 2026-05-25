import { ProviderNativeCapabilityMatrixService } from '../../../src/services/llm/ProviderNativeCapabilityMatrixService.js';

describe('ProviderNativeCapabilityMatrixService', () => {
  it('marks Gemini search as native with governed Zavorth fallback and citation evidence', () => {
    const matrix = new ProviderNativeCapabilityMatrixService();

    expect(matrix.resolve({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      capability: 'native_search',
    })).toEqual(expect.objectContaining({
      status: 'native_enabled',
      providerToolName: 'google_search',
      fallbackToolName: 'web_search',
      requiredEvidence: 'grounding_metadata',
      policy: expect.objectContaining({
        risk: 'safe_observation',
        allowWithoutApproval: true,
        receiptRequired: true,
      }),
    }));
  });

  it('does not pretend OpenAI chat completions have native search in this adapter', () => {
    const matrix = new ProviderNativeCapabilityMatrixService();

    expect(matrix.resolve({
      providerName: 'openai',
      modelName: 'gpt-4.1',
      capability: 'native_search',
    })).toEqual(expect.objectContaining({
      status: 'zavorth_fallback',
      providerToolName: null,
      fallbackToolName: 'web_search',
    }));
  });

  it('requires fallback when provider-native search returns no citations or source URLs', () => {
    const matrix = new ProviderNativeCapabilityMatrixService();

    expect(matrix.assessFallback({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      content: 'Recent news summary without links.',
      metadata: {
        providerNativeTools: {
          requested: [{ name: 'google_search' }],
          activated: ['google_search'],
          googleSearch: { used: true, citationCount: 0, citations: [] },
        },
      },
    })).toEqual([
      expect.objectContaining({
        capability: 'native_search',
        fallbackRecommended: true,
        evidenceSatisfied: false,
        fallbackToolName: 'web_search',
      }),
    ]);
  });

  it('treats citations as verified evidence and does not recommend fallback', () => {
    const matrix = new ProviderNativeCapabilityMatrixService();

    expect(matrix.assessFallback({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      content: 'Recent news summary.',
      metadata: {
        providerNativeTools: {
          requested: [{ name: 'google_search' }],
          activated: ['google_search'],
          googleSearch: {
            used: true,
            citationCount: 1,
            citations: [{ title: 'Source', url: 'https://example.com' }],
          },
        },
      },
    })).toEqual([
      expect.objectContaining({
        fallbackRecommended: false,
        evidenceSatisfied: true,
        citationCount: 1,
      }),
    ]);
  });

  it('keeps provider-native code execution governed and receipt-backed', () => {
    const matrix = new ProviderNativeCapabilityMatrixService();

    expect(matrix.resolve({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      capability: 'native_code_execution',
    })).toEqual(expect.objectContaining({
      status: 'native_enabled',
      providerToolName: 'code_execution',
      requiredEvidence: 'execution_result',
      policy: expect.objectContaining({
        risk: 'governed_observation',
        receiptRequired: true,
      }),
    }));
  });

  it('tracks vision and audio as governed provider-native capabilities when supported', () => {
    const matrix = new ProviderNativeCapabilityMatrixService();

    expect(matrix.resolve({
      providerName: 'google-genai',
      modelName: 'gemini-2.5-flash',
      capability: 'native_vision',
    })).toEqual(expect.objectContaining({
      status: 'native_enabled',
      providerToolName: 'provider_vision',
      policy: expect.objectContaining({
        risk: 'governed_observation',
        receiptRequired: true,
      }),
    }));

    expect(matrix.resolve({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      capability: 'native_audio',
    })).toEqual(expect.objectContaining({
      status: 'native_enabled',
      providerToolName: 'provider_audio',
      policy: expect.objectContaining({
        risk: 'governed_observation',
      }),
    }));
  });
});
