import { buildOpenAiCompatibleNativeToolPayload } from '../../src/providers/ProviderNativeToolPayload.js';

describe('ProviderNativeToolPayload', () => {
  it('activates xAI/Grok native search parameters without dropping Zavorth function tools', () => {
    const payload = buildOpenAiCompatibleNativeToolPayload({
      providerName: 'grok',
      tools: [{
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object', properties: {}, required: [] },
      }],
      options: {
        providerNativeTools: [{
          name: 'provider_web_search',
          reason: 'current facts',
          requiredEvidence: 'citations',
        }],
      },
    });

    expect(payload.tools).toEqual([
      expect.objectContaining({
        type: 'function',
        function: expect.objectContaining({ name: 'web_search' }),
      }),
    ]);
    expect(payload.extraBody).toEqual({
      search_parameters: { mode: 'auto' },
    });
    expect(payload.metadata.providerNativeTools).toEqual(expect.objectContaining({
      activated: ['provider_web_search'],
      unsupported: [],
    }));
  });

  it('activates Kimi native web search tool alongside Zavorth function tools', () => {
    const payload = buildOpenAiCompatibleNativeToolPayload({
      providerName: 'kimi',
      tools: [{
        name: 'get_datetime',
        description: 'Time',
        parameters: { type: 'object', properties: {}, required: [] },
      }],
      options: {
        providerNativeTools: [{
          name: 'provider_web_search',
          reason: 'current facts',
          requiredEvidence: 'citations',
        }],
      },
    });

    expect(payload.tools).toEqual([
      expect.objectContaining({
        type: 'function',
        function: expect.objectContaining({ name: 'get_datetime' }),
      }),
      {
        type: 'builtin_function',
        function: { name: '$web_search' },
      },
    ]);
  });

  it('marks unsupported native tools instead of pretending activation', () => {
    const payload = buildOpenAiCompatibleNativeToolPayload({
      providerName: 'openai',
      options: {
        providerNativeTools: [{
          name: 'provider_web_search',
          reason: 'current facts',
          requiredEvidence: 'citations',
        }],
      },
    });

    expect(payload.tools).toBeUndefined();
    expect(payload.extraBody).toEqual({});
    expect(payload.metadata.providerNativeTools).toEqual(expect.objectContaining({
      activated: [],
      unsupported: ['provider_web_search'],
    }));
  });
});
