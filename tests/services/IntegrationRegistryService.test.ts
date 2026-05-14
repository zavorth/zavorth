import { IntegrationRegistryService } from '../../src/services/IntegrationRegistryService';

describe('IntegrationRegistryService', () => {
  it('resolves native integrations by id', () => {
    const service = new IntegrationRegistryService();

    const resolution = service.resolveRequestedIntegration('openrouter');

    expect(resolution.manifest?.id).toBe('openrouter');
    expect(resolution.matchedBy).toBe('id');
  });

  it('resolves MiniMax as a first-class native provider integration', () => {
    const service = new IntegrationRegistryService();

    const resolution = service.resolveRequestedIntegration('minimax');

    expect(resolution.manifest?.id).toBe('minimax');
    expect(resolution.manifest?.supportLevel).toBe('native');
  });

  it('maps cloud-like names to the docker template when aliased', () => {
    const service = new IntegrationRegistryService();

    const resolution = service.resolveRequestedIntegration('zerocloud');

    expect(resolution.manifest?.id).toBe('custom-docker-agent');
    expect(['alias', 'template']).toContain(resolution.matchedBy);
  });

  it('falls back to the API template for unknown remote services', () => {
    const service = new IntegrationRegistryService();

    const resolution = service.resolveRequestedIntegration('meuhub-api');

    expect(resolution.manifest?.id).toBe('custom-api');
    expect(resolution.matchedBy).toBe('template');
  });

  it('resolves the Oracle + Cloudflare + Gemma recipe by alias', () => {
    const service = new IntegrationRegistryService();

    const resolution = service.resolveRequestedIntegration('oracle-cloudflare');

    expect(resolution.manifest?.id).toBe('oracle-cloudflare-gemma');
    expect(resolution.matchedBy).toBe('alias');
  });

  it('resolves ZavorthBridge Remote by alias', () => {
    const service = new IntegrationRegistryService();

    const resolution = service.resolveRequestedIntegration('zavorth-bridge-remote');

    expect(resolution.manifest?.id).toBe('zavorth-terminal');
    expect(resolution.matchedBy).toBe('alias');
  });

  it('resolves channel integrations as first-class manifests', () => {
    const service = new IntegrationRegistryService();

    expect(service.resolveRequestedIntegration('telegram').manifest?.id).toBe('telegram');
    expect(service.resolveRequestedIntegration('slack').manifest?.id).toBe('slack');
    expect(service.resolveRequestedIntegration('whatsapp-cloud-api').manifest?.id).toBe('whatsapp');
  });
});
