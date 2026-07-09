import { describe, expect, it } from 'vitest';
import {
  shouldOpenDesktopOnboarding,
  buildProviderConnectionRequest,
  buildModelRoutingRequest,
  normalizeSelectableModels,
  buildOnboardingChecklist,
  markOnboardingComplete,
  isOnboardingComplete,
  setTrustedOperatorHint,
  getTrustedOperatorHint,
  markOnboardingCelebration,
  consumeOnboardingCelebration,
  DESKTOP_ONBOARDING_STORAGE_KEY,
  DESKTOP_TRUST_MODE_KEY,
  DESKTOP_ONBOARDING_CELEBRATE_KEY,
  DESKTOP_ONBOARDING_TRAIL,
} from '../src/onboarding/desktopOnboarding';

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

describe('desktop onboarding helpers', () => {
  it('opens onboarding when not completed', () => {
    expect(shouldOpenDesktopOnboarding({ storedOnboarded: null })).toBe(true);
    expect(shouldOpenDesktopOnboarding({ storedOnboarded: 'false' })).toBe(true);
    expect(shouldOpenDesktopOnboarding({ storedOnboarded: 'true' })).toBe(false);
    expect(shouldOpenDesktopOnboarding({ storedOnboarded: 'true', force: true })).toBe(true);
  });

  it('marks and reads onboarding completion via storage helpers', () => {
    const storage = memoryStorage();
    expect(isOnboardingComplete(storage)).toBe(false);
    markOnboardingComplete(storage);
    expect(isOnboardingComplete(storage)).toBe(true);
    expect(storage.getItem(DESKTOP_ONBOARDING_STORAGE_KEY)).toBe('true');
  });

  it('stores trusted operator hint without implying red-lane bypass', () => {
    const storage = memoryStorage();
    expect(getTrustedOperatorHint(storage)).toBe(false);
    setTrustedOperatorHint(true, storage);
    expect(getTrustedOperatorHint(storage)).toBe(true);
    expect(storage.getItem(DESKTOP_TRUST_MODE_KEY)).toBe('true');
    setTrustedOperatorHint(false, storage);
    expect(getTrustedOperatorHint(storage)).toBe(false);
  });

  it('consumes one-shot onboarding celebration flag', () => {
    const session = memoryStorage();
    expect(consumeOnboardingCelebration(session)).toBe(false);
    markOnboardingCelebration(session);
    expect(session.getItem(DESKTOP_ONBOARDING_CELEBRATE_KEY)).toBe('1');
    expect(consumeOnboardingCelebration(session)).toBe(true);
    expect(consumeOnboardingCelebration(session)).toBe(false);
  });

  it('defines a 4-step trail with optional channels', () => {
    expect(DESKTOP_ONBOARDING_TRAIL).toHaveLength(4);
    expect(DESKTOP_ONBOARDING_TRAIL.map(step => step.id)).toEqual([
      'provider',
      'trust',
      'channel',
      'first-ask',
    ]);
    expect(DESKTOP_ONBOARDING_TRAIL.find(step => step.id === 'channel')?.optional).toBe(true);
  });

  it('builds provider connection request without leaking ollama key requirement', () => {
    const openai = buildProviderConnectionRequest({
      type: 'openai',
      displayName: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    });
    expect(openai.method).toBe('POST');
    expect(openai.path).toBe('/api/v2/providers');
    expect(openai.body).toMatchObject({
      type: 'openai',
      requiresApiKey: true,
      apiKey: 'sk-test',
      enabled: true,
    });

    const ollama = buildProviderConnectionRequest({
      type: 'ollama',
      displayName: 'Ollama',
      baseUrl: 'http://localhost:11434',
    });
    expect(ollama.body).toMatchObject({
      type: 'ollama',
      requiresApiKey: false,
      apiKey: undefined,
    });
  });

  it('filters selectable models by provider prefix', () => {
    const models = normalizeSelectableModels({
      providers: {
        selectableModelIds: [
          'openai:gpt-4o',
          'anthropic:claude',
          'openai:gpt-4.1',
          12,
          null,
        ],
      },
    }, 'openai');
    expect(models).toEqual(['openai:gpt-4o', 'openai:gpt-4.1']);
  });

  it('builds model routing request for onboarding', () => {
    const request = buildModelRoutingRequest({
      selectedModel: 'openai:gpt-4o',
      providerType: 'openai',
      fallbackModelIds: ['openai:gpt-4.1'],
    });
    expect(request.path).toBe('/api/experience/runtime-state/action');
    expect(request.body).toMatchObject({
      type: 'route-model',
      approved: true,
      source: 'zavorth-desktop-onboarding',
      payload: {
        dynamicRouting: {
          modelId: 'openai:gpt-4o',
          providerId: 'openai',
          risk: 'low',
        },
      },
    });
  });

  it('builds onboarding checklist with completion flags', () => {
    const items = buildOnboardingChecklist({
      runtimeRunning: true,
      providerConnected: true,
      modelSelected: false,
      workspaceSelected: true,
      identityConfigured: false,
      trustPolicyConfigured: true,
    });
    expect(items).toHaveLength(6);
    expect(items.find(item => item.id === 'runtime')?.complete).toBe(true);
    expect(items.find(item => item.id === 'model')?.complete).toBe(false);
    expect(DESKTOP_ONBOARDING_STORAGE_KEY).toBe('zvd:onboarded');
  });
});
