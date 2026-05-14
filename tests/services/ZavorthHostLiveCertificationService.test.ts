import { ZavorthHostLiveCertificationService } from '../../src/services/ZavorthHostLiveCertificationService';

const NOW = new Date('2026-05-10T12:00:00.000Z');

describe('ZavorthHostLiveCertificationService', () => {
  it('keeps contract-ready separate from production live', () => {
    const service = buildService({
      meshEntries: [
        channel({
          id: 'whatsapp',
          label: 'WhatsApp',
          readiness: 'ready',
          implementationState: 'full',
          configured: false,
          transport: 'local',
          provider: 'local-provider',
          lastHealth: 'unknown',
          policyAllowedCount: 0,
        }),
      ],
      contractEntries: [
        contractEntry('whatsapp', 'certified'),
      ],
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-host-live-certification.v1');
    expect(snapshot.summary.productionLiveCertified).toBe(false);
    expect(snapshot.entries[0]).toEqual(expect.objectContaining({
      channelId: 'whatsapp',
      contractReady: true,
      productionLiveReady: false,
      status: 'contract-only',
    }));
    expect(snapshot.entries[0].blockers.join('\n')).toContain('Provider real configurado');
  });

  it('certifies a channel as live-ready only with provider and recipients', () => {
    const service = buildService({
      meshEntries: [
        channel({
          id: 'telegram',
          label: 'Telegram',
          readiness: 'ready',
          implementationState: 'full',
          configured: true,
          transport: 'native',
          provider: 'telegram-bot-api',
          lastHealth: 'passed',
          policyAllowedCount: 2,
        }),
      ],
      contractEntries: [
        contractEntry('telegram', 'certified'),
      ],
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.productionLiveCertified).toBe(true);
    expect(snapshot.summary.liveReady).toBe(1);
    expect(snapshot.entries[0]).toEqual(expect.objectContaining({
      status: 'live-ready',
      providerConfigured: true,
      recipientsBounded: true,
      outboundAllowed: true,
    }));
  });

  it('marks stubs and partials explicitly without masking them as live', () => {
    const service = buildService({
      meshEntries: [
        channel({
          id: 'signal',
          label: 'Signal',
          readiness: 'partial',
          implementationState: 'partial',
          configured: true,
          transport: 'bridge',
          provider: 'signal-cli',
          lastHealth: 'passed',
          policyAllowedCount: 1,
        }),
      ],
      contractEntries: [
        contractEntry('signal', 'certified'),
      ],
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.stubOrPartial).toBe(1);
    expect(snapshot.entries[0]).toEqual(expect.objectContaining({
      status: 'stub-or-partial',
      stubOrPartial: true,
      productionLiveReady: false,
    }));
  });
});

function buildService(input: {
  meshEntries: any[];
  contractEntries: any[];
}): ZavorthHostLiveCertificationService {
  return new ZavorthHostLiveCertificationService({
    now: () => NOW,
    channelMeshService: {
      buildSnapshot: () => ({
        generatedAt: NOW.toISOString(),
        summary: {
          total: input.meshEntries.length,
          ready: input.meshEntries.filter((entry) => entry.readiness === 'ready').length,
          partial: input.meshEntries.filter((entry) => entry.readiness === 'partial').length,
          planned: 0,
          disabled: 0,
          configured: input.meshEntries.filter((entry) => entry.configured).length,
          sessionSendReady: input.meshEntries.length,
          attachments: 0,
          groupPolicy: input.meshEntries.length,
        },
        entries: input.meshEntries,
        selected: input.meshEntries[0] || null,
        featuredIds: input.meshEntries.map((entry) => entry.id),
        narrative: {
          headline: 'fixture',
          operatorSummary: 'fixture',
        },
      }) as any,
    },
    channelExperienceCertificationService: {
      buildSnapshot: () => ({
        generatedAt: NOW.toISOString(),
        contractVersion: 'channel-experience-certification.v1',
        profile: 'fixture',
        summary: {
          total: input.contractEntries.length,
          certified: input.contractEntries.filter((entry) => entry.status === 'certified').length,
          usable: 0,
          partial: 0,
          missing: 0,
          blockers: 0,
          requiredPassed: 10,
          requiredTotal: 10,
          releaseReady: true,
        },
        entries: input.contractEntries,
        selected: null,
        smokePlan: {},
        dashboardEvidence: { status: 'contract-ready', routes: [] },
        narrative: {
          headline: 'fixture',
          operatorSummary: 'fixture',
          nextAction: 'fixture',
        },
      }) as any,
    },
  });
}

function contractEntry(channelId: string, status: string) {
  return {
    channelId,
    label: channelId,
    status,
    readiness: 'ready',
    transport: 'native',
    implementationState: 'full',
    score: { passed: 1, required: 1, percent: 100 },
    checks: [],
    blockers: [],
    referenceBaseline: [],
    zavorthEvidence: [],
    smokeCommands: [],
    summary: 'ok',
  };
}

function channel(input: {
  id: string;
  label: string;
  readiness: string;
  implementationState: string;
  configured: boolean;
  transport: string;
  provider: string;
  lastHealth: string;
  policyAllowedCount: number;
}) {
  return {
    ...input,
    notes: [],
    setupMode: input.provider,
    webhookPath: input.transport === 'webhook' ? `/api/webhooks/${input.id}` : null,
    features: {
      inbound: true,
      outbound: true,
      sessionList: true,
      sessionHistory: true,
      sessionSend: true,
      sessionSpawn: false,
      attachments: false,
      threads: false,
      groupPolicy: true,
      identityHints: true,
      webhook: input.transport === 'webhook',
      localBridge: input.transport === 'bridge',
      doctor: true,
      interactiveControls: true,
      slashCommands: true,
      richReplies: true,
      qrLogin: false,
    },
    source: 'runtime',
    summary: 'fixture',
    operatorSummary: 'fixture',
    actionHint: 'fixture',
    tags: [],
    actions: [],
    policy: {
      channelId: input.id,
      state: input.policyAllowedCount > 0 ? 'allowlist' : 'closed',
      isOpenAccess: false,
      allowedCount: input.policyAllowedCount,
      blockedCount: 0,
      summary: 'fixture',
    },
  };
}
