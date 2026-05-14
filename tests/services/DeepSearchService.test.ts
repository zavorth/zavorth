jest.mock('duck-duck-scrape', () => ({
  search: jest.fn(),
  SafeSearchType: { OFF: 'off' },
}));

import { search } from 'duck-duck-scrape';
import { DeepSearchService } from '../../src/services/DeepSearchService';
import { config } from '../../src/config/index';

describe('DeepSearchService', () => {
  const originalGemini = config.geminiApiKey;
  const originalGeminiKeys = [...config.geminiApiKeys];
  const originalDeepseek = config.deepseekApiKey;
  const originalOpenAI = config.openaiApiKey;
  const originalOpenRouter = config.openRouterApiKey;
  const originalPuter = config.puterAuthToken;
  const originalAIGatewayBaseUrl = config.AIGatewayBaseUrl;

  beforeEach(() => {
    (config as any).geminiApiKey = '';
    (config as any).geminiApiKeys = [];
    (config as any).deepseekApiKey = '';
    (config as any).openaiApiKey = '';
    (config as any).openRouterApiKey = '';
    (config as any).puterAuthToken = '';
    (config as any).AIGatewayBaseUrl = '';
  });

  afterEach(() => {
    (config as any).geminiApiKey = originalGemini;
    (config as any).geminiApiKeys = [...originalGeminiKeys];
    (config as any).deepseekApiKey = originalDeepseek;
    (config as any).openaiApiKey = originalOpenAI;
    (config as any).openRouterApiKey = originalOpenRouter;
    (config as any).puterAuthToken = originalPuter;
    (config as any).AIGatewayBaseUrl = originalAIGatewayBaseUrl;
    jest.clearAllMocks();
  });

  it('falls back to formatted raw DuckDuckGo results when no summarizer is available', async () => {
    (search as jest.Mock).mockResolvedValue({
      results: [
        {
          title: 'ExternalExecutor',
          url: 'https://example.com/external_executor',
          description: 'Resumo da busca.',
        },
      ],
    });

    const service = new DeepSearchService({ log: jest.fn() } as any);
    const result = await service.research('external_executor');

    expect(result).toContain('Resultados brutos para "external_executor"');
    expect(result).toContain('https://example.com/external_executor');
  });
});
