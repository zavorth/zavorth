import { ProviderFabricService } from '../../../src/services/providers/index.js';
import type { ProviderFabricDescriptor } from '../../../src/contracts/provider/index.js';

const provider = (id: string, overrides: Partial<ProviderFabricDescriptor> = {}): ProviderFabricDescriptor => ({
  id, capabilities: ['chat', 'tools'], regions: ['br'], privacy: 'public-cloud', estimatedInputCostPerMillion: 1,
  estimatedOutputCostPerMillion: 2, expectedLatencyMs: 500, maxContextTokens: 128_000, credentialRefs: [`${id.toUpperCase().replace(/-/g, '_')}_API_KEY`], enabled: true, ...overrides,
});

describe('ProviderFabricService', () => {
  it('discovers descriptors without a vendor allowlist and explains policy routing', () => {
    const service = new ProviderFabricService();
    const decision = service.decide({ descriptors: [provider('dynamic-a'), provider('dynamic-b', { expectedLatencyMs: 100 })], policy: { requiredCapabilities: ['chat'], allowedRegions: ['br'] }, health: { 'dynamic-a': 'healthy', 'dynamic-b': 'healthy' } });
    expect(decision.selectedProviderId).toBe('dynamic-b');
    expect(decision.fallbackProviderIds).toEqual(['dynamic-a']);
    expect(decision.explain[0]).toContain('Selected dynamic-b');
  });

  it('fails closed for circuit, privacy, region and budget violations', () => {
    const service = new ProviderFabricService();
    const decision = service.decide({ descriptors: [provider('remote', { regions: ['us'] }), provider('local', { privacy: 'local', regions: ['br'], estimatedInputCostPerMillion: 0, estimatedOutputCostPerMillion: 0 })], policy: { requiredCapabilities: ['chat'], allowedRegions: ['br'], maximumPrivacy: 'local', maximumEstimatedCost: 0 }, health: { local: 'open' }, estimatedInputTokens: 1000 });
    expect(decision.selectedProviderId).toBeNull();
    expect(decision.candidates.find((c) => c.providerId === 'local')?.blockers).toContain('circuit-open');
    expect(decision.candidates.find((c) => c.providerId === 'remote')?.blockers).toEqual(expect.arrayContaining(['region-not-allowed', 'privacy-policy', 'cost-budget']));
  });

  it('certifies provider descriptors without reading or serializing secrets', () => {
    const service = new ProviderFabricService();
    expect(service.certify(provider('new-provider')).certified).toBe(true);
    expect(service.certify(provider('typed-provider', { credentialRefs: ['env:TYPED_API_KEY', 'secret-store:providers/typed/api-key'] })).certified).toBe(true);
    expect(() => service.discover([provider('bad-provider', { credentialRefs: ['api_key=secret'] })])).toThrow(/Unsafe credential/);
  });

  it.each([
    { capabilities: ['  '] },
    { regions: [''] },
    { expectedLatencyMs: Number.NaN },
    { estimatedInputCostPerMillion: -1 },
  ])('rejects malformed descriptors: %j', (overrides) => {
    expect(() => new ProviderFabricService().discover([provider('malformed', overrides)])).toThrow();
  });

  it('rejects malformed policies, runtime budgets, weights and health states', () => {
    const service = new ProviderFabricService();
    const base = { descriptors: [provider('safe')], policy: { requiredCapabilities: ['chat'] } };
    expect(() => service.decide({ ...base, policy: { ...base.policy, weights: { cost: Number.POSITIVE_INFINITY } } })).toThrow(/weight/);
    expect(() => service.decide({ ...base, estimatedInputTokens: -1 })).toThrow(/estimatedInputTokens/);
    expect(() => service.decide({ ...base, health: { safe: 'broken' as never } })).toThrow(/health state/);
    expect(() => service.decide({ ...base, policy: { ...base.policy, maximumPrivacy: 'secret' as never } })).toThrow(/maximumPrivacy/);
    expect(() => service.decide({ ...base, policy: { requiredCapabilities: [{} as never] } })).toThrow(/non-empty strings/);
    expect(() => service.decide({ ...base, descriptors: [provider('safe', { enabled: 'false' as never })] })).toThrow(/enabled must be boolean/);
    expect(() => service.decide({ ...base, descriptors: [provider('safe', { maxContextTokens: 1.5 })] })).toThrow(/maxContextTokens/);
  });

  it('normalizes health identifiers and rejects conflicting aliases', () => {
    const service = new ProviderFabricService();
    const decision = service.decide({
      descriptors: [provider('mixed-case')],
      policy: { requiredCapabilities: ['chat'] },
      health: { ' MIXED-CASE ': 'open' },
    });
    expect(decision.selectedProviderId).toBeNull();
    expect(decision.candidates[0]?.blockers).toContain('circuit-open');
    expect(() => service.decide({
      descriptors: [provider('mixed-case')],
      policy: { requiredCapabilities: ['chat'] },
      health: { 'mixed-case': 'healthy', ' MIXED-CASE ': 'open' },
    })).toThrow(/Conflicting health states/);
  });

  it('keeps unknown economics explicit instead of inventing a synthetic cost', () => {
    const service = new ProviderFabricService();
    const decision = service.decide({ descriptors: [provider('unknown', { estimatedInputCostPerMillion: null, estimatedOutputCostPerMillion: null })], policy: { requiredCapabilities: ['chat'] } });
    expect(decision.selectedProviderId).toBe('unknown');
    expect(decision.budget.estimatedCost).toBeNull();
    expect(decision.candidates[0]?.reasons).toContain('cost-unknown');
  });

  it('preserves the exact descriptor boundary finding in certification output', () => {
    const result = new ProviderFabricService().certify(provider('invalid', { capabilities: [''] }));
    expect(result.certified).toBe(false);
    expect(result.checks.find((entry) => entry.id === 'descriptor')?.detail).toContain('requires at least one capability');
  });
});
