import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DESKTOP_ONBOARDING_AUDIENCES,
  DESKTOP_ONBOARDING_TRAIL,
  buildModelRoutingRequest,
  buildOnboardingChecklist,
  buildProviderConnectionRequest,
  getOnboardingAudience,
  isDesktopOnboardingAudienceId,
  normalizeSelectableModels,
  setOnboardingAudience,
  shouldOpenDesktopOnboarding,
  starterAskForAudience,
} from '../../../apps/zavorth-desktop/src/onboarding/desktopOnboarding';

describe('Zavorth Desktop P0 onboarding contract', () => {
  it('opens on first launch and stays closed after the user completes or defers onboarding', () => {
    expect(shouldOpenDesktopOnboarding({ storedOnboarded: null, force: false })).toBe(true);
    expect(shouldOpenDesktopOnboarding({ storedOnboarded: 'false', force: false })).toBe(true);
    expect(shouldOpenDesktopOnboarding({ storedOnboarded: 'true', force: false })).toBe(false);
    expect(shouldOpenDesktopOnboarding({ storedOnboarded: 'true', force: true })).toBe(true);
  });

  it('builds provider creation requests for the desktop bridge instead of renderer fetch', () => {
    expect(buildProviderConnectionRequest({
      type: 'openai',
      displayName: 'OpenAI Premium',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    })).toEqual({
      method: 'POST',
      path: '/api/v2/providers',
      body: {
        type: 'openai',
        displayName: 'OpenAI Premium',
        baseUrl: 'https://api.openai.com/v1',
        requiresApiKey: true,
        apiKey: 'sk-test',
        enabled: true,
      },
      timeoutMs: 20000,
    });

    expect(buildProviderConnectionRequest({
      type: 'ollama',
      displayName: 'Ollama Local',
      baseUrl: 'http://localhost:11434',
      apiKey: '',
    }).body).toMatchObject({
      type: 'ollama',
      requiresApiKey: false,
      enabled: true,
    });
  });

  it('normalizes provider models and builds the runtime route request', () => {
    const models = normalizeSelectableModels({
      providers: {
        selectableModelIds: [
          'openai:gpt-5',
          'anthropic:claude-opus',
          'openai:gpt-4.1',
        ],
      },
    }, 'openai');

    expect(models).toEqual(['openai:gpt-5', 'openai:gpt-4.1']);
    expect(buildModelRoutingRequest({
      selectedModel: 'openai:gpt-5',
      providerType: 'openai',
      fallbackModelIds: ['openai:gpt-4.1'],
    })).toMatchObject({
      method: 'POST',
      path: '/api/experience/runtime-state/action',
      body: {
        type: 'route-model',
        approved: true,
        sessionId: 'desktop-main',
        source: 'zavorth-desktop-onboarding',
      },
    });
  });

  it('tracks runtime, provider, model, workspace, identity, and trust as first-run readiness items', () => {
    const checklist = buildOnboardingChecklist({
      runtimeRunning: true,
      providerConnected: true,
      modelSelected: false,
      workspaceSelected: true,
      identityConfigured: false,
      trustPolicyConfigured: false,
    });

    expect(checklist.map(item => item.id)).toEqual([
      'runtime',
      'provider',
      'model',
      'workspace',
      'identity',
      'trust',
    ]);
    expect(checklist.filter(item => item.complete).map(item => item.id)).toEqual([
      'runtime',
      'provider',
      'workspace',
    ]);
  });

  it('starts first-run with an audience step (personal / developer / business) and audience-specific starter asks', () => {
    expect(DESKTOP_ONBOARDING_TRAIL[0]?.id).toBe('audience');
    expect(DESKTOP_ONBOARDING_AUDIENCES.map((entry) => entry.id)).toEqual([
      'personal',
      'developer',
      'business',
    ]);
    expect(isDesktopOnboardingAudienceId('developer')).toBe(true);
    expect(isDesktopOnboardingAudienceId('power')).toBe(false);

    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    };
    setOnboardingAudience('business', fakeStorage);
    expect(getOnboardingAudience(fakeStorage)).toBe('business');
    expect(starterAskForAudience('developer')).toMatch(/risk/i);
    expect(starterAskForAudience('business')).toMatch(/approval/i);
    expect(starterAskForAudience('personal')).toMatch(/without changing any files/i);
  });

  it('does not bypass the Electron desktop bridge with direct /api fetch calls', () => {
    const source = readFileSync(
      join(process.cwd(), 'apps/zavorth-desktop/src/components/OnboardingOverlay.tsx'),
      'utf8',
    );

    expect(source).not.toMatch(/fetch\(['"]\/api/);
    expect(source).toContain('apiRequest');
    expect(source).toContain('DESKTOP_ONBOARDING_AUDIENCES');
    expect(source).toContain('onAudienceSelected');
  });

  it('keeps provider settings on the Electron bridge when rendered from file://', () => {
    const source = readFileSync(
      join(process.cwd(), 'apps/zavorth-desktop/src/panels/ProviderSettingsPanel.tsx'),
      'utf8',
    );

    expect(source).not.toMatch(/fetch\(['"`]\/api/);
    expect(source).toContain('apiRequest');
  });
});
