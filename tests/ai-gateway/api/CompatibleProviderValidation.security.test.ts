jest.mock(
  '@/shared/utils/logger',
  () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  }),
  { virtual: true }
);

jest.mock('../../../src/ai-gateway/lib/security/egressGuard', () => ({
  assertProviderValidationTargetAllowed: jest.fn(async () => undefined),
}));

import { validateRegisteredOpenAILikeProvider } from '../../../src/ai-gateway/lib/providers/validation/registeredOpenaiLike';

describe('compatible provider validation integrity', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does not treat a reachable 404 endpoint as credential proof', async () => {
    global.fetch = jest.fn(async () => new Response('{}', { status: 404 })) as typeof fetch;

    const result = await validateRegisteredOpenAILikeProvider({
      provider: 'custom',
      apiKey: 'unverified',
      baseUrl: 'https://api.example.test/v1',
    });

    expect(result.valid).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not treat a rejected inference request as credential proof', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{}', { status: 400 })) as typeof fetch;

    const result = await validateRegisteredOpenAILikeProvider({
      provider: 'custom',
      apiKey: 'unverified',
      baseUrl: 'https://api.example.test/v1',
      providerSpecificData: { validationModelId: 'custom-model' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        error: expect.stringContaining('400'),
      })
    );
  });

  it('accepts credentials only after a successful authenticated endpoint response', async () => {
    global.fetch = jest.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;

    await expect(
      validateRegisteredOpenAILikeProvider({
        provider: 'custom',
        apiKey: 'verified-by-upstream',
        baseUrl: 'https://api.example.test/v1',
      })
    ).resolves.toEqual({ valid: true, error: null, method: 'models_endpoint' });
  });
});
