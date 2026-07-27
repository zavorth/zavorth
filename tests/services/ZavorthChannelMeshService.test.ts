import { ZavorthChannelMeshService } from '../../src/services/ZavorthChannelMeshService.js';

describe('ZavorthChannelMeshService', () => {
  it('builds a channel mesh snapshot with runtime channels including slack readiness', () => {
    const service = new ZavorthChannelMeshService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelPolicyManager: {
        describePolicy: jest.fn((channelId: string) => {
          if (channelId === 'slack') {
            return {
              channelId,
              state: 'open',
              isOpenAccess: true,
              allowedCount: 0,
              blockedCount: 1,
              summary: 'Channel open with 1 explicit block.',
            };
          }
          if (channelId === 'whatsapp') {
            return {
              channelId,
              state: 'allowlist',
              isOpenAccess: false,
              allowedCount: 1,
              blockedCount: 0,
              summary: 'Canal restrito por allowlist com 1 identidade allowed.',
            };
          }
          if (channelId === 'instagram') {
            return {
              channelId,
              state: 'allowlist',
              isOpenAccess: false,
              allowedCount: 1,
              blockedCount: 0,
              summary: 'Canal restrito por allowlist com 1 identidade allowed.',
            };
          }
          return {
            channelId,
            state: 'closed',
            isOpenAccess: false,
            allowedCount: 0,
            blockedCount: 0,
            summary: 'Channel closed until allowlist or supervised open access is configured.',
          };
        }),
      } as any,
      channelAdapterRegistryService: {
        listAdapters: jest.fn(() => [
          {
            id: 'web',
            label: 'Web',
            readiness: 'ready',
            implementationState: 'full',
            configured: true,
            transport: 'virtual',
            notes: ['Canal web local.'],
            features: {
              inbound: true,
              outbound: true,
              sessionList: true,
              sessionHistory: true,
              sessionSend: true,
              sessionSpawn: true,
              attachments: false,
              threads: false,
              groupPolicy: false,
              identityHints: true,
            },
          },
          {
            id: 'discord',
            label: 'Discord',
            readiness: 'partial',
            implementationState: 'partial',
            configured: true,
            transport: 'local',
            notes: ['Bridge local presente.'],
            features: {
              inbound: true,
              outbound: true,
              sessionList: true,
              sessionHistory: true,
              sessionSend: true,
              sessionSpawn: false,
              attachments: true,
              threads: true,
              groupPolicy: true,
              identityHints: true,
            },
          },
          {
            id: 'whatsapp',
            label: 'WhatsApp',
            readiness: 'ready',
            implementationState: 'full',
            configured: true,
            transport: 'webhook',
            notes: ['WhatsApp Cloud API esta configurada e o runtime ja confirmou inbound/outbound oficial pelo webhook da Meta.'],
            features: {
              inbound: true,
              outbound: true,
              sessionList: true,
              sessionHistory: true,
              sessionSend: true,
              sessionSpawn: false,
              attachments: true,
              threads: false,
              groupPolicy: true,
              identityHints: true,
              richReplies: true,
              qrLogin: true,
            },
            loginQr: {
              supported: true,
              state: 'ready',
              source: 'test-session',
              dataUrl: null,
              expiresAt: null,
              updatedAt: '2026-04-02T12:00:00.000Z',
              nextStep: 'Exiba o QR para parear a session local supervisionada.',
            },
          },
          {
            id: 'slack',
            label: 'Slack',
            readiness: 'ready',
            implementationState: 'full',
            configured: true,
            transport: 'native',
            notes: ['Slack nactive esta configurado e o runtime ja confirmou outbound real pela Web API.'],
            features: {
              inbound: true,
              outbound: true,
              sessionList: true,
              sessionHistory: true,
              sessionSend: true,
              sessionSpawn: false,
              attachments: true,
              threads: true,
              groupPolicy: true,
              identityHints: true,
            },
          },
          {
            id: 'instagram',
            label: 'Instagram',
            readiness: 'ready',
            implementationState: 'full',
            configured: true,
            transport: 'webhook',
            notes: ['Runtime do Instagram preparado para Meta Instagram Messaging API.'],
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
              webhook: true,
              richReplies: true,
            },
            webhookPath: '/api/webhooks/instagram',
            provider: 'instagram-messaging-api',
            setupMode: 'meta-messaging',
          },
        ]),
        getAdapter: jest.fn(),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.total).toBe(5);
    expect(snapshot.summary.ready).toBe(4);
    expect(snapshot.summary.partial).toBe(1);
    expect(snapshot.summary.planned).toBe(0);
    expect(snapshot.summary.sessionSendReady).toBe(5);
    expect(snapshot.summary.liveReady).toBe(4);
    expect(snapshot.summary.defaultRouteAllowed).toBe(4);
    expect(snapshot.liveCompletion).toEqual(expect.objectContaining({
      channelSelectionRequiresLiveProof: true,
      catalogSupportIsNotLiveProof: true,
      sensitiveActionsRequireLiveProof: true,
    }));
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'web',
          source: 'runtime',
          liveReady: true,
          readinessProof: 'health',
          defaultRouteAllowed: true,
          actions: expect.arrayContaining([
            expect.objectContaining({ kind: 'inspect' }),
            expect.objectContaining({ kind: 'policy' }),
          ]),
        }),
        expect.objectContaining({
          id: 'discord',
          source: 'runtime',
          liveReady: false,
          readinessProof: 'catalog',
          defaultRouteAllowed: false,
          actions: expect.arrayContaining([
            expect.objectContaining({ kind: 'broadcast-test' }),
            expect.objectContaining({ kind: 'prepare' }),
          ]),
        }),
        expect.objectContaining({
          id: 'whatsapp',
          source: 'runtime',
          liveReady: true,
          defaultRouteAllowed: true,
          summary: 'Canal operacional via WhatsApp Cloud API, com webhook e outbound reais no mesh.',
          policy: expect.objectContaining({
            state: 'allowlist',
          }),
          tags: expect.arrayContaining(['policy-allowlist']),
          actions: expect.arrayContaining([
            expect.objectContaining({ kind: 'status' }),
            expect.objectContaining({ kind: 'broadcast-test' }),
            expect.objectContaining({ kind: 'login-qr' }),
          ]),
          statusRows: expect.arrayContaining([
            expect.objectContaining({
              label: 'Readiness',
              value: 'ready',
            }),
          ]),
        }),
        expect.objectContaining({
          id: 'slack',
          source: 'runtime',
          liveReady: true,
          defaultRouteAllowed: true,
          summary: 'Canal operacional via Slack Web API, com inbound por webhook e outbound real.',
          policy: expect.objectContaining({
            state: 'open',
          }),
          tags: expect.arrayContaining(['policy-open']),
          actions: expect.arrayContaining([
            expect.objectContaining({ kind: 'broadcast-test' }),
          ]),
        }),
        expect.objectContaining({
          id: 'instagram',
          source: 'runtime',
          summary: 'Canal operacional via Instagram Messaging API, com webhook e outbound reais no mesh.',
          policy: expect.objectContaining({
            state: 'allowlist',
          }),
          tags: expect.arrayContaining(['policy-allowlist']),
          actions: expect.arrayContaining([
            expect.objectContaining({ kind: 'status' }),
            expect.objectContaining({ kind: 'broadcast-test' }),
          ]),
        }),
      ]),
    );
    expect(snapshot.narrative.headline).toContain('Channel Mesh');
    expect(snapshot.entries.find((entry) => entry.id === 'whatsapp')?.actionHint).toContain('/api/webhooks/whatsapp');
    expect(snapshot.entries.find((entry) => entry.id === 'slack')?.actionHint).toContain('/api/webhooks/slack');
    expect(snapshot.entries.find((entry) => entry.id === 'instagram')?.actionHint).toContain('/api/webhooks/instagram');
    expect(snapshot.entries.find((entry) => entry.id === 'slack')?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'policy-reload',
          command: '/channels policy-reload slack',
        }),
      ]),
    );
    expect(snapshot.entries.find((entry) => entry.id === 'web')?.actions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'policy-reload' }),
      ]),
    );
  });

  it('synthesizes a visible WhatsApp QR state before the operator requests one', () => {
    const service = new ZavorthChannelMeshService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelPolicyManager: null,
      channelAdapterRegistryService: {
        listAdapters: jest.fn(() => [
          {
            id: 'whatsapp',
            label: 'WhatsApp',
            readiness: 'ready',
            implementationState: 'full',
            configured: true,
            transport: 'local',
            notes: [],
            features: {
              inbound: true,
              outbound: true,
              sessionList: true,
              sessionHistory: true,
              sessionSend: true,
              sessionSpawn: false,
              attachments: true,
              threads: false,
              groupPolicy: true,
              identityHints: true,
              qrLogin: true,
              richReplies: true,
            },
          },
        ]),
        getAdapter: jest.fn(),
      } as any,
    });

    const whatsapp = service.buildSnapshot({ selectedId: 'whatsapp' }).selected;

    expect(whatsapp?.loginQr).toEqual(expect.objectContaining({
      supported: true,
      state: 'not_requested',
      dataUrl: null,
    }));
    expect(whatsapp?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'login-qr',
        command: '/channels login-qr whatsapp',
      }),
    ]));
  });

  it('reloads channel policies through the existing mesh control plane', async () => {
    const reloadPolicies = jest.fn(async () => ({
      actor: 'operator-1',
      reason: 'manual-refresh',
      reloadedAt: '2026-04-02T12:01:00.000Z',
      source: 'env-defaults',
      cacheWindowMs: 1000,
      previousUpdatedAt: '2026-04-02T12:00:00.000Z',
      nextUpdatedAt: '2026-04-02T12:01:00.000Z',
      previousPolicyCount: 1,
      nextPolicyCount: 1,
      changedChannels: ['slack'],
    }));
    const service = new ZavorthChannelMeshService({
      now: () => new Date('2026-04-02T12:01:00.000Z'),
      channelPolicyManager: {
        reloadPolicies,
        describePolicy: jest.fn((channelId: string) => ({
          channelId,
          state: 'allowlist',
          isOpenAccess: false,
          allowedCount: 2,
          blockedCount: 0,
          summary: 'Canal restrito por allowlist com 2 identidades alloweds.',
        })),
      } as any,
      channelAdapterRegistryService: {
        listAdapters: jest.fn(() => [
          {
            id: 'slack',
            label: 'Slack',
            readiness: 'ready',
            implementationState: 'full',
            configured: true,
            transport: 'native',
            notes: ['Slack nactive esta configurado.'],
            features: {
              inbound: true,
              outbound: true,
              sessionList: true,
              sessionHistory: true,
              sessionSend: true,
              sessionSpawn: false,
              attachments: true,
              threads: true,
              groupPolicy: true,
              identityHints: true,
            },
          },
        ]),
        getAdapter: jest.fn(),
      } as any,
    });

    const result = await service.reloadChannelPolicies({
      selectedId: 'slack',
      actor: 'operator-1',
      reason: 'manual-refresh',
    });

    expect(reloadPolicies).toHaveBeenCalledWith({
      actor: 'operator-1',
      reason: 'manual-refresh',
    });
    expect(result.receipt.changedChannels).toEqual(['slack']);
    expect(result.snapshot.selected?.id).toBe('slack');
    expect(result.snapshot.selected?.policy?.state).toBe('allowlist');
  });
});
