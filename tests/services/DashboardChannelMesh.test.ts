import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

describe('Dashboard channel mesh', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalDashboardRuntimeStateFile = config.dashboardRuntimeStateFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.dashboardRuntimeStateFile = originalDashboardRuntimeStateFile;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('serves the channel mesh through the classic dashboard api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-channel-mesh-'));
    tempDirs.push(root);
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const channelMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          total: 5,
          ready: 3,
          partial: 1,
          planned: 1,
          disabled: 0,
          configured: 4,
          sessionSendReady: 3,
          attachments: 3,
          groupPolicy: 4,
        },
        entries: [
          {
            id: 'telegram',
            label: 'Telegram',
            readiness: 'ready',
            operatorSummary: 'sessions_send pronto.',
          },
        ],
        selected: {
          id: 'slack',
          label: 'Slack',
          readiness: 'planned',
          operatorSummary: 'planejado.',
        },
        featuredIds: ['slack'],
        narrative: {
          headline: 'Channel Mesh expoe 5 canal(is).',
          operatorSummary: '3 prontos, 1 parcial e 1 planejado.',
        },
      })),
    };

    const service = new DashboardService(logRepo, {
      channelMeshService: channelMeshService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/operations/channels',
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 5,
          ready: 3,
          planned: 1,
        }),
        selected: expect.objectContaining({
          id: 'slack',
        }),
      }),
    );
  });

  it('executes channel actions through the classic dashboard api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-channel-actions-'));
    tempDirs.push(root);
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const channelMeshService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          total: 5,
          ready: 3,
          partial: 1,
          planned: 1,
          disabled: 0,
          configured: 4,
          sessionSendReady: 3,
          attachments: 3,
          groupPolicy: 4,
        },
        entries: [],
        selected: {
          id: selectedId || 'telegram',
          label: 'Telegram',
          readiness: 'ready',
          operatorSummary: 'sessions_send pronto.',
          actions: [{ id: 'telegram:broadcast-test', label: 'Testar broadcast', kind: 'broadcast-test', command: '/channels broadcast-test telegram' }],
        },
        featuredIds: ['telegram'],
        narrative: {
          headline: 'Channel Mesh expoe 5 canal(is).',
          operatorSummary: '3 prontos, 1 parcial e 1 planejado.',
        },
      })),
    };
    const channelActionService = {
      execute: jest.fn(async () => ({
        generatedAt: '2026-04-02T12:05:00.000Z',
        channelId: 'telegram',
        actionId: 'broadcast-test',
        status: 'applied',
        ok: true,
        summary: 'Teste de broadcast enviado para Telegram.',
        details: ['Recipientes previstos: 2.'],
        selected: {
          id: 'telegram',
          label: 'Telegram',
        },
        snapshot: channelMeshService.buildSnapshot({ selectedId: 'telegram' }),
      })),
    };

    const service = new DashboardService(logRepo, {
      channelMeshService: channelMeshService as any,
      channelActionService: channelActionService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/operations/channels/actions',
      {
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channelId: 'telegram',
            actionId: 'broadcast-test',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(channelActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'telegram',
        actionId: 'broadcast-test',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'Teste de broadcast enviado para Telegram.',
        }),
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'telegram',
          }),
        }),
      }),
    );
  });

  it('late-binds Discord broadcast gateways into the classic dashboard action plane', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-channel-discord-'));
    tempDirs.push(root);
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const channelMeshService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          total: 5,
          ready: 4,
          partial: 0,
          planned: 1,
          disabled: 0,
          configured: 4,
          sessionSendReady: 4,
          attachments: 4,
          groupPolicy: 4,
        },
        entries: [],
        selected: {
          id: selectedId || 'discord',
          label: 'Discord',
          readiness: 'ready',
          transport: 'native',
          summary: 'Canal pronto.',
          operatorSummary: 'policy por grupo disponivel.',
          actionHint: 'Use slash commands.',
          notes: [],
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
          actions: [{ id: 'discord:broadcast-test', label: 'Testar broadcast', kind: 'broadcast-test', command: '/channels broadcast-test discord' }],
        },
        featuredIds: ['discord'],
        narrative: {
          headline: 'Channel Mesh expoe 5 canal(is).',
          operatorSummary: '4 prontos e 1 planejado.',
        },
      })),
    };
    const broadcast = jest.fn(async () => undefined);
    const resolveBroadcastRecipients = jest.fn(() => ['discord:owner']);
    const service = new DashboardService(logRepo, {
      channelMeshService: channelMeshService as any,
    });
    service.attachChannelBroadcastGateways({
      discord: {
        supportsRoleAwareBroadcast: true,
        resolveBroadcastRecipients,
        broadcast,
      } as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/operations/channels/actions',
      {
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channelId: 'discord',
            actionId: 'broadcast-test',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(resolveBroadcastRecipients).toHaveBeenCalledWith(['admin', 'operator']);
    expect(broadcast).toHaveBeenCalledWith(expect.stringContaining('Teste do Channel Mesh em Discord'), ['admin', 'operator']);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'Teste de broadcast enviado para Discord.',
        }),
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'discord',
          }),
        }),
      }),
    );
  });

  it('late-binds Slack broadcast gateways into the classic dashboard action plane', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-channel-slack-'));
    tempDirs.push(root);
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const channelMeshService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          total: 5,
          ready: 3,
          partial: 2,
          planned: 0,
          disabled: 0,
          configured: 5,
          sessionSendReady: 3,
          attachments: 4,
          groupPolicy: 5,
        },
        entries: [],
        selected: {
          id: selectedId || 'slack',
          label: 'Slack',
          readiness: 'partial',
          transport: 'local',
          summary: 'Canal parcial, mas com outbox local pronto para teste.',
          operatorSummary: 'policy por grupo disponivel.',
          actionHint: 'Prepare onboarding e valide o outbox local.',
          notes: [],
          features: {
            inbound: true,
            outbound: true,
            sessionList: true,
            sessionHistory: true,
            sessionSend: false,
            sessionSpawn: false,
            attachments: true,
            threads: true,
            groupPolicy: true,
            identityHints: true,
          },
          actions: [{ id: 'slack:broadcast-test', label: 'Testar broadcast', kind: 'broadcast-test', command: '/channels broadcast-test slack' }],
        },
        featuredIds: ['slack'],
        narrative: {
          headline: 'Channel Mesh expoe 5 canal(is).',
          operatorSummary: '3 prontos e 2 parciais.',
        },
      })),
    };
    const broadcast = jest.fn(async () => undefined);
    const resolveBroadcastRecipients = jest.fn(() => ['slack:ops']);
    const service = new DashboardService(logRepo, {
      channelMeshService: channelMeshService as any,
    });
    service.attachChannelBroadcastGateways({
      slack: {
        supportsRoleAwareBroadcast: false,
        resolveBroadcastRecipients,
        broadcast,
      } as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/operations/channels/actions',
      {
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channelId: 'slack',
            actionId: 'broadcast-test',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(resolveBroadcastRecipients).toHaveBeenCalledWith([]);
    expect(broadcast).toHaveBeenCalledWith(expect.stringContaining('Teste do Channel Mesh em Slack'), []);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'Teste de broadcast enviado para Slack.',
        }),
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'slack',
          }),
        }),
      }),
    );
  });

  it('reflects web sessionSend and sessionSpawn when the runtime is attached', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-channel-web-runtime-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const service = new DashboardService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasksByChat: jest.fn(() => []),
        getTask: jest.fn(),
      } as any,
      parser: {
        parse: jest.fn(),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: jest.fn(),
      } as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/channels?selectedId=web',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'web',
            features: expect.objectContaining({
              sessionSend: true,
              sessionSpawn: true,
            }),
          }),
        }),
      }),
    );
  });

  it('reflects discord runtime descriptors from a live broadcast gateway', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-channel-discord-runtime-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const service = new DashboardService(logRepo);
    service.attachChannelBroadcastGateways({
      discord: {
        supportsRoleAwareBroadcast: true,
        resolveBroadcastRecipients: jest.fn(() => ['discord:owner']),
        broadcast: jest.fn(async () => undefined),
        isStarted: jest.fn(() => true),
        getIdentityHints: jest.fn(() => ({
          linkedBy: 'discord-native-gateway',
          verificationMethod: 'discord-bot-token',
        })),
        readStatus: jest.fn(() => ({
          mode: 'native',
          enabled: true,
          started: true,
          lastError: null,
        })),
      } as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/channels?selectedId=discord',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'discord',
            readiness: 'ready',
            transport: 'native',
            features: expect.objectContaining({
              threads: true,
              attachments: true,
              groupPolicy: true,
              identityHints: true,
            }),
            notes: expect.arrayContaining([
              'Gateway do Discord anexado ao mesh operacional do Zavorth.',
              'Runtime do Discord operando em modo nativo.',
            ]),
          }),
        }),
      }),
    );
  });

  it('reflects telegram runtime adapters from a live broadcast gateway', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-channel-telegram-runtime-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const service = new DashboardService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasksByChat: jest.fn(() => []),
        getTask: jest.fn(),
      } as any,
      parser: {
        parse: jest.fn(),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: jest.fn(),
      } as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
      webUserId: '1',
    });
    service.attachChannelBroadcastGateways({
      telegram: {
        supportsRoleAwareBroadcast: true,
        resolveBroadcastRecipients: jest.fn(() => ['telegram:admin']),
        broadcast: jest.fn(async () => undefined),
        isStarted: jest.fn(() => true),
        getIdentityHints: jest.fn(() => ({
          linkedBy: 'telegram-bot-gateway',
          verificationMethod: 'telegram-bot-token',
        })),
      } as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/channels?selectedId=telegram',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'telegram',
            readiness: 'ready',
            transport: 'native',
            features: expect.objectContaining({
              sessionSend: true,
              groupPolicy: true,
              identityHints: true,
            }),
            notes: expect.arrayContaining([
              'Gateway do Telegram anexado ao mesh operacional do Zavorth.',
              'Surface do Telegram ativa no runtime atual.',
            ]),
          }),
        }),
      }),
    );
  });

  it('reflects slack runtime adapters from a live broadcast gateway', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-channel-slack-runtime-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const service = new DashboardService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasksByChat: jest.fn(() => []),
        getTask: jest.fn(),
      } as any,
      parser: {
        parse: jest.fn(),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: jest.fn(),
      } as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
      webUserId: '1',
    });
    service.attachChannelBroadcastGateways({
      slack: {
        supportsRoleAwareBroadcast: false,
        resolveBroadcastRecipients: jest.fn(() => ['slack:ops']),
        broadcast: jest.fn(async () => undefined),
        isStarted: jest.fn(() => true),
        getIdentityHints: jest.fn(() => ({
          linkedBy: 'slack-gateway',
          verificationMethod: 'slack-web-api',
        })),
        readStatus: jest.fn(() => ({
          mode: 'native',
          enabled: true,
          started: true,
          recipientsConfigured: 1,
          workspaceId: 'workspace-1',
          transport: 'native',
          lastError: null,
        })),
      } as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/channels?selectedId=slack',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'slack',
            readiness: 'ready',
            transport: 'native',
            features: expect.objectContaining({
              sessionSend: true,
              threads: true,
              attachments: true,
              groupPolicy: true,
              identityHints: true,
            }),
            notes: expect.arrayContaining([
              'Gateway do Slack anexado ao mesh operacional do Zavorth.',
              'Runtime do Slack operando em modo nativo pela Web API.',
              'Workspace do Slack configurado em workspace-1.',
            ]),
          }),
        }),
      }),
    );
  });

  it('reflects whatsapp runtime adapters from a live broadcast gateway', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-channel-whatsapp-runtime-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const service = new DashboardService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasksByChat: jest.fn(() => []),
        getTask: jest.fn(),
      } as any,
      parser: {
        parse: jest.fn(),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: jest.fn(),
      } as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
      webUserId: '1',
    });
    service.attachChannelBroadcastGateways({
      whatsapp: {
        supportsRoleAwareBroadcast: false,
        resolveBroadcastRecipients: jest.fn(() => ['5511999999999']),
        broadcast: jest.fn(async () => undefined),
        isStarted: jest.fn(() => true),
        getIdentityHints: jest.fn(() => ({
          linkedBy: 'whatsapp-gateway',
          verificationMethod: 'whatsapp-cloud-api',
        })),
        readStatus: jest.fn(() => ({
          mode: 'cloud-api',
          provider: 'cloud-api',
          enabled: true,
          started: true,
          recipientsConfigured: 1,
          providerConfigured: true,
          providerDecision: 'Cloud API conectada; webhook verification, inbound e outbound oficial estao ativos.',
          phoneNumberId: '1234567890',
          webhookConfigured: true,
          lastError: null,
        })),
      } as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/channels?selectedId=whatsapp',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'whatsapp',
            readiness: 'ready',
            transport: 'webhook',
            features: expect.objectContaining({
              sessionSend: true,
              inbound: true,
              outbound: true,
              attachments: true,
              threads: false,
              groupPolicy: true,
              identityHints: true,
            }),
            notes: expect.arrayContaining([
              'Gateway do WhatsApp anexado ao mesh operacional do Zavorth.',
              'Runtime do WhatsApp operando pela Cloud API da Meta.',
              'Cloud API conectada; webhook verification, inbound e outbound oficial estao ativos.',
              'Phone number id configurado em 1234567890.',
            ]),
          }),
        }),
      }),
    );
  });
});
