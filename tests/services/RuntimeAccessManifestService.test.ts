import {
  RuntimeAccessManifestService,
  type RuntimeAccessManifest,
} from '../../src/runtime/access/RuntimeAccessManifestService.js';
import type { RuntimeAccessReadinessReport } from '../../src/runtime/access/RuntimeAccessReadinessService.js';

describe('RuntimeAccessManifestService', () => {
  it('builds an operator-friendly manifest from readiness data', async () => {
    const readiness: RuntimeAccessReadinessReport = {
      checkedAt: '2026-04-02T12:00:00.000Z',
      runtime: {
        hostSupervisor: {
          active: true,
          pid: 100,
          owner: 'dev',
          startedAt: '2026-04-02T11:58:00.000Z',
          alive: true,
        },
        telegramWorker: {
          active: true,
          pid: 101,
          owner: 'dev',
          startedAt: '2026-04-02T11:58:30.000Z',
          alive: true,
        },
        discordBridge: {
          mode: 'native',
          enabled: true,
          started: true,
          allowDirectMessages: true,
          allowedGuildIds: ['guild-001'],
          pendingInbox: 0,
          pendingOutbox: 0,
          lastError: null,
          updatedAt: null,
        },
        tenants: {
          file: 'C:/runtime/tenants.json',
          totalTenants: 1,
          activeTenants: 1,
          pendingOnboardingCount: 0,
          pendingOnboarding: [],
          blockedTenants: [],
          lastUpdatedAt: '2026-04-02T11:59:00.000Z',
        },
        dashboard: {
          active: true,
          pid: 102,
          host: '127.0.0.1',
          port: 33333,
          url: 'http://127.0.0.1:33333',
          startedAt: '2026-04-02T11:59:00.000Z',
          updatedAt: '2026-04-02T11:59:30.000Z',
        },
        hostAuthorized: true,
        firstRun: false,
      },
      auth: {
        enabled: true,
        source: 'env',
        tokenFile: 'C:/runtime/web-token.txt',
      },
      local: {
        baseUrl: 'http://127.0.0.1:33333',
        dashboardUrl: 'http://127.0.0.1:33333/',
        appUrl: 'http://127.0.0.1:33333/dashboard',
        ready: true,
        issues: [],
      },
      remote: {
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
        ready: true,
        issues: [],
      },
      recommendations: ['Use o /dashboard local como surface principal para operar e approve o Zavorth.'],
      nextSteps: [
        {
          id: 'connect-remote-frontend',
          title: 'Conectar o frontend remoto',
          description: 'Abra o app publicdo e conecte ao runtime.',
          blocking: false,
        },
      ],
      summary: 'Zavorth ready for local and remote use.',
    };

    const service = new RuntimeAccessManifestService({
      inspectLive: jest.fn().mockResolvedValue(readiness),
    } as any, {
      inspect: jest.fn().mockResolvedValue({
        summary: 'Official remote rollout ready and validated.',
        remote: {
          ready: true,
          baseUrl: 'https://zavorth.example.com',
          appUrl: 'https://zavorth.example.com/zavorthControl',
          issues: [],
        },
        rollout: {
          recommendedId: null,
        },
        actions: {
          recommendedAction: null,
          go: {
            command: 'npm run ops:remote:go',
          },
        },
        nextSteps: ['Abra o app remoto oficial.'],
      }),
    } as any);

    const manifest: RuntimeAccessManifest = await service.buildManifest();

    expect(manifest).toEqual(
      expect.objectContaining({
        generatedAt: readiness.checkedAt,
        summary: readiness.summary,
        local: expect.objectContaining({
          ready: true,
          baseUrl: 'http://127.0.0.1:33333',
          appUrl: 'http://127.0.0.1:33333/dashboard',
          apiBaseUrl: 'http://127.0.0.1:33333/api/web',
          controlUrl: 'http://127.0.0.1:33333/dashboard',
          legacyAppUrl: null,
          classicUrl: null,
        }),
        remote: expect.objectContaining({
          ready: true,
          baseUrl: 'https://zavorth.example.com',
          appUrl: 'https://zavorth.example.com/zavorthControl',
          requiresHttps: false,
          controlUrl: 'https://zavorth.example.com/zavorthControl',
          legacyAppUrl: null,
          classicUrl: null,
        }),
        auth: expect.objectContaining({
          required: true,
          source: 'env',
          tokenFile: 'C:/runtime/web-token.txt',
          authorizedHost: true,
        }),
        officialRemote: expect.objectContaining({
          ready: true,
          summary: 'Official remote rollout ready and validated.',
          recommendedProvider: null,
          recommendedAction: null,
          appUrl: 'https://zavorth.example.com/zavorthControl',
          baseUrl: 'https://zavorth.example.com',
          issues: [],
          nextSteps: ['Abra o app remoto oficial.'],
          command: 'zavorth go',
        }),
        recommendedPlan: expect.objectContaining({
          primaryAction: 'open-local',
          primaryLabel: 'Abrir Dashboard',
          primaryCommand: null,
          openTarget: 'http://127.0.0.1:33333/dashboard',
          launcherRecommendation: expect.objectContaining({
            command: 'npm run launcher:startup:install',
          }),
          remoteRecommendation: expect.objectContaining({
            ready: true,
            command: 'zavorth go',
            appUrl: 'https://zavorth.example.com/zavorthControl',
          }),
        }),
        commands: expect.objectContaining({
          go: 'zavorth go',
          install: 'npm run ops:install -- --trust-local --launcher --open-best',
          launcher: 'npm run launcher:install',
          startupLauncher: 'npm run launcher:startup:install',
          startupLauncherRemove: 'npm run launcher:startup:remove',
          bootstrap: 'npm run ops:bootstrap -- --repair',
          journey: 'npm run ops:journey',
          start: 'npm run ops:start',
          access: 'npm run ops:access',
          remote: 'npm run ops:remote:official',
          remoteGo: 'npm run ops:remote:go',
          manifest: 'npm run ops:manifest',
          trust: '/hostauth trust',
        }),
        launchers: expect.arrayContaining([
          expect.objectContaining({
            id: 'best',
            label: 'Abrir Dashboard',
            kind: 'url',
            value: 'http://127.0.0.1:33333/dashboard',
            ready: true,
            primary: true,
          }),
          expect.objectContaining({
            id: 'remote-control',
            label: 'Dashboard remota',
            kind: 'url',
            value: 'https://zavorth.example.com/zavorthControl',
            ready: true,
          }),
          expect.objectContaining({
            id: 'telegram',
            label: 'Telegram',
            kind: 'command',
            value: '/start',
            ready: true,
          }),
          expect.objectContaining({
            id: 'discord',
            label: 'Discord',
            kind: 'command',
            value: '/status',
            ready: true,
          }),
        ]),
        journey: expect.arrayContaining([
          expect.objectContaining({
            id: 'go',
            title: 'Atalho oficial em um comando',
            status: 'ready',
          }),
          expect.objectContaining({
            id: 'install',
            title: 'Instalar e reparar o ambiente',
            status: 'ready',
          }),
          expect.objectContaining({
            id: 'remote',
            title: 'Conectar uma surface remota',
            status: 'ready',
          }),
        ]),
        surfaces: expect.arrayContaining([
          expect.objectContaining({
            id: 'control',
            label: 'Dashboard',
            entry: 'http://127.0.0.1:33333/dashboard',
            remoteEntry: 'https://zavorth.example.com/zavorthControl',
            ready: true,
          }),
          expect.objectContaining({
            id: 'telegram',
            label: 'Telegram',
            entry: '/start',
            ready: true,
          }),
          expect.objectContaining({
            id: 'discord',
            label: 'Discord',
            entry: '/status',
            ready: true,
          }),
        ]),
        legacyContainment: expect.objectContaining({
          canonicalEntry: '/zavorthControl',
          frozenSurfaces: [],
          retiredSurfaces: ['/app', '/classic'],
          policy: expect.objectContaining({
            legacyFeatureFreeze: false,
            legacyRoutesRetired: true,
            compatibilityPreserved: false,
            fallbackPreserved: false,
          }),
          links: expect.objectContaining({
            localControlUrl: 'http://127.0.0.1:33333/dashboard',
            localLegacyAppUrl: null,
            remoteControlUrl: 'https://zavorth.example.com/zavorthControl',
            remoteLegacyAppUrl: null,
          }),
        }),
        nextSteps: readiness.nextSteps,
      }),
    );
    expect(manifest.guides.local[0]).toContain('zavorth go');
    expect(manifest.guides.local[1]).toContain('npm run ops:journey');
    expect(manifest.guides.local[2]).toContain('web-only');
    expect(manifest.guides.local[3]).toContain('/app e /classic foram removidas');
    expect(manifest.guides.local[4]).toContain('npm run setup:channels');
    expect(manifest.guides.local[4]).toContain('Telegram');
    expect(manifest.guides.local[5]).toContain('npm run channels:install -- --json');
    expect(manifest.guides.local[6]).toContain('zavorth go');
    expect(manifest.guides.local[7]).toContain('http://127.0.0.1:33333/dashboard');
    expect(manifest.guides.local.some((entry) => entry.includes('Startup oficial e opcional'))).toBe(true);
    expect(manifest.guides.local.some((entry) => entry.includes('/status'))).toBe(true);
    expect(manifest.guides.remote.some((entry) => entry.includes('npm run ops:journey'))).toBe(true);
    expect(manifest.guides.remote.some((entry) => entry.includes('web-first') || entry.includes('Telegram'))).toBe(true);
    expect(manifest.guides.remote.some((entry) => entry.includes('zavorth go'))).toBe(true);
    expect(manifest.guides.remote.some((entry) => entry.includes('https://zavorth.example.com'))).toBe(true);
    expect(manifest.guides.remote.some((entry) => entry.includes('Discord') || entry.includes('/status'))).toBe(true);
    expect(manifest.warnings).toEqual([]);
  });

  it('treats the official remote path as ready when readiness already confirms the remote app', () => {
    const readiness: RuntimeAccessReadinessReport = {
      checkedAt: '2026-04-06T17:05:00.000Z',
      runtime: {
        hostSupervisor: { active: true, pid: 1, owner: 'dev', startedAt: null, alive: true },
        telegramWorker: { active: true, pid: 2, owner: 'dev', startedAt: null, alive: true },
        discordBridge: {
          mode: 'native',
          enabled: true,
          started: true,
          allowDirectMessages: false,
          allowedGuildIds: ['guild-001'],
          pendingInbox: 0,
          pendingOutbox: 0,
          lastError: null,
          updatedAt: null,
        },
        tenants: {
          file: 'C:/runtime/tenants.json',
          totalTenants: 1,
          activeTenants: 1,
          pendingOnboardingCount: 0,
          pendingOnboarding: [],
          blockedTenants: [],
          lastUpdatedAt: null,
        },
        dashboard: {
          active: true,
          pid: 3,
          host: '127.0.0.1',
          port: 33333,
          url: 'http://127.0.0.1:33333',
          startedAt: null,
          updatedAt: null,
        },
        hostAuthorized: true,
        firstRun: false,
      },
      auth: {
        enabled: true,
        source: 'env',
        tokenFile: 'C:/runtime/web-token.txt',
      },
      local: {
        baseUrl: 'http://127.0.0.1:33333',
        dashboardUrl: 'http://127.0.0.1:33333/',
        appUrl: 'http://127.0.0.1:33333/dashboard',
        ready: true,
        issues: [],
      },
      remote: {
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
        ready: true,
        issues: [],
      },
      recommendations: [],
      nextSteps: [],
      summary: 'Zavorth ready for local and remote use.',
    };

    const service = new RuntimeAccessManifestService();
    const manifest = service.buildManifestFromReadiness(readiness);

    expect(manifest.officialRemote).toEqual(
      expect.objectContaining({
        ready: true,
        summary: 'Acesso remoto oficial ready.',
        appUrl: 'https://zavorth.example.com/zavorthControl',
      }),
    );
    expect(manifest.recommendedPlan).toEqual(
      expect.objectContaining({
        primaryAction: 'open-local',
        primaryCommand: null,
        openTarget: 'http://127.0.0.1:33333/dashboard',
        remoteRecommendation: expect.objectContaining({
          ready: true,
        }),
      }),
    );
  });

  it('keeps the best launcher command-based when the next official step is still ops:go', () => {
    const readiness: RuntimeAccessReadinessReport = {
      checkedAt: '2026-04-06T17:10:00.000Z',
      runtime: {
        hostSupervisor: { active: true, pid: 1, owner: 'dev', startedAt: null, alive: true },
        telegramWorker: { active: true, pid: 2, owner: 'dev', startedAt: null, alive: true },
        discordBridge: {
          mode: 'native',
          enabled: false,
          started: false,
          allowDirectMessages: false,
          allowedGuildIds: [],
          pendingInbox: 0,
          pendingOutbox: 0,
          lastError: null,
          updatedAt: null,
        },
        tenants: {
          file: 'C:/runtime/tenants.json',
          totalTenants: 1,
          activeTenants: 1,
          pendingOnboardingCount: 0,
          pendingOnboarding: [],
          blockedTenants: [],
          lastUpdatedAt: null,
        },
        dashboard: {
          active: true,
          pid: 3,
          host: '127.0.0.1',
          port: 33333,
          url: 'http://127.0.0.1:33333',
          startedAt: null,
          updatedAt: null,
        },
        hostAuthorized: true,
        firstRun: false,
      },
      auth: {
        enabled: true,
        source: 'env',
        tokenFile: 'C:/runtime/web-token.txt',
      },
      local: {
        baseUrl: 'http://127.0.0.1:33333',
        dashboardUrl: 'http://127.0.0.1:33333/',
        appUrl: 'http://127.0.0.1:33333/dashboard',
        ready: false,
        issues: ['The Zavorth web surface did not respond at http://127.0.0.1:33333/dashboard.'],
      },
      remote: {
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
        ready: false,
        issues: ['A URL public ainda was not validada.'],
      },
      recommendations: [],
      nextSteps: [
        {
          id: 'recover-web-surface',
          title: 'Recuperar a surface web',
          description: 'Reinicie o runtime supervisionado antes de operar.',
          blocking: true,
        },
      ],
      summary: 'Zavorth is not ready for consistent use yet.',
    };

    const service = new RuntimeAccessManifestService();
    const manifest = service.buildManifestFromReadiness(readiness);

    expect(manifest.recommendedPlan).toEqual(
      expect.objectContaining({
        primaryAction: 'go',
        primaryCommand: 'zavorth go',
      }),
    );
    expect(manifest.launchers[0]).toEqual(
      expect.objectContaining({
        kind: 'command',
        value: 'zavorth go',
        ready: false,
      }),
    );
  });

  it('surfaces stale health as warnings and keeps dormant Discord non-blocking', () => {
    const readiness = {
      checkedAt: '2026-04-10T09:00:00.000Z',
      runtime: {
        hostSupervisor: { active: true, pid: 1, owner: 'dev', startedAt: null, alive: true },
        telegramWorker: { active: true, pid: 2, owner: 'dev', startedAt: null, alive: true },
        discordBridge: {
          mode: 'native',
          enabled: true,
          started: false,
          allowDirectMessages: false,
          allowedGuildIds: [],
          pendingInbox: 0,
          pendingOutbox: 0,
          lastError: 'Gateway nactive ainda inicializando.',
          updatedAt: null,
        },
        tenants: {
          file: 'C:/runtime/tenants.json',
          totalTenants: 1,
          activeTenants: 1,
          pendingOnboardingCount: 0,
          pendingOnboarding: [],
          blockedTenants: [],
          lastUpdatedAt: null,
        },
        dashboard: {
          active: true,
          pid: 3,
          host: '127.0.0.1',
          port: 33333,
          url: 'http://127.0.0.1:33333',
          startedAt: null,
          updatedAt: null,
        },
        nodeMeshSmoke: {
          status: 'passed',
          stale: true,
        },
        systemOverlordSmoke: {
          status: 'missing',
          stale: false,
        },
        channelProviderDoctor: {
          status: 'missing',
          stale: false,
        },
        remoteTransportDoctor: {
          status: 'missing',
          stale: false,
        },
        hostAuthorized: true,
        firstRun: false,
      },
      auth: {
        enabled: true,
        source: 'env',
        tokenFile: 'C:/runtime/web-token.txt',
      },
      local: {
        baseUrl: 'http://127.0.0.1:33333',
        dashboardUrl: 'http://127.0.0.1:33333/',
        appUrl: 'http://127.0.0.1:33333/dashboard',
        ready: true,
        issues: [],
      },
      remote: {
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
        ready: true,
        issues: [],
      },
      recommendations: [],
      nextSteps: [],
      summary: 'Zavorth is ready for local use with operational warnings.',
    } as RuntimeAccessReadinessReport;

    const service = new RuntimeAccessManifestService();
    const manifest = service.buildManifestFromReadiness(readiness);

    expect(manifest.guides.local).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Existem 1 check(s) de health com renovaction leve recomendada'),
      ]),
    );
    expect(manifest.guides.remote).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Existem 1 check(s) de health com renovaction leve recomendada'),
      ]),
    );
    expect(manifest.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Existem 1 check(s) de health com renovaction leve recomendada'),
      ]),
    );
  });
});


