import {
  ProviderMeshFailoverRouterService,
  type ProviderRouteCandidate,
} from '../../../src/domain/ai-routing/ProviderMeshFailoverRouterService.js';

describe('ProviderMeshFailoverRouterService', () => {
  let router: ProviderMeshFailoverRouterService;

  const candidateChain: ProviderRouteCandidate[] = [
    { providerId: 'anthropic', model: 'claude-3-7-sonnet', priority: 1 },
    { providerId: 'openai', model: 'gpt-4o', priority: 2 },
    { providerId: 'ollama_local', model: 'qwen2.5-coder', priority: 3, isLocal: true },
  ];

  beforeEach(() => {
    router = new ProviderMeshFailoverRouterService();
  });

  it('classifies 429 rate limit errors as retryable on alternate providers', () => {
    const error = { status: 429, message: 'Rate limit exceeded: TPM limit reached' };
    const classification = router.classifyError(error);

    expect(classification.kind).toBe('rate_limit_429');
    expect(classification.isRetryableOnAlternateProvider).toBe(true);
  });

  it('classifies context overflow errors as non-retryable', () => {
    const error = new Error('Maximum context length exceeded: 130000 > 128000 tokens');
    const classification = router.classifyError(error);

    expect(classification.kind).toBe('context_overflow');
    expect(classification.isRetryableOnAlternateProvider).toBe(false);
  });

  it('executes primary provider successfully without falling back', async () => {
    const executor = jest.fn().mockResolvedValue('Response from Claude');

    const result = await router.executeWithFailover(candidateChain, executor);

    expect(result.success).toBe(true);
    expect(result.activeProviderId).toBe('anthropic');
    expect(result.result).toBe('Response from Claude');
    expect(result.totalAttempts).toBe(1);
  });

  it('falls back automatically to secondary provider when primary encounters 429 rate limit', async () => {
    const executor = jest.fn()
      .mockRejectedValueOnce({ status: 429, message: 'Too many requests' })
      .mockResolvedValueOnce('Response from GPT-4o');

    const result = await router.executeWithFailover(candidateChain, executor);

    expect(result.success).toBe(true);
    expect(result.activeProviderId).toBe('openai');
    expect(result.totalAttempts).toBe(2);
    expect(result.attemptHistory[0].success).toBe(false);
    expect(result.attemptHistory[1].success).toBe(true);
  });
});
