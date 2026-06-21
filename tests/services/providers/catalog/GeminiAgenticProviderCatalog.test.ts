import { describe, it, expect } from 'vitest';
import { getDefaultProviderIntegrationRegistry } from '../../../../src/services/providers/catalog/ProviderIntegrationRegistry';

describe('Gemini agentic provider catalog', () => {
  it('publishes Gemini 3.5 Flash, Interactions API, and Managed Agent routes', () => {
    const registry = getDefaultProviderIntegrationRegistry();
    const gemini = registry.resolveProvider('gemini');
    expect(gemini?.primaryRoute.models?.map((model) => model.modelId)).toContain('gemini-3.5-flash');

    const interactions = registry.resolveRoute('gemini-interactions');
    expect(interactions?.route).toMatchObject({
      routeId: 'gemini-interactions',
      providerName: 'gemini-interactions',
    });
    expect(interactions?.route.capabilities).toEqual(expect.arrayContaining(['agentic', 'background']));

    const managed = registry.resolveRoute('gemini-managed-agent');
    expect(managed?.route).toMatchObject({
      routeId: 'gemini-managed-agent',
      providerName: 'gemini-managed-agent',
    });
    expect(managed?.route.limitations?.join(' ')).toMatch(/Never enabled by default/i);
  });
});
