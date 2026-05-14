import {
  NATURAL_CAPABILITY_DISCOVERY_CONTRACT_VERSION,
  NaturalCapabilityDiscoveryService,
} from '../../../src/runtime/agent/index.js';

describe('NaturalCapabilityDiscoveryService Wave 29', () => {
  it('discovers mutation and shell tools without executing anything', () => {
    const snapshot = new NaturalCapabilityDiscoveryService({
      now: () => new Date('2026-05-03T20:00:00.000Z'),
    }).discover({
      text: 'corrija o arquivo e rode os testes',
      surface: 'cli',
      requestedTools: [],
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: NATURAL_CAPABILITY_DISCOVERY_CONTRACT_VERSION,
      source: 'NaturalCapabilityDiscoveryService',
      safety: expect.objectContaining({
        noExecutionPerformed: true,
        naturalLanguageDoesNotBypassPolicy: true,
        highestRisk: 'danger',
        requiresApproval: true,
      }),
    }));
    expect(snapshot.recommendedToolNames).toEqual(expect.arrayContaining(['write_file', 'shell.exec']));
    expect(snapshot.toolHintProfile).toEqual(expect.objectContaining({
      recommendedToolNames: expect.arrayContaining(['write_file', 'shell.exec']),
    }));
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'capability-discovery:policy',
      }),
    ]));
  });

  it('routes selfmod language through preview-first recommendations', () => {
    const snapshot = new NaturalCapabilityDiscoveryService().discover({
      text: 'melhore o Zavorth com selfmod supervisionado',
      surface: 'web',
      requestedTools: [],
    });

    expect(snapshot.intentCategory).toBe('selfmod-preview');
    expect(snapshot.recommendedToolNames).toContain('selfmod.preview');
    expect(snapshot.safety.previewRequired).toBe(true);
    expect(snapshot.nextSafeAction).toContain('preview');
    expect(snapshot.recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        previewRequired: true,
        nextSafeAction: expect.stringContaining('preview'),
      }),
    ]));
  });

  it('preserves imported capability quarantine as a discovery warning', () => {
    const snapshot = new NaturalCapabilityDiscoveryService().discover({
      text: 'liste skills e MCPs disponiveis',
      surface: 'api',
      requestedTools: [],
      metadata: {
        importedCapabilityTrust: {
          total: {
            quarantined: 2,
          },
          blockedTools: ['mcp.unsafe-tool'],
        },
      },
    });

    expect(snapshot.quarantine).toEqual(expect.objectContaining({
      importedCapabilityTrustPresent: true,
      quarantinedCount: 2,
      blockedToolIds: ['mcp.unsafe-tool'],
      warning: expect.stringContaining('quarentena'),
    }));
    expect(snapshot.nextSafeAction).toContain('quarentena');
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'quarantine',
      }),
    ]));
  });
});
