import { resolveCheapUserStackHop } from '../../../src/services/llm/UserStackCostRoute.js';
import type { UserProviderSelection } from '../../../src/services/UserSelectionResolver.js';

describe('UserStackCostRoute', () => {
  const baseSelection: UserProviderSelection = {
    providerId: 'openai',
    modelId: 'gpt-4o',
    routeId: null,
    familyId: null,
    secondaryModelId: 'gpt-4o-mini',
    fallbackProviderIds: ['ollama:llama3.2', 'deepseek:deepseek-chat'],
    source: 'preference',
    configured: true,
  };

  it('prefers cheap hops on the user stack over primary', () => {
    const pick = resolveCheapUserStackHop({
      selection: baseSelection,
      env: {} as NodeJS.ProcessEnv,
      preferEnvBackground: false,
    });
    // ollama ranks cheapest among non-primary hops
    expect(pick.providerName).toBe('ollama');
    expect(pick.modelName).toBe('llama3.2');
    expect(pick.source).toBe('user_fallback');
  });

  it('returns primary_only when stack has no secondary/fallback', () => {
    const pick = resolveCheapUserStackHop({
      selection: {
        ...baseSelection,
        secondaryModelId: null,
        fallbackProviderIds: [],
      },
      env: {} as NodeJS.ProcessEnv,
      preferEnvBackground: false,
    });
    expect(pick.source).toBe('primary_only');
    expect(pick.modelName).toBeNull();
  });

  it('ignores off-stack env background when user stack is set', () => {
    const pick = resolveCheapUserStackHop({
      selection: baseSelection,
      env: {
        ZAVORTH_BACKGROUND_MODEL: 'totally-foreign-model',
        ZAVORTH_BACKGROUND_PROVIDER: 'foreign-vendor',
      } as NodeJS.ProcessEnv,
    });
    expect(pick.providerName).not.toBe('foreign-vendor');
    expect(pick.modelName).not.toBe('totally-foreign-model');
  });

  it('honors env when stack is empty', () => {
    const pick = resolveCheapUserStackHop({
      selection: {
        providerId: null,
        modelId: null,
        routeId: null,
        familyId: null,
        secondaryModelId: null,
        fallbackProviderIds: [],
        source: 'none',
        configured: false,
      },
      env: {
        ZAVORTH_BACKGROUND_MODEL: 'flash-lite',
        ZAVORTH_BACKGROUND_PROVIDER: 'gemini',
      } as NodeJS.ProcessEnv,
    });
    expect(pick.modelName).toBe('flash-lite');
    expect(pick.providerName).toBe('gemini');
    expect(pick.source).toBe('env.background');
  });
});
