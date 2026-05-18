import {
  RuntimePromotionGovernanceService,
  type StrongCapabilityLoopSnapshot,
} from '../../../src/runtime/agent/index.js';

function capabilityLoopSnapshot(): StrongCapabilityLoopSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: '2026-05-03T14:00:00.000Z',
    source: 'CapabilityLoopGovernanceService',
    trustMode: 'collaborator',
    sandboxTier: 'workspace-scoped',
    summary: 'C5 snapshot.',
    requestedCapabilityIds: ['session.ownership', 'timing.canonical', 'swarm.escalation', 'mnemos.memory', 'watchmode.computer-use'],
    blockedCapabilityIds: [],
    degradedCapabilityIds: [],
    capabilities: [
      {
        capabilityId: 'session.ownership',
        label: 'Session Ownership',
        status: 'ready',
        requested: true,
        policy: {
          mode: 'runtime-invariant',
          trustModes: ['protected', 'collaborator', 'overlord'],
          permission: 'none',
          description: 'Session ownership oficial.',
        },
        exposureProfile: {
          mode: 'safe',
          toolIds: ['sessions.history'],
          exposedToolIds: [],
          blockedToolIds: [],
          risk: 'safe',
          requiresApproval: false,
        },
        receipts: [
          {
            id: 'session.ownership:policy',
            kind: 'policy',
            source: 'CapabilityLoopGovernanceService',
            status: 'ready',
            detail: 'policy',
          },
        ],
        observability: {
          eventTitles: [],
          metadataKeys: ['canonicalContext'],
          receiptCount: 1,
        },
        fallback: {
          honest: true,
          summary: 'fallback',
        },
        controlSurface: {
          statusPath: '/control/runs/run#session',
          command: 'zavorth status --run run',
        },
      },
      {
        capabilityId: 'swarm.escalation',
        label: 'Swarm Escalation',
        status: 'ready',
        requested: true,
        policy: {
          mode: 'escalation',
          trustModes: ['collaborator', 'overlord'],
          permission: 'approval',
          description: 'Swarm oficial.',
        },
        exposureProfile: {
          mode: 'restricted',
          toolIds: ['swarm.run'],
          exposedToolIds: ['swarm.run'],
          blockedToolIds: [],
          risk: 'danger',
          requiresApproval: true,
        },
        receipts: [
          {
            id: 'swarm.escalation:policy',
            kind: 'policy',
            source: 'CapabilityLoopGovernanceService',
            status: 'ready',
            detail: 'policy',
          },
        ],
        observability: {
          eventTitles: [],
          metadataKeys: [],
          receiptCount: 1,
        },
        fallback: {
          honest: true,
          summary: 'fallback',
        },
        controlSurface: {
          statusPath: '/control/runs/run#swarm',
          command: 'zavorth status --run run',
        },
      },
      {
        capabilityId: 'mnemos.memory',
        label: 'Mnemos',
        status: 'ready',
        requested: true,
        policy: {
          mode: 'memory-plane',
          trustModes: ['protected', 'collaborator', 'overlord'],
          permission: 'none',
          description: 'Memory oficial.',
        },
        exposureProfile: {
          mode: 'safe',
          toolIds: ['memory.read'],
          exposedToolIds: [],
          blockedToolIds: [],
          risk: 'safe',
          requiresApproval: false,
        },
        receipts: [
          {
            id: 'mnemos.memory:policy',
            kind: 'policy',
            source: 'CapabilityLoopGovernanceService',
            status: 'ready',
            detail: 'policy',
          },
        ],
        observability: {
          eventTitles: [],
          metadataKeys: [],
          receiptCount: 1,
        },
        fallback: {
          honest: true,
          summary: 'fallback',
        },
        controlSurface: {
          statusPath: '/control/runs/run#memory',
          command: 'zavorth status --run run',
        },
      },
      {
        capabilityId: 'watchmode.computer-use',
        label: 'Watch Mode',
        status: 'ready',
        requested: true,
        policy: {
          mode: 'visual-control',
          trustModes: ['collaborator', 'overlord'],
          permission: 'operator',
          description: 'Watch Mode oficial.',
        },
        exposureProfile: {
          mode: 'restricted',
          toolIds: ['watchmode.control'],
          exposedToolIds: ['watchmode.control'],
          blockedToolIds: [],
          risk: 'danger',
          requiresApproval: true,
        },
        receipts: [
          {
            id: 'watchmode.computer-use:policy',
            kind: 'policy',
            source: 'CapabilityLoopGovernanceService',
            status: 'ready',
            detail: 'policy',
          },
        ],
        observability: {
          eventTitles: [],
          metadataKeys: [],
          receiptCount: 1,
        },
        fallback: {
          honest: true,
          summary: 'fallback',
        },
        controlSurface: {
          statusPath: '/control/runs/run#watch-mode',
          command: 'zavorth status --run run',
        },
      },
    ],
  };
}

describe('RuntimePromotionGovernanceService', () => {
  it('promotes only product adapters and keeps V2/doctor-dependent pieces experimental', () => {
    const service = new RuntimePromotionGovernanceService({
      now: () => new Date('2026-05-03T14:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      capabilityLoopGovernance: capabilityLoopSnapshot(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      schemaVersion: 1,
      source: 'RuntimePromotionGovernanceService',
      officialItemIds: expect.arrayContaining([
        'session-v2-pty',
        'swarm-orchestrator',
        'memory-compressor',
        'automatic-browser-tool',
      ]),
      experimentalItemIds: expect.arrayContaining([
        'session-recorder',
        'replay-dvr',
        'local-voice',
      ]),
    }));

    const swarm = snapshot.entries.find((entry) => entry.itemId === 'swarm-orchestrator');
    expect(swarm).toEqual(expect.objectContaining({
      decision: 'promote-product-adapter',
      publicStatus: 'official',
      productAdapterId: 'swarm.escalation',
      agentLoopIntegrated: true,
      publicClaimAllowed: true,
      mockDependent: false,
    }));
    expect(swarm?.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'adapter' }),
    ]));

    const recorder = snapshot.entries.find((entry) => entry.itemId === 'session-recorder');
    expect(recorder).toEqual(expect.objectContaining({
      decision: 'keep-experimental',
      publicStatus: 'experimental',
      featureFlag: 'ZAVORTH_ENABLE_SESSION_RECORDER',
      publicClaimAllowed: false,
    }));
    expect(recorder?.gates).toEqual(expect.arrayContaining([
      'retention-policy',
      'redaction-policy',
    ]));
    expect(snapshot.prohibitedPublicClaims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: 'session-recorder',
        claim: 'SessionRecorder esta pronto/stable',
      }),
    ]));
  });

  it('does not promote anything as official when no canonical adapter is present', () => {
    const service = new RuntimePromotionGovernanceService({
      now: () => new Date('2026-05-03T14:05:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.officialItemIds).toEqual([]);
    expect(snapshot.experimentalItemIds).toHaveLength(7);
    expect(snapshot.entries.every((entry) => entry.publicClaimAllowed === false)).toBe(true);
    expect(snapshot.entries.every((entry) => entry.mockDependent === false)).toBe(true);
  });
});
