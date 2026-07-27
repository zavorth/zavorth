import { RuntimeInstallJourneyService } from '../../src/runtime/access/RuntimeInstallJourneyService.js';
import type { RuntimeBootstrapRepairReport } from '../../src/services/RuntimeBootstrapRepairService';
import type { RuntimeStartupResult } from '../../src/services/RuntimeStartupService';

function buildRepairReport(overrides: Partial<RuntimeBootstrapRepairReport> = {}): RuntimeBootstrapRepairReport {
  return {
    startedAt: '2026-04-05T10:00:00.000Z',
    finishedAt: '2026-04-05T10:00:10.000Z',
    dryRun: false,
    initial: {
      checkedAt: '2026-04-05T10:00:00.000Z',
      projectRoot: 'C:/repo',
      env: {
        envFilePresent: true,
        llmProvider: 'gemini',
        llmCredentialReady: true,
        issues: [],
      },
      dependencies: {
        installRequired: false,
        buildRequired: false,
      },
      platforms: [],
      supervisedRuntime: {
        installRequired: false,
        buildRequired: false,
        accessReadiness: {
          checkedAt: '2026-04-05T10:00:00.000Z',
          runtime: {
            hostSupervisor: { active: true, pid: 1, owner: 'dev', startedAt: null, alive: true },
            telegramWorker: { active: true, pid: 2, owner: 'dev', startedAt: null, alive: true },
            discordBridge: { mode: 'unknown', enabled: false, started: false, allowDirectMessages: false, allowedGuildIds: [], pendingInbox: 0, pendingOutbox: 0, lastError: null, updatedAt: null },
            providers: {
              activeProviderName: 'gemini',
              activeModelName: 'gemini-2.5-pro',
              preferredZavorthBridgeModel: null,
              readyCount: 1,
              needsConfigurationCount: 0,
              needsProbeCount: 0,
              recommendedProfile: 'default',
              readyProviders: ['gemini'],
              pendingConfigProviders: [],
              probeProviders: [],
              recommendations: [],
            },
            mcp: {
              manifestPath: 'config/mcp-servers.json',
              summary: { total: 0, enabled: 0, connected: 0, failed: 0, disabled: 0, stopped: 0, toolCount: 0, capabilityCount: 0 },
              capabilities: [],
              recommendations: [],
            },
            tenants: {
              file: 'data/runtime/tenants.json',
              totalTenants: 0,
              activeTenants: 0,
              pendingOnboardingCount: 0,
              pendingOnboarding: [],
              blockedTenants: [],
              lastUpdatedAt: null,
            },
            dashboard: null,
            nodeMeshSmoke: {
              available: false,
              status: 'missing',
              checkedAt: null,
              summary: null,
              command: 'npm run test:nodes:smoke',
              file: 'data/runtime/node-mesh-smoke.json',
              nodeId: null,
              finalNodeStatus: null,
              recentCapabilityId: null,
              error: null,
              stale: false,
              ageMs: null,
              maxAgeMs: 0,
            },
            channelProviderDoctor: {
              available: false,
              status: 'missing',
              checkedAt: null,
              summary: null,
              command: 'npm run test:channels:smoke',
              file: 'data/runtime/channel-provider-doctor.json',
              stale: false,
              ageMs: null,
              maxAgeMs: 0,
              items: [],
            },
            remoteTransportDoctor: {
              available: false,
              status: 'missing',
              checkedAt: null,
              summary: null,
              command: 'npm run test:transports:smoke',
              file: 'data/runtime/remote-transport-doctor.json',
              stale: false,
              ageMs: null,
              maxAgeMs: 0,
              recommendedAction: null,
              items: [],
            },
            hostAuthorized: true,
            firstRun: false,
          },
          auth: {
            enabled: true,
            source: 'env',
            tokenFile: 'data/runtime/web-token.txt',
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
          summary: 'Zavorth is ready for local and remote use.',
        },
      },
      actions: [],
      summary: 'Bootstrap closed.',
    },
    steps: [],
    final: {
      checkedAt: '2026-04-05T10:00:10.000Z',
      projectRoot: 'C:/repo',
      env: {
        envFilePresent: true,
        llmProvider: 'gemini',
        llmCredentialReady: true,
        issues: [],
      },
      dependencies: {
        installRequired: false,
        buildRequired: false,
      },
      platforms: [],
      supervisedRuntime: {
        installRequired: false,
        buildRequired: false,
        accessReadiness: {
          checkedAt: '2026-04-05T10:00:10.000Z',
          runtime: {
            hostSupervisor: { active: true, pid: 1, owner: 'dev', startedAt: null, alive: true },
            telegramWorker: { active: true, pid: 2, owner: 'dev', startedAt: null, alive: true },
            discordBridge: { mode: 'unknown', enabled: false, started: false, allowDirectMessages: false, allowedGuildIds: [], pendingInbox: 0, pendingOutbox: 0, lastError: null, updatedAt: null },
            providers: {
              activeProviderName: 'gemini',
              activeModelName: 'gemini-2.5-pro',
              preferredZavorthBridgeModel: null,
              readyCount: 1,
              needsConfigurationCount: 0,
              needsProbeCount: 0,
              recommendedProfile: 'default',
              readyProviders: ['gemini'],
              pendingConfigProviders: [],
              probeProviders: [],
              recommendations: [],
            },
            mcp: {
              manifestPath: 'config/mcp-servers.json',
              summary: { total: 0, enabled: 0, connected: 0, failed: 0, disabled: 0, stopped: 0, toolCount: 0, capabilityCount: 0 },
              capabilities: [],
              recommendations: [],
            },
            tenants: {
              file: 'data/runtime/tenants.json',
              totalTenants: 0,
              activeTenants: 0,
              pendingOnboardingCount: 0,
              pendingOnboarding: [],
              blockedTenants: [],
              lastUpdatedAt: null,
            },
            dashboard: null,
            nodeMeshSmoke: {
              available: false,
              status: 'missing',
              checkedAt: null,
              summary: null,
              command: 'npm run test:nodes:smoke',
              file: 'data/runtime/node-mesh-smoke.json',
              nodeId: null,
              finalNodeStatus: null,
              recentCapabilityId: null,
              error: null,
              stale: false,
              ageMs: null,
              maxAgeMs: 0,
            },
            channelProviderDoctor: {
              available: false,
              status: 'missing',
              checkedAt: null,
              summary: null,
              command: 'npm run test:channels:smoke',
              file: 'data/runtime/channel-provider-doctor.json',
              stale: false,
              ageMs: null,
              maxAgeMs: 0,
              items: [],
            },
            remoteTransportDoctor: {
              available: false,
              status: 'missing',
              checkedAt: null,
              summary: null,
              command: 'npm run test:transports:smoke',
              file: 'data/runtime/remote-transport-doctor.json',
              stale: false,
              ageMs: null,
              maxAgeMs: 0,
              recommendedAction: null,
              items: [],
            },
            hostAuthorized: true,
            firstRun: false,
          },
          auth: {
            enabled: true,
            source: 'env',
            tokenFile: 'data/runtime/web-token.txt',
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
          summary: 'Zavorth is ready for local and remote use.',
        },
      },
      actions: [],
      summary: 'Bootstrap closed.',
    },
    summary: 'Safe corrections applied. Bootstrap closed.',
    ...overrides,
  } as any;
}

function buildStartupResult(overrides: Partial<RuntimeStartupResult> = {}): RuntimeStartupResult {
  return {
    ok: true,
    timedOut: false,
    attempts: 1,
    durationMs: 1000,
    readiness: buildRepairReport().final.supervisedRuntime.accessReadiness,
    manifest: {
      generatedAt: '2026-04-05T10:00:11.000Z',
      summary: 'Zavorth is ready for local and remote use.',
      local: {
        ready: true,
        baseUrl: 'http://127.0.0.1:33333',
        appUrl: 'http://127.0.0.1:33333/dashboard',
        dashboardUrl: 'http://127.0.0.1:33333/',
        apiBaseUrl: 'http://127.0.0.1:33333/api/web',
      },
      remote: {
        ready: true,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
        requiresHttps: false,
      },
      auth: {
        required: true,
        source: 'env',
        tokenFile: 'data/runtime/web-token.txt',
        authorizedHost: true,
      },
      officialRemote: {
        ready: true,
        summary: 'Official remote access ready and validated.',
        recommendedProvider: null,
        recommendedAction: null,
        appUrl: 'https://zavorth.example.com/zavorthControl',
        baseUrl: 'https://zavorth.example.com',
        issues: [],
        nextSteps: [],
        command: 'npm run ops:remote:go',
      },
      commands: {
        go: 'npm run ops:go',
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
      },
      journey: [],
      surfaces: [],
      guides: {
        local: [],
        remote: [],
      },
      warnings: [],
      nextSteps: [],
      recommendedPlan: {
        primaryAction: 'open-local',
          primaryLabel: 'Abrir shell web do runtime',
          primarySummary: 'Dashboard ready em http://127.0.0.1:33333/dashboard.',
        primaryCommand: null,
        openTarget: 'http://127.0.0.1:33333/dashboard',
        launcherRecommendation: {
          command: 'npm run launcher:startup:install',
          summary: 'Official Windows startup is optional and blocked by policy. Enable it consciously only if you really want automatic login.',
        },
        remoteRecommendation: {
          ready: true,
          command: 'npm run ops:remote:go',
          appUrl: 'https://zavorth.example.com/zavorthControl',
          summary: 'Official remote access ready and validated.',
          nextSteps: [],
        },
      },
    },
    summary: 'Zavorth is ready for local and remote use.',
    ...overrides,
  } as any;
}

describe('RuntimeInstallJourneyService', () => {
  it('runs repair and startup in sequence', async () => {
    const repairService = {
      repairLive: jest.fn().mockResolvedValue(buildRepairReport()),
    };
    const startupService = {
      startAndWait: jest.fn().mockResolvedValue(buildStartupResult()),
    };

    const service = new RuntimeInstallJourneyService({
      repairService,
      startupService,
      now: () => new Date('2026-04-05T10:00:00.000Z'),
      platform: 'linux',
    });

    const report = await service.run({ timeoutMs: 1234, pollIntervalMs: 321 });

    expect(repairService.repairLive).toHaveBeenCalledWith({ dryRun: false });
    expect(startupService.startAndWait).toHaveBeenCalledWith({
      timeoutMs: 1234,
      pollIntervalMs: 321,
      requireMutableAccess: false,
    });
    expect(report.summary).toBe('Zavorth is ready for local and remote use.');
    expect(report.manifest.local.appUrl).toBe('http://127.0.0.1:33333/dashboard');
    expect(report.phases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'go', status: 'ready', command: null }),
        expect.objectContaining({ id: 'bootstrap', status: 'ready', command: null }),
        expect.objectContaining({ id: 'startup', status: 'ready', command: null }),
        expect.objectContaining({ id: 'gateway-ui', status: 'ready' }),
        expect.objectContaining({ id: 'launcher', status: 'skipped' }),
        expect.objectContaining({ id: 'local-access', status: 'ready' }),
        expect.objectContaining({ id: 'product-mode', status: 'ready', command: 'npm run mode:status' }),
        expect.objectContaining({ id: 'profiles-and-packs', status: 'ready', command: 'npm run profile:status' }),
        expect.objectContaining({ id: 'companions-and-presets', status: 'ready', command: 'npm run ops:doctor:desktop' }),
        expect.objectContaining({ id: 'remote-access', status: 'ready' }),
      ]),
    );
    expect(report.phases.find((phase) => phase.id === 'product-mode')?.summary).toContain('Modo atual');
    expect(report.phases.find((phase) => phase.id === 'profiles-and-packs')?.summary).toContain('Use core no dia a dia');
    expect(report.phases.find((phase) => phase.id === 'channels')?.summary).toMatch(/web-only|web\+telegram/);
    expect(report.phases.find((phase) => phase.id === 'channels')?.details.join(' ')).toContain('recommended first external channel');
  });

  it('builds launcher and access phases during dry-run', async () => {
    const repairService = {
      repairLive: jest.fn().mockResolvedValue(buildRepairReport({
        dryRun: true,
        summary: 'Bootstrap ainda pendente: falta close acesso remoto.',
      })),
    };
    const startupService = {
      startAndWait: jest.fn(),
    };
    const manifestService = {
      buildManifest: jest.fn().mockResolvedValue(buildStartupResult({
        summary: 'Bootstrap basico closed: Zavorth is ready for local use.',
        manifest: {
          ...buildStartupResult().manifest,
          summary: 'Bootstrap basico closed: Zavorth is ready for local use.',
          remote: {
            ready: false,
            baseUrl: null,
            appUrl: null,
            requiresHttps: false,
          },
          officialRemote: {
            ready: false,
            summary: 'Acesso remoto oficial ainda pede rollout guiado.',
            recommendedProvider: null,
            recommendedAction: 'go',
            appUrl: null,
            baseUrl: null,
            issues: ['Ainda falta validar o /dashboard remoto oficial.'],
            nextSteps: ['Feche o remoto oficial em um comando com npm run ops:remote:go.'],
            command: 'npm run ops:remote:go',
          },
          nextSteps: [
            {
              id: 'connect-remote-frontend',
              title: 'Close acesso remoto',
            description: 'Defina a URL public HTTPS e conecte o shell web remoto.',
              blocking: false,
            },
          ],
          recommendedPlan: {
            primaryAction: 'open-local',
          primaryLabel: 'Abrir shell web do runtime',
          primarySummary: 'Dashboard ready em http://127.0.0.1:33333/dashboard.',
            primaryCommand: null,
            openTarget: 'http://127.0.0.1:33333/dashboard',
        launcherRecommendation: {
          command: 'npm run launcher:startup:install',
          summary: 'Official Windows startup is optional and blocked by policy. Enable it consciously only if you really want automatic login.',
        },
            remoteRecommendation: {
              ready: false,
              command: 'npm run ops:remote:go',
              appUrl: null,
              summary: 'Acesso remoto oficial ainda pede rollout guiado.',
              nextSteps: ['Feche o remoto oficial em um comando com npm run ops:remote:go.'],
            },
          },
        },
      }).manifest),
    };

    const service = new RuntimeInstallJourneyService({
      repairService,
      startupService,
      manifestService,
      platform: 'win32',
      appDataDir: 'C:/Users/demo/AppData/Roaming',
      existsSync: jest.fn().mockReturnValue(false),
    });

    const report = await service.run({ dryRun: true });

    expect(startupService.startAndWait).not.toHaveBeenCalled();
    expect(manifestService.buildManifest).toHaveBeenCalled();
    expect(report.startup).toBeNull();
    expect(report.phases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'go',
          status: 'ready',
          command: null,
        }),
        expect.objectContaining({ id: 'startup', status: 'ready' }),
        expect.objectContaining({ id: 'gateway-ui', status: 'ready' }),
        expect.objectContaining({ id: 'product-mode', status: 'ready', command: 'npm run mode:status' }),
        expect.objectContaining({ id: 'profiles-and-packs', status: 'ready', command: 'npm run profile:status' }),
        expect.objectContaining({ id: 'companions-and-presets', status: 'ready', command: 'npm run ops:doctor:desktop' }),
        expect.objectContaining({
          id: 'launcher',
          status: 'skipped',
          command: null,
        }),
        expect.objectContaining({
          id: 'remote-access',
          status: 'action',
          command: 'npm run ops:remote:go',
        }),
      ]),
    );
    expect(report.summary).toBe('Bootstrap basico closed: Zavorth is ready for local use.');
    expect(report.phases.find((phase) => phase.id === 'channels')?.summary).toMatch(/web-only|web\+telegram/);
  });

  it('prioritizes official remote rollout once local access is ready and startup is no longer the blocker', async () => {
    const repairService = {
      repairLive: jest.fn().mockResolvedValue(buildRepairReport({
        dryRun: true,
        summary: 'Bootstrap basico closed: falta liberar o remoto oficial.',
      })),
    };
    const startupService = {
      startAndWait: jest.fn(),
    };
    const manifestService = {
      buildManifest: jest.fn().mockResolvedValue(buildStartupResult({
        summary: 'Bootstrap basico closed: Zavorth is ready for local use.',
        manifest: {
          ...buildStartupResult().manifest,
          summary: 'Bootstrap basico closed: Zavorth is ready for local use.',
          remote: {
            ready: false,
            baseUrl: null,
            appUrl: null,
            requiresHttps: false,
          },
          officialRemote: {
            ready: false,
            summary: 'Acesso remoto oficial ainda pede rollout guiado.',
            recommendedProvider: null,
            recommendedAction: 'go',
            appUrl: null,
            baseUrl: null,
            issues: ['Ainda falta validar o /dashboard remoto oficial.'],
            nextSteps: ['Feche o remoto oficial em um comando com npm run ops:remote:go.'],
            command: 'npm run ops:remote:go',
          },
          recommendedPlan: {
            primaryAction: 'open-local',
          primaryLabel: 'Abrir shell web do runtime',
          primarySummary: 'Dashboard ready em http://127.0.0.1:33333/dashboard.',
            primaryCommand: null,
            openTarget: 'http://127.0.0.1:33333/dashboard',
            launcherRecommendation: {
              command: 'npm run launcher:startup:install',
              summary: 'Official Windows startup is optional and blocked by policy. Enable it consciously only if you really want automatic login.',
            },
            remoteRecommendation: {
              ready: false,
              command: 'npm run ops:remote:go',
              appUrl: null,
              summary: 'Acesso remoto oficial ainda pede rollout guiado.',
              nextSteps: ['Feche o remoto oficial em um comando com npm run ops:remote:go.'],
            },
          },
        },
      }).manifest),
    };

    const service = new RuntimeInstallJourneyService({
      repairService,
      startupService,
      manifestService,
      platform: 'win32',
      appDataDir: 'C:/Users/demo/AppData/Roaming',
      existsSync: jest.fn().mockReturnValue(true),
    });

    const report = await service.run({ dryRun: true });

    expect(report.phases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'launcher',
          status: 'ready',
          command: null,
        }),
        expect.objectContaining({
          id: 'next-step',
          title: 'Close acesso remoto oficial',
          status: 'action',
          command: 'npm run ops:remote:go',
          summary: 'Acesso remoto oficial ainda pede rollout guiado.',
        }),
      ]),
    );
  });

  it('uses the canonical recommended plan for the next step when the host still needs trust', async () => {
    const repairService = {
      repairLive: jest.fn().mockResolvedValue(buildRepairReport({
        final: {
          ...buildRepairReport().final,
          supervisedRuntime: {
            ...buildRepairReport().final.supervisedRuntime,
            accessReadiness: {
              ...buildRepairReport().final.supervisedRuntime.accessReadiness,
              runtime: {
                ...buildRepairReport().final.supervisedRuntime.accessReadiness.runtime,
                hostAuthorized: false,
              },
            },
          },
        },
      })),
    };
    const startupService = {
      startAndWait: jest.fn().mockResolvedValue(buildStartupResult({
        manifest: {
          ...buildStartupResult().manifest,
          auth: {
            ...buildStartupResult().manifest.auth,
            authorizedHost: false,
          },
          recommendedPlan: {
            primaryAction: 'trust',
            primaryLabel: 'Liberar este host',
            primarySummary: 'Authorize this host before running mutable actions, local writes, or persisted deliveries.',
            primaryCommand: '/hostauth trust',
            openTarget: 'http://127.0.0.1:33333/dashboard',
            launcherRecommendation: {
              command: 'npm run launcher:startup:install',
              summary: 'Official Windows startup is optional and blocked by policy. Enable it consciously only if you really want automatic login.',
            },
            remoteRecommendation: {
              ready: true,
              command: 'npm run ops:remote:go',
              appUrl: 'https://zavorth.example.com/zavorthControl',
              summary: 'Official remote access ready and validated.',
              nextSteps: [],
            },
          },
        },
        readiness: {
          ...buildStartupResult().readiness,
          runtime: {
            ...buildStartupResult().readiness.runtime,
            hostAuthorized: false,
          },
        },
      })),
    };

    const service = new RuntimeInstallJourneyService({
      repairService,
      startupService,
      platform: 'win32',
      appDataDir: 'C:/Users/demo/AppData/Roaming',
      existsSync: jest.fn().mockReturnValue(true),
    });

    const report = await service.run();

    expect(report.phases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'next-step',
          title: 'Liberar este host',
          status: 'action',
          command: '/hostauth trust',
          summary: 'Authorize this host before running mutable actions, local writes, or persisted deliveries.',
        }),
      ]),
    );
  });
});

