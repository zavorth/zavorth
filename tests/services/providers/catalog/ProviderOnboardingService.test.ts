import { ProviderOnboardingService } from '../../../../src/services/providers/catalog/ProviderOnboardingService';
import { createMinimalProviderIntegrationManifest } from '../../../../src/services/providers/catalog/ProviderIntegrationManifest';
import type { ProviderIntegrationManifest } from '../../../../src/services/providers/catalog/ProviderIntegrationManifest';
import type { ProviderAutoDiscoveryResult, ProviderAutoDiscoveryService } from '../../../../src/services/providers/catalog/ProviderAutoDiscoveryService';

describe('ProviderOnboardingService', () => {
  it('builds a unified custom-compatible onboarding result with env plan', async () => {
    const service = new ProviderOnboardingService();

    const result = await service.onboardCustom({
      id: 'acme',
      label: 'Acme AI',
      compatibility: 'openai_compatible',
      authKind: 'api_key',
      baseUrl: 'https://acme.example.com/v1',
      apiKeyEnv: 'ACME_API_KEY',
      modelId: 'acme-model-1',
    });

    expect(result.schemaVersion).toBe(1);
    expect(result.source).toBe('custom');
    expect(result.providerId).toBe('acme');
    expect(result.label).toBe('Acme AI');
    expect(result.manifest.id).toBe('acme');
    expect(result.env.baseUrlRef).toBe('ACME_BASE_URL');
    expect(result.env.apiKeyRef).toBe('ACME_API_KEY');
    expect(result.runtime.providerName).toBe('acme');
    expect(result.runtime.adapter).toBe('openai_compatible');
    expect(result.runtime.defaultModelName).toBe('acme-model-1');
    expect(result.runtime.supported).toBe(true);
    expect(result.explanation.join(' ')).not.toMatch(/prepairu|como|minimo/i);
  });

  it('unifies external import into a single onboarding result', async () => {
    const service = new ProviderOnboardingService();

    const result = await service.importExternal({
      source: JSON.stringify({
        providers: [
          {
            id: 'corp-gw',
            name: 'Corp Gateway',
            baseUrl: 'https://gw.corp.example/v1',
            apiKeyEnv: 'CORP_API_KEY',
            models: [{ id: 'corp-1', primary: true }],
          },
        ],
      }),
    });

    expect(result.source).toBe('import');
    expect(result.providerId).toBe('corp-gw');
    expect(result.manifest.id).toBe('corp-gw');
    expect(result.baseUrl).toBe('https://gw.corp.example/v1');
    expect(result.env.apiKeyRef).toBe('CORP_API_KEY');
    expect(result.runtime.defaultModelName).toBe('corp-1');
    expect(result.warnings).toEqual([]);
  });

  it('imports multiple providers from a YAML source', async () => {
    const service = new ProviderOnboardingService();

    const { results, warnings, errors } = await service.importExternalMany({
      format: 'yaml',
      source: [
        'providers:',
        '  - id: alpha',
        '    name: Alpha AI',
        '    baseUrl: https://alpha.example/v1',
        '    apiKeyEnv: ALPHA_API_KEY',
        '    models:',
        '      - alpha-1',
        '  - id: beta',
        '    name: Beta AI',
        '    baseUrl: https://beta.example/v1',
        '    apiKeyEnv: BETA_API_KEY',
        '    models:',
        '      - beta-1',
      ].join('\n'),
    });

    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(results).toHaveLength(2);
    expect(results[0].providerId).toBe('alpha');
    expect(results[0].baseUrl).toBe('https://alpha.example/v1');
    expect(results[0].models).toEqual(['alpha-1']);
    expect(results[1].providerId).toBe('beta');
    expect(results[1].baseUrl).toBe('https://beta.example/v1');
    expect(results[1].models).toEqual(['beta-1']);
  });

  it('unifies auto-discovery into a single onboarding result', async () => {
    const manifest: ProviderIntegrationManifest = createMinimalProviderIntegrationManifest({
      id: 'local-gw',
      label: 'Local Gateway',
      baseUrl: undefined,
      defaultModelName: 'm1',
    });
    const fakeDiscovery = {
      discover: async (): Promise<ProviderAutoDiscoveryResult> => ({
        success: true,
        providerId: 'local-gw',
        label: 'Local Gateway',
        baseUrl: 'http://localhost:1234/v1',
        source: 'live_api',
        models: [{ id: 'm1', name: 'M1', type: 'chat' }],
        manifest,
        warnings: [],
        errors: [],
      }),
    } as unknown as ProviderAutoDiscoveryService;

    const service = new ProviderOnboardingService({ autoDiscovery: fakeDiscovery });

    const result = await service.discover({
      providerId: 'local-gw',
      baseUrl: 'http://localhost:1234/v1',
    });

    expect(result.source).toBe('discovery');
    expect(result.providerId).toBe('local-gw');
    expect(result.env.baseUrlRef).toBe('LOCAL_GW_BASE_URL');
    expect(result.env.apiKeyRef).toBe('LOCAL_GW_API_KEY');
    expect(result.runtime.defaultModelName).toBe('m1');
    expect(result.runtime.supported).toBe(true);
  });
});
