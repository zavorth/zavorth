import type { CapabilityDefinition, CapabilitySummary } from '../../src/contracts/CapabilityContract';
import { ZavorthCapabilityOsService } from '../../src/services/ZavorthCapabilityOsService';

function buildSummary(capabilities: CapabilityDefinition[]): CapabilitySummary {
  const plugin = capabilities.filter((capability) => capability.source === 'plugin').length;
  return {
    total: capabilities.length,
    builtin: capabilities.length - plugin,
    plugin,
    commands: capabilities.filter((capability) => capability.command).length,
    implicitRoutes: capabilities.filter((capability) => capability.matchers?.length).length,
  };
}

function createRegistry(capabilities: CapabilityDefinition[]) {
  return {
    getAll: jest.fn(() => capabilities.map((capability) => ({ ...capability }))),
    getSummary: jest.fn(() => buildSummary(capabilities)),
    findByCommand: jest.fn((commandType: string) =>
      capabilities.find((capability) => capability.command?.command === commandType) || null),
    matchImplicit: jest.fn(() => null),
  };
}

describe('ZavorthCapabilityOsService identity surface', () => {
  it('publishes the fallback matrix with native external executor keys only', () => {
    const service = new ZavorthCapabilityOsService({
      capabilityRegistry: createRegistry([]) as any,
      ledgerService: null,
    });

    const snapshot = service.buildSnapshot();

    expect(JSON.stringify(snapshot.fallbackMatrix)).toContain('external_executor');
    expect(snapshot.fallbackMatrix.external_executor).toEqual(['codex', 'local_executor', 'conversation']);
    expect(snapshot.fallbackMatrix['workflow:review']).toEqual([
      'external_executor',
      'codex',
      'conversation',
    ]);
  });

  it('routes external executor preferences through the native fallback chain', () => {
    const executor = 'external_executor';
    const capability: CapabilityDefinition = {
      id: 'compatibility-route',
      label: 'Compatibility Route',
      type: 'executor',
      description: 'Internal compatibility route.',
      intent: 'code_execution',
      executor_preference: executor,
      dispatch_mode: 'execution',
      routing_reason: 'Internal compatibility route.',
      routing_confidence: 1,
      command: {
        command: '/compat',
        description: 'Internal compatibility command.',
        section: 'execution',
        explicit_executor: executor,
      },
    };
    const service = new ZavorthCapabilityOsService({
      capabilityRegistry: createRegistry([capability]) as any,
      ledgerService: null,
    });

    const manifest = service.buildSnapshot().manifests[0];

    expect(manifest.executorPreference).toBe(executor);
    expect(manifest.fallback.chain).toEqual(['codex', 'local_executor', 'conversation']);
  });
});
