import {
  NATURAL_CAPABILITY_DISCOVERY_CONTRACT_VERSION,
  NaturalCapabilityDiscoveryService,
} from '../../../src/runtime/agent/index.js';

describe('NaturalCapabilityDiscoveryService Capability Discovery ', () => {
  it('discovers mutation and shell tools from requestedTools (not free-text NLU)', () => {
    const snapshot = new NaturalCapabilityDiscoveryService({
      now: () => new Date('2026-05-03T20:00:00.000Z'),
    }).discover({
      text: 'please fix the failing suite',
      surface: 'cli',
      requestedTools: ['write_file', 'shell.exec'],
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
      reason: expect.stringMatching(/Capability discovery recommended/i),
    }));
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'capability-discovery:policy',
      }),
    ]));
  });

  it('routes selfmod via technical selfmod token / tool ids (preview-first)', () => {
    const snapshot = new NaturalCapabilityDiscoveryService().discover({
      text: 'run selfmod supervised preview',
      surface: 'web',
      requestedTools: ['selfmod.preview'],
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

  it('does not invent tools from pure free-text phrases without technical signals', () => {
    const snapshot = new NaturalCapabilityDiscoveryService().discover({
      text: 'corrija o arquivo e rode os testes',
      surface: 'cli',
      requestedTools: [],
    });

    // no phrase maps → no write_file/shell.exec from PT alone
    expect(snapshot.recommendedToolNames).not.toEqual(expect.arrayContaining(['write_file', 'shell.exec']));
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
      warning: expect.stringContaining('Quarantined'),
    }));
    expect(snapshot.nextSafeAction).toContain('quarantine');
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'quarantine',
      }),
    ]));
  });
});
