import { ZavorthLiveReadinessEvidenceProofPackService } from '../../src/services/ZavorthLiveReadinessEvidenceProofPackService.js';

const providerMatrix = {
  summary: {
    total: 2,
    liveReady: 1,
    defaultRouteAllowed: 1,
    catalogReadyButNotLive: 1,
    blocked: 0,
  },
  entries: [
    {
      id: 'ready-live',
      status: 'ready',
      liveReady: true,
      defaultRouteAllowed: true,
    },
    {
      id: 'catalog-only',
      status: 'ready',
      liveReady: false,
      defaultRouteAllowed: false,
    },
  ],
  liveCompletion: {
    catalogSupportIsNotLiveProof: true,
    providerSelectionRequiresLiveProof: true,
    defaultRoutingPolicy: 'ready-and-live-proof',
  },
  nextAction: 'Run explicit provider tests before setting defaults.',
};

const channelMesh = {
  summary: {
    total: 2,
    liveReady: 1,
    defaultRouteAllowed: 1,
    catalogReadyButNotLive: 1,
    disabled: 0,
  },
  entries: [
    {
      id: 'telegram',
      readiness: 'ready',
      liveReady: true,
      defaultRouteAllowed: true,
    },
    {
      id: 'whatsapp',
      readiness: 'ready',
      liveReady: false,
      defaultRouteAllowed: false,
    },
  ],
  liveCompletion: {
    catalogSupportIsNotLiveProof: true,
    channelSelectionRequiresLiveProof: true,
    defaultRoutingPolicy: 'ready-and-live-proof',
  },
  narrative: {
    operatorSummary: 'Run channel doctors before live sends.',
  },
};

const smokeProof = {
  summary: {
    providers: 2,
    providerSmokeProofs: 2,
    providerBlocked: 0,
    channels: 2,
    channelSmokeProofs: 2,
    channelBlocked: 0,
    receipts: 4,
    liveExternalCallRequired: false,
    liveChannelSendRequired: false,
    secretValuesSerialized: false,
  },
  policy: {
    noProviderNetworkCalls: true,
    noLiveChannelSends: true,
    noSecretsSerialized: true,
  },
};

const terminalBackends = {
  backends: [
    {
      id: 'local',
      label: 'Local supervised shell',
      status: 'ready',
      isolation: 'host-process',
      liveCapable: true,
      liveReady: true,
      requiresConfiguration: [],
      defaultCommand: 'zavorth execution-backends --backend local --command "npm test"',
      nextCommand: 'zavorth execution-backends --backend local --command "npm test" --live --approval-id <id>',
      limitations: ['host process only'],
    },
    {
      id: 'wsl',
      label: 'WSL',
      status: 'ready',
      isolation: 'linux-vm',
      liveCapable: true,
      liveReady: true,
      requiresConfiguration: [],
      defaultCommand: 'wsl.exe --status',
      nextCommand: 'zavorth execution-backends --backend wsl --command "npm test"',
      limitations: ['requires WSL on this host'],
    },
    {
      id: 'docker',
      label: 'Docker',
      status: 'needs-configuration',
      isolation: 'container',
      liveCapable: true,
      liveReady: false,
      requiresConfiguration: ['Docker Desktop or docker engine'],
      defaultCommand: 'docker version',
      nextCommand: 'zavorth execution-backends --backend docker --command "npm test"',
      limitations: ['docker is not configured in this fixture'],
    },
  ],
  safety: {
    noBackendLiveByDefault: true,
    cloudBackendsRequireExplicitConfiguration: true,
  },
};

describe('ZavorthLiveReadinessEvidenceProofPackService Certification matrix', () => {
  it('certifies provider and channel live readiness without false default routing', async () => {
    const snapshot = await new ZavorthLiveReadinessEvidenceProofPackService({
      now: () => new Date('2026-05-14T15:00:00.000Z'),
      providerMatrix: {
        buildLiveSnapshot: async () => providerMatrix as any,
      },
      channelMesh: {
        readChannels: () => channelMesh as any,
      },
      smokeProof: {
        buildSnapshot: () => smokeProof as any,
      },
      terminalBackends: {
        execute: () => terminalBackends as any,
      },
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.checkpoint-9-live-readiness-evidence-proof-pack');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.providerLiveReady).toBe(1);
    expect(snapshot.summary.providerDefaultRouteAllowed).toBe(1);
    expect(snapshot.summary.channelLiveReady).toBe(1);
    expect(snapshot.summary.channelDefaultRouteAllowed).toBe(1);
    expect(snapshot.summary.catalogReadyButNotLive).toBe(2);
    expect(snapshot.summary.backendLiveReady).toBe(2);
    expect(snapshot.summary.strongBackendLiveReady).toBe(1);
    expect(snapshot.summary.liveProofRequired).toBe(false);
    expect(snapshot.summary.providerNetworkUsed).toBe(false);
    expect(snapshot.summary.liveChannelSendPerformed).toBe(false);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.policy.catalogSupportIsNotLiveProof).toBe(true);
    expect(snapshot.policy.defaultRoutingRequiresLiveProof).toBe(true);
    expect(snapshot.policy.smokeProofDoesNotUseExternalIo).toBe(true);
    expect(snapshot.operationalClosure.status).toBe('live-proved');
    expect(snapshot.operationalClosure.canClaimOperationalClosure).toBe(true);
    expect(snapshot.entries.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'providers.live-readiness',
      'channels.live-readiness',
      'provider-channel.smoke-proof',
      'default-route.policy',
      'terminal-backends.strong-live-readiness',
    ]));
  });

  it('keeps a code-ready but live-proof-required verdict when provider proof is missing', async () => {
    const missingProviderLiveProof = {
      ...providerMatrix,
      summary: {
        ...providerMatrix.summary,
        liveReady: 0,
        defaultRouteAllowed: 0,
      },
      entries: providerMatrix.entries.map((entry) => ({
        ...entry,
        liveReady: false,
        defaultRouteAllowed: false,
      })),
    };

    const snapshot = await new ZavorthLiveReadinessEvidenceProofPackService({
      now: () => new Date('2026-05-14T15:00:00.000Z'),
      providerMatrix: {
        buildLiveSnapshot: async () => missingProviderLiveProof as any,
      },
      channelMesh: {
        readChannels: () => channelMesh as any,
      },
      smokeProof: {
        buildSnapshot: () => smokeProof as any,
      },
      terminalBackends: {
        execute: () => terminalBackends as any,
      },
    }).buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.liveProofRequired).toBe(true);
    expect(snapshot.operationalClosure.status).toBe('live-proof-required');
    expect(snapshot.operationalClosure.codeReady).toBe(true);
    expect(snapshot.operationalClosure.canClaimOperationalClosure).toBe(false);
    expect(snapshot.operationalClosure.requirements).toContainEqual(expect.objectContaining({
      id: 'provider.default-route-live-proof',
      status: 'attention',
    }));
    expect(snapshot.operationalClosure.nextCommands).toContain('zavorth providers live --provider <provider>');
  });
});
