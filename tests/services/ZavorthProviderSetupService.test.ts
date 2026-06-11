import { ZavorthProviderSetupService } from '../../src/services/ZavorthProviderSetupService.js';

describe('ZavorthProviderSetupService', () => {
  it('marks credential-backed providers configured and exposes selectable models', () => {
    const service = new ZavorthProviderSetupService();
    const preview = service.preview({
      providerId: 'openai',
      credentialRef: 'secret-ref:providers.openai.apiKey',
      allowDefaultRoute: true,
    });

    expect(preview.status).toBe('configured');
    expect(preview.defaultRouteAllowed).toBe(true);
    expect(preview.selectableModelIds).toContain('openai:gpt-4.1');
  });

  it('blocks private network targets unless they are explicit local providers', () => {
    const service = new ZavorthProviderSetupService();
    const preview = service.preview({
      providerId: 'openai',
      targetHost: 'http://127.0.0.1:11434',
      credentialPresent: true,
    });

    expect(preview.status).toBe('blocked');
    expect(preview.blockReason).toBe('private_network_provider_requires_explicit_local_provider');
  });

  it('allows Ollama loopback setup as a local provider', () => {
    const service = new ZavorthProviderSetupService();
    const connection = service.toRuntimeConnection({
      providerId: 'ollama',
      targetHost: 'http://127.0.0.1:11434',
    });

    expect(connection.status).toBe('configured');
    expect(connection.localLoopback).toBe(true);
    expect(connection.defaultRouteAllowed).toBe(true);
  });
});
