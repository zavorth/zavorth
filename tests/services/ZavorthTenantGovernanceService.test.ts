import { ZavorthTenantGovernanceService } from '../../src/services/ZavorthTenantGovernanceService';

describe('ZavorthTenantGovernanceService', () => {
  it('builds a consolidated governance snapshot from the tenant registry', () => {
    const records = [
      {
        tenantId: 'discord-public',
        tenantType: 'guild',
        boundary: 'shared',
        isolationMode: 'tenant',
        onboardingStatus: 'pending_onboarding',
        platform: 'discord',
        policyProfile: 'discord-public',
        publicServerMode: true,
        scopeId: 'discord:1489',
        sessionId: null,
        guildId: '1489',
        channelId: null,
        threadId: null,
        sourceUserId: '956',
        runtimeUserId: '1',
        ownerUserIds: ['956'],
        allowedGuildIds: ['1489'],
        allowedChannelIds: [],
        firstSeenAt: '2026-04-03T15:40:00.000Z',
        lastSeenAt: '2026-04-03T16:05:00.000Z',
      },
      {
        tenantId: 'telegram-shared',
        tenantType: 'workspace',
        boundary: 'shared',
        isolationMode: 'tenant',
        onboardingStatus: 'internal',
        platform: 'telegram',
        policyProfile: 'runtime-default',
        publicServerMode: false,
        scopeId: 'telegram:ops',
        sessionId: null,
        guildId: null,
        channelId: null,
        threadId: null,
        sourceUserId: '956',
        runtimeUserId: '1',
        ownerUserIds: ['956'],
        allowedGuildIds: [],
        allowedChannelIds: ['telegram:ops'],
        firstSeenAt: '2026-04-03T14:20:00.000Z',
        lastSeenAt: '2026-04-03T16:04:00.000Z',
      },
      {
        tenantId: 'web-session-a',
        tenantType: 'session',
        boundary: 'personal',
        isolationMode: 'private',
        onboardingStatus: 'internal',
        platform: 'web',
        policyProfile: 'runtime-default',
        publicServerMode: false,
        scopeId: 'web:session-a',
        sessionId: 'session-a',
        guildId: null,
        channelId: null,
        threadId: null,
        sourceUserId: 'session-a',
        runtimeUserId: '1',
        ownerUserIds: [],
        allowedGuildIds: [],
        allowedChannelIds: [],
        firstSeenAt: '2026-04-03T15:10:00.000Z',
        lastSeenAt: '2026-04-03T16:03:00.000Z',
      },
    ] as any;

    const service = new ZavorthTenantGovernanceService({
      now: () => new Date('2026-04-03T16:10:00.000Z'),
      tenantRegistryService: {
        list: () => records,
        summarize: () => ({
          totalCount: 3,
          sharedCount: 2,
          personalCount: 1,
          pendingOnboardingCount: 1,
          publicServerCount: 1,
          byPlatform: {
            discord: 1,
            telegram: 1,
            web: 1,
          },
          recent: records,
          pendingOnboarding: [records[0]],
        }),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-04-03T16:10:00.000Z');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 3,
        shared: 2,
        personal: 1,
        pendingOnboarding: 1,
        publicServers: 1,
        readyShared: 1,
        restrictedShared: 0,
        byPlatform: expect.objectContaining({
          discord: 1,
          telegram: 1,
          web: 1,
        }),
      }),
    );
    expect(snapshot.tenants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'discord-public',
          governanceStatus: 'pending_onboarding',
          scopeLabel: 'guild:1489',
          nextAction: expect.stringContaining('canais permitidos'),
          recipe: expect.objectContaining({
            label: 'Close public tenant onboarding',
            actions: expect.arrayContaining([
              expect.objectContaining({
                command: '/channels',
              }),
              expect.objectContaining({
                command: '/teams',
              }),
            ]),
          }),
        }),
        expect.objectContaining({
          tenantId: 'telegram-shared',
          governanceStatus: 'ready',
          sessionId: null,
          runtimeUserId: '1',
          sourceUserId: '956',
          operatorSummary: expect.stringContaining('policy runtime-default'),
          actions: expect.arrayContaining([
            expect.objectContaining({
              command: '/teams',
              actionKind: 'guided',
            }),
            expect.objectContaining({
              command: '/sessions',
              actionKind: 'guided',
            }),
          ]),
        }),
        expect.objectContaining({
          tenantId: 'web-session-a',
          governanceStatus: 'personal',
          sessionId: 'session-a',
          runtimeUserId: '1',
          sourceUserId: 'session-a',
          operatorSummary: expect.stringContaining('Tenant pessoal'),
          actions: expect.arrayContaining([
            expect.objectContaining({
              command: '/memoryplane',
              actionKind: 'guided',
            }),
          ]),
          recipe: expect.objectContaining({
            label: 'Retomar tenant pessoal',
          }),
        }),
      ]),
    );
    expect(snapshot.pendingOnboarding).toEqual([
      expect.objectContaining({
        tenantId: 'discord-public',
      }),
    ]);
    expect(snapshot.featuredRecipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'discord-public',
          label: 'Close public tenant onboarding',
        }),
      ]),
    );
    expect(snapshot.narrative.headline).toContain('3 tenant(s)');
    expect(snapshot.narrative.operatorSummary).toContain('1 pendente(s) de onboarding');
  });
});
