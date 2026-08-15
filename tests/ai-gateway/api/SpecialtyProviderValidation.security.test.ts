jest.mock(
  '@zavorth/ai-gateway/open-sse/services/qoderCli.ts',
  () => ({
    validateQoderCliPat: jest.fn(async () => ({
      valid: false,
      error: 'Qoder PAT validation is unavailable',
      unsupported: true,
    })),
  }),
  { virtual: true }
);

jest.mock(
  '@/shared/utils/logger',
  () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  }),
  { virtual: true }
);

import { validateSpecialtyProvider } from '../../../src/ai-gateway/lib/providers/validationSpecialtyProviders';
import {
  getStaticQoderModels,
  validateQoderCliPat,
} from '../../../src/ai-gateway/open-sse/services/qoderCli';

describe('specialty provider validation integrity', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it.each([
    ['nanobanana', 500],
    ['inworld', 404],
    ['longcat', 429],
    ['bailian-coding-plan', 400],
    ['brave-search', 404],
  ])('does not report %s as valid after HTTP %i', async (provider, status) => {
    global.fetch = jest.fn(async () => new Response('{}', { status })) as typeof fetch;

    const result = await validateSpecialtyProvider({
      provider,
      apiKey: 'not-a-real-key',
      providerSpecificData: {},
    });

    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        error: expect.stringContaining(String(status)),
      })
    );
  });

  it('keeps successful upstream validation responses valid', async () => {
    global.fetch = jest.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;

    await expect(
      validateSpecialtyProvider({
        provider: 'inworld',
        apiKey: 'not-a-real-key',
        providerSpecificData: {},
      })
    ).resolves.toEqual({ valid: true, error: null });
  });

  it('marks Qoder validation unavailable instead of accepting an unverified PAT', async () => {
    await expect(validateQoderCliPat()).resolves.toEqual(
      expect.objectContaining({ valid: false, unsupported: true })
    );
    expect(getStaticQoderModels().length).toBeGreaterThanOrEqual(5);
  });
});
