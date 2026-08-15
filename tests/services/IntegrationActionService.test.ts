import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index';
import { IntegrationActionService } from '../../src/services/IntegrationActionService';
import { IntegrationHealthService } from '../../src/services/IntegrationHealthService';
import { IntegrationInstallerService } from '../../src/services/IntegrationInstallerService';
import { IntegrationProbeService } from '../../src/services/IntegrationProbeService';
import { IntegrationRegistryService } from '../../src/services/IntegrationRegistryService';


describe('IntegrationActionService', () => {
  const originalDbEncryptionKey = config.dbEncryptionKey;
  const originalOpenRouterApiKey = config.openRouterApiKey;
  const originalEnvOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
  const originalEnvOllamaHost = process.env.OLLAMA_HOST;
  const originalEnvOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalSlackEnabled = (config as any).slackEnabled;
  const originalSlackTransport = (config as any).slackTransport;
  const originalSlackWorkspaceId = (config as any).slackWorkspaceId;
  const originalSlackAllowedChannelIds = (config as any).slackAllowedChannelIds;
  const originalEnvSlackEnabled = process.env.SLACK_ENABLED;
  const originalEnvSlackTransport = process.env.SLACK_TRANSPORT;
  const originalEnvSlackWorkspaceId = process.env.SLACK_WORKSPACE_ID;
  const originalEnvSlackAllowedChannelIds = process.env.SLACK_ALLOWED_CHANNEL_IDS;
  const originalAIGatewaySidecarEnabled = (config as any).AIGatewaySidecarEnabled;
  const originalZavorthTerminalSidecarEnabled = (config as any).ZavorthTerminalSidecarEnabled;

  function createRuntime() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-actions-'));
    const installer = new IntegrationInstallerService({
      stateFile: path.join(tempDir, 'state.json'),
      secretsFile: path.join(tempDir, 'secrets.json'),
      now: () => new Date('2026-04-01T15:00:00.000Z'),
    });
    const registry = new IntegrationRegistryService();
    const probe = new IntegrationProbeService({
      registryService: registry,
      stateFile: path.join(tempDir, 'probes.json'),
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      fetchImpl: jest.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '{"ok":true}',
      })) as any,
    });
    const health = new IntegrationHealthService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
    });

    return {
      tempDir,
      envFilePath: path.join(tempDir, '.env'),
      installer,
      registry,
      probe,
      health,
    };
  }

  beforeEach(() => {
    (config as any).dbEncryptionKey = 'integration-action-test-key';
    (config as any).openRouterApiKey = '';
    (config as any).AIGatewaySidecarEnabled = true;
    (config as any).ZavorthTerminalSidecarEnabled = true;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.SLACK_ENABLED;
    delete process.env.SLACK_TRANSPORT;
    delete process.env.SLACK_WORKSPACE_ID;
    delete process.env.SLACK_ALLOWED_CHANNEL_IDS;
  });

  afterEach(() => {
    (config as any).dbEncryptionKey = originalDbEncryptionKey;
    (config as any).openRouterApiKey = originalOpenRouterApiKey;
    if (typeof originalEnvOpenRouterApiKey === 'string') {
      process.env.OPENROUTER_API_KEY = originalEnvOpenRouterApiKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
    if (typeof originalEnvOllamaHost === 'string') {
      process.env.OLLAMA_HOST = originalEnvOllamaHost;
    } else {
      delete process.env.OLLAMA_HOST;
    }
    if (typeof originalEnvOllamaBaseUrl === 'string') {
      process.env.OLLAMA_BASE_URL = originalEnvOllamaBaseUrl;
    } else {
      delete process.env.OLLAMA_BASE_URL;
    }
    (config as any).slackEnabled = originalSlackEnabled;
    (config as any).slackTransport = originalSlackTransport;
    (config as any).slackWorkspaceId = originalSlackWorkspaceId;
    (config as any).slackAllowedChannelIds = originalSlackAllowedChannelIds;
    (config as any).AIGatewaySidecarEnabled = originalAIGatewaySidecarEnabled;
    (config as any).ZavorthTerminalSidecarEnabled = originalZavorthTerminalSidecarEnabled;
    if (typeof originalEnvSlackEnabled === 'string') {
      process.env.SLACK_ENABLED = originalEnvSlackEnabled;
    } else {
      delete process.env.SLACK_ENABLED;
    }
    if (typeof originalEnvSlackTransport === 'string') {
      process.env.SLACK_TRANSPORT = originalEnvSlackTransport;
    } else {
      delete process.env.SLACK_TRANSPORT;
    }
    if (typeof originalEnvSlackWorkspaceId === 'string') {
      process.env.SLACK_WORKSPACE_ID = originalEnvSlackWorkspaceId;
    } else {
      delete process.env.SLACK_WORKSPACE_ID;
    }
    if (typeof originalEnvSlackAllowedChannelIds === 'string') {
      process.env.SLACK_ALLOWED_CHANNEL_IDS = originalEnvSlackAllowedChannelIds;
    } else {
      delete process.env.SLACK_ALLOWED_CHANNEL_IDS;
    }
  });

  it('builds an assisted action plan with executable doctor steps for native providers', () => {
    const { installer, registry, health, probe } = createRuntime();
    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
    });

    const plan = service.buildActionPlan('openrouter');
    const primary = plan.actions.find((entry) => entry.id === plan.primaryActionId);

    expect(plan.integrationId).toBe('openrouter');
    expect(plan.actions.some((entry) => entry.id === 'validate-now' && entry.executable)).toBe(true);
    expect(plan.actions.find((entry) => entry.id === 'validate-now')?.impact).toEqual(
      expect.objectContaining({
        level: 'read_only',
        requiresConfirmation: false,
      }),
    );
    expect(primary).toBeTruthy();
    expect(plan.actions.some((entry) => entry.id === plan.primaryActionId)).toBe(true);
  });

  it('executes a safelisted guided action in background', async () => {
    const { installer, registry, health, tempDir, envFilePath, probe } = createRuntime();
    let exitHandler: ((code: number | null) => void) | null = null;
    const run = jest.fn(async ({ event }: any) => ({
      ok: true,
      event,
      workspace: __dirname,
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const spawn = jest.fn(() => ({
      pid: 4242,
      unref: jest.fn(),
      once: jest.fn((event: string, handler: (code: number | null) => void) => {
        if (event === 'exit') {
          exitHandler = handler;
        }
      }),
    })) as any;
    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      spawn,
      envFilePath,
      hookPipelineService: {
        run,
      } as any,
    });

    const plan = service.buildActionPlan('openrouter');
    const spawnableAction = plan.actions.find((entry) => entry.id === 'doctor:next')
      || plan.actions.find((entry) => entry.executable && entry.command?.startsWith('npm run') && entry.id !== 'validate-now');
    const record = await service.execute('openrouter', spawnableAction?.id || 'doctor:next');

    expect(record.status).toBe('started');
    expect(record.integrationId).toBe('openrouter');
    expect(record.command).toContain('npm');
    expect(spawn).toHaveBeenCalled();
    expect(record.logFile).toContain(path.join('integration-actions', ''));
    expect(fs.existsSync(path.join(tempDir))).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'integration.before_action',
        context: expect.objectContaining({
          integrationId: 'openrouter',
          actionId: record.actionId,
        }),
      }),
    );

    exitHandler?.(0);

    await new Promise((resolve) => setImmediate(resolve));
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'integration.after_action',
        context: expect.objectContaining({
          integrationId: 'openrouter',
          actionId: record.actionId,
          status: 'partial',
          ok: true,
        }),
      }),
    );
  });

  it('repairs runtime bindings from stored secrets, probes the runtime and refreshes doctor state', async () => {
    const { installer, registry, health, envFilePath, probe } = createRuntime();
    installer.buildDraft({
      requestedId: 'openrouter',
      answers: {
        openrouter_api_key: 'sk-repair-123',
      },
      persist: true,
    });

    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      envFilePath,
    });

    const record = await service.execute('openrouter', 'repair-runtime');
    const installed = installer.getInstalled('openrouter');
    const envContents = fs.readFileSync(envFilePath, 'utf8');

    expect(record.status).toBe('completed');
    expect(record.appliedEnvKeys).toEqual(expect.arrayContaining(['OPENROUTER_API_KEY']));
    expect(record.doctor?.status).toBe('ok');
    expect(installed?.lastHealthStatus).toBe('ok');
    expect(envContents).toContain('OPENROUTER_API_KEY=sk-repair-123');
    expect(process.env.OPENROUTER_API_KEY).toBe('sk-repair-123');
    expect(config.openRouterApiKey).toBe('sk-repair-123');
    expect(record.probe).toEqual(
      expect.objectContaining({
        status: 'ok',
        integrationId: 'openrouter',
      }),
    );

    const monitor = service.buildActionMonitor('openrouter');
    expect(monitor.latestAction?.actionId).toBe('repair-runtime');
    expect(monitor.latestAction?.status).toBe('completed');
    expect(monitor.recentActions.length).toBeGreaterThan(0);
  });

  it('repairs runtime bindings for channel integrations with env-backed non-secret answers', async () => {
    const { installer, registry, health, envFilePath, probe } = createRuntime();
    installer.buildDraft({
      requestedId: 'slack',
      answers: {
        slack_enabled: true,
        slack_transport: 'stub',
        slack_workspace_id: 'T-ops',
        slack_allowed_channel_ids: 'C-ops',
      },
      persist: true,
    });

    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      envFilePath,
    });

    const record = await service.execute('slack', 'repair-runtime');
    const envContents = fs.readFileSync(envFilePath, 'utf8');

    expect(record.status).toBe('completed');
    expect(record.appliedEnvKeys).toEqual(expect.arrayContaining([
      'SLACK_ENABLED',
      'SLACK_TRANSPORT',
      'SLACK_WORKSPACE_ID',
      'SLACK_ALLOWED_CHANNEL_IDS',
    ]));
    expect(record.doctor?.status).toBe('ok');
    expect(envContents).toContain('SLACK_ENABLED=true');
    expect(envContents).toContain('SLACK_TRANSPORT=stub');
    expect(envContents).toContain('SLACK_WORKSPACE_ID=T-ops');
    expect(process.env.SLACK_ENABLED).toBe('true');
    expect(process.env.SLACK_TRANSPORT).toBe('stub');
    expect((config as any).slackEnabled).toBe(true);
    expect((config as any).slackTransport).toBe('stub');
    expect(record.probe).toEqual(
      expect.objectContaining({
        status: 'ok',
        integrationId: 'slack',
      }),
    );
  });

  it('records health status and probe result when validating immediately', async () => {
    const { installer, registry, health, envFilePath, probe } = createRuntime();
    installer.buildDraft({
      requestedId: 'openrouter',
      answers: {
        routing_goal: 'research',
      },
      persist: true,
    });

    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      envFilePath,
    });

    const record = await service.execute('openrouter', 'validate-now');
    const installed = installer.getInstalled('openrouter');

    expect(record.status).toBe(record.doctor?.status === 'ok' ? 'completed' : 'partial');
    expect(['ok', 'warn']).toContain(record.doctor?.status);
    expect(record.probe).toEqual(
      expect.objectContaining({
        status: 'not_configured',
      }),
    );
    expect(installed?.lastHealthCheckAt).toBe('2026-04-01T15:00:00.000Z');
    expect(installed?.lastHealthStatus).toBe('warn');

    const monitor = service.buildActionMonitor('openrouter');
    expect(monitor.latestAction?.actionId).toBe('validate-now');
    expect(monitor.latestAction?.status).toBe('partial');
  });

  it('offers and executes a real AIGateway start recipe through the hub', async () => {
    const { installer, registry, envFilePath } = createRuntime();
    let ready = false;
    const sidecarStatusService = {
      readSummary: () => ({
        AIGateway: {
          id: 'AIGateway',
          name: 'AIGateway',
          enabled: true,
          running: ready,
          ready,
          spawnedByZavorth: ready,
          pid: ready ? 4455 : null,
          baseUrl: 'http://127.0.0.1:20128/v1',
          localUrl: null,
          sourceDir: 'C:/vendor/AIGateway',
          checkedAt: '2026-04-01T15:00:00.000Z',
          message: ready ? 'AIGateway iniciado pelo teste.' : 'Sidecar ainda nao esta pronto.',
        },
        ZavorthTerminal: {} as any,
      }),
    } as any;
    const probe = new IntegrationProbeService({
      registryService: registry,
      sidecarStatusService,
      stateFile: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-actions-')), 'probes.json'),
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      fetchImpl: jest.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '{"data":[]}',
      })) as any,
    });
    const health = new IntegrationHealthService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      sidecarStatusService,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
    });
    const sidecarService = {
      start: jest.fn(async () => {
        ready = true;
        return {
          enabled: true,
          running: true,
          ready: true,
          spawnedByZavorth: true,
          pid: 4455,
          sourceDir: 'C:/vendor/AIGateway',
          baseUrl: 'http://127.0.0.1:20128/v1',
          checkedAt: '2026-04-01T15:00:00.000Z',
          message: 'AIGateway iniciado pelo Zavorth.',
        };
      }),
    } as any;

    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      AIGatewaySidecarService: sidecarService,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      envFilePath,
    });

    const plan = service.buildActionPlan('AIGateway');
    expect(plan.actions.some((entry) => entry.id === 'recipe:AIGateway:start-sidecar')).toBe(true);
    expect(plan.actions.find((entry) => entry.id === 'recipe:AIGateway:start-sidecar')?.impact).toEqual(
      expect.objectContaining({
        level: 'starts_local_service',
        requiresConfirmation: true,
      }),
    );

    const record = await service.execute('AIGateway', 'recipe:AIGateway:start-sidecar');

    expect(sidecarService.start).toHaveBeenCalled();
    expect(record.status).toBe('completed');
    expect(record.probe).toEqual(
      expect.objectContaining({
        integrationId: 'AIGateway',
        status: 'ok',
      }),
    );
    expect(record.doctor?.status).toBe('ok');
  });

  it('offers and executes AIGateway upstream sync/promote/rollback recipes through the hub', async () => {
    const { installer, registry, envFilePath } = createRuntime();
    const sidecarStatusService = {
      readSummary: () => ({
        AIGateway: {
          id: 'AIGateway',
          name: 'AIGateway',
          enabled: true,
          running: true,
          ready: true,
          spawnedByZavorth: true,
          pid: 4455,
          baseUrl: 'http://127.0.0.1:21128/v1',
          localUrl: 'http://127.0.0.1:20128/v1',
          sourceDir: 'C:/vendor/AIGateway',
          checkedAt: '2026-04-01T15:00:00.000Z',
          message: 'Gateway proprio do AIGateway ativo.',
        },
        ZavorthTerminal: {} as any,
      }),
    } as any;
    const probe = new IntegrationProbeService({
      registryService: registry,
      sidecarStatusService,
      stateFile: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-actions-')), 'probes.json'),
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      fetchImpl: jest.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '{"data":[]}',
      })) as any,
    });
    const health = new IntegrationHealthService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      sidecarStatusService,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
    });
    const GatewayUpstreamSyncService = {
      sync: jest.fn(async () => ({
        ok: true,
        action: 'sync',
        summary: 'Estado do upstream AIGateway sincronizado por inspecao segura.',
        status: 'inspected',
        command: 'vendor-toolkit status --target=AIGateway',
        compat: null,
        error: null,
      })),
      promote: jest.fn(async () => ({
        ok: true,
        action: 'promote',
        summary: 'Upstream AIGateway promovido com compatibilidade revalidada.',
        status: 'promoted',
        command: 'vendor-toolkit update --target=AIGateway',
        compat: {
          status: 'passed',
          summary: 'Gateway proprio do AIGateway respondeu pelo contrato OpenAI-compatible.',
        },
        error: null,
      })),
      rollback: jest.fn(async () => ({
        ok: true,
        action: 'rollback',
        summary: 'AIGateway restaurado para o lock anterior e revalidado.',
        status: 'rolled_back',
        command: 'vendor-toolkit rollback --target=AIGateway',
        compat: {
          status: 'passed',
          summary: 'Gateway proprio do AIGateway respondeu pelo contrato OpenAI-compatible.',
        },
        error: null,
      })),
    } as any;

    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      GatewayUpstreamSyncService,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      envFilePath,
    });

    const plan = service.buildActionPlan('AIGateway');
    expect(plan.actions.some((entry) => entry.id === 'recipe:AIGateway:sync-upstream')).toBe(true);
    expect(plan.actions.some((entry) => entry.id === 'recipe:AIGateway:promote-upstream')).toBe(true);
    expect(plan.actions.some((entry) => entry.id === 'recipe:AIGateway:rollback-upstream')).toBe(true);

    const promoteRecord = await service.execute('AIGateway', 'recipe:AIGateway:promote-upstream');
    const rollbackRecord = await service.execute('AIGateway', 'recipe:AIGateway:rollback-upstream');

    expect(GatewayUpstreamSyncService.promote).toHaveBeenCalledWith({ autoRollback: true });
    expect(GatewayUpstreamSyncService.rollback).toHaveBeenCalled();
    expect(promoteRecord.status).toBe('completed');
    expect(promoteRecord.probe).toEqual(
      expect.objectContaining({
        integrationId: 'AIGateway',
        status: 'ok',
      }),
    );
    expect(rollbackRecord.status).toBe('completed');
    expect(rollbackRecord.doctor?.status).toBe('ok');
  });

  it('offers and executes ZavorthBridge Remote start and upstream recipes through the hub', async () => {
    const { installer, registry, envFilePath } = createRuntime();
    let ready = false;
    const sidecarStatusService = {
      readSummary: () => ({
        AIGateway: {} as any,
        ZavorthTerminal: {
          id: 'omni-zavorth-bridge-remote',
          name: 'ZavorthBridge Remote',
          enabled: true,
          running: ready,
          ready,
          spawnedByZavorth: ready,
          pid: ready ? 5151 : null,
          baseUrl: 'http://127.0.0.1:4747',
          localUrl: 'http://192.168.0.10:4747',
          sourceDir: 'C:/vendor/agremote',
          checkedAt: '2026-04-01T15:00:00.000Z',
          message: ready ? 'ZavorthBridge Remote iniciado.' : 'Sidecar ainda nao esta pronto.',
        },
      }),
    } as any;
    const probe = new IntegrationProbeService({
      registryService: registry,
      sidecarStatusService,
      stateFile: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-actions-')), 'probes.json'),
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      fetchImpl: jest.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '{"ok":true}',
      })) as any,
    });
    const health = new IntegrationHealthService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      sidecarStatusService,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
    });
    const sidecarService = {
      start: jest.fn(async () => {
        ready = true;
        return {
          enabled: true,
          running: true,
          ready: true,
          spawnedByZavorth: true,
          pid: 5151,
          sourceDir: 'C:/vendor/agremote',
          baseUrl: 'http://127.0.0.1:4747',
          localUrl: 'http://192.168.0.10:4747',
          checkedAt: '2026-04-01T15:00:00.000Z',
          message: 'ZavorthBridge Remote iniciado pelo Zavorth.',
        };
      }),
    } as any;
    const upstreamSyncService = {
      sync: jest.fn(async () => ({
        ok: true,
        action: 'sync',
        summary: 'Estado do upstream ZavorthBridge Remote sincronizado por inspecao segura.',
        status: 'inspected',
        command: 'vendor-toolkit status --target=omni-zavorth-bridge-remote-chat',
        error: null,
      })),
      promote: jest.fn(async () => ({
        ok: true,
        action: 'promote',
        summary: 'Upstream ZavorthBridge Remote promovido com doctor revalidado.',
        status: 'promoted',
        command: 'vendor-toolkit update --target=omni-zavorth-bridge-remote-chat',
        error: null,
      })),
      rollback: jest.fn(async () => ({
        ok: true,
        action: 'rollback',
        summary: 'ZavorthBridge Remote restaurado para o lock anterior e revalidado.',
        status: 'rolled_back',
        command: 'vendor-toolkit rollback --target=omni-zavorth-bridge-remote-chat',
        error: null,
      })),
    } as any;

    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      TerminalSidecarService: sidecarService,
      zavorthBridgeRemoteUpstreamSyncService: upstreamSyncService,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      envFilePath,
    });

    const plan = service.buildActionPlan('omni-zavorth-bridge-remote-chat');
    expect(plan.actions.some((entry) => entry.id === 'recipe:zavorth-bridge-remote:start-sidecar')).toBe(true);
    expect(plan.actions.some((entry) => entry.id === 'recipe:zavorth-bridge-remote:promote-upstream')).toBe(true);

    const startRecord = await service.execute('omni-zavorth-bridge-remote-chat', 'recipe:zavorth-bridge-remote:start-sidecar');
    const promoteRecord = await service.execute('omni-zavorth-bridge-remote-chat', 'recipe:zavorth-bridge-remote:promote-upstream');

    expect(sidecarService.start).toHaveBeenCalled();
    expect(upstreamSyncService.promote).toHaveBeenCalledWith({ autoRollback: true });
    expect(startRecord.status).toBe('completed');
    expect(startRecord.probe).toEqual(
      expect.objectContaining({
        integrationId: 'zavorth-terminal',
        status: 'ok',
      }),
    );
    expect(promoteRecord.status).toBe('completed');
    expect(promoteRecord.integrationId).toBe('zavorth-terminal');
    expect(promoteRecord.doctor?.status).toBe('ok');
  });

  it('prepares the Ollama host locally before validating the runtime', async () => {
    const { installer, registry, envFilePath } = createRuntime();
    delete process.env.OLLAMA_HOST;
    delete process.env.OLLAMA_BASE_URL;
    installer.buildDraft({
      requestedId: 'ollama',
      persist: true,
      selectedMode: 'docker',
    });
    const probe = new IntegrationProbeService({
      registryService: registry,
      stateFile: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-actions-')), 'probes.json'),
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      fetchImpl: jest.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '{"models":[]}',
      })) as any,
    });
    const health = new IntegrationHealthService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
    });
    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      envFilePath,
    });

    const plan = service.buildActionPlan('ollama');
    expect(plan.actions.some((entry) => entry.id === 'recipe:ollama:prepare-host')).toBe(true);
    expect(plan.actions.find((entry) => entry.id === 'recipe:ollama:prepare-host')?.impact).toEqual(
      expect.objectContaining({
        level: 'writes_runtime',
        requiresConfirmation: true,
      }),
    );

    const record = await service.execute('ollama', 'recipe:ollama:prepare-host');
    const envContents = fs.readFileSync(envFilePath, 'utf8');

    expect(record.status).toBe(record.doctor?.status === 'ok' ? 'completed' : 'partial');
    expect(record.appliedEnvKeys).toEqual(['OLLAMA_HOST']);
    expect(record.probe).toEqual(
      expect.objectContaining({
        integrationId: 'ollama',
        status: 'ok',
      }),
    );
    expect(['ok', 'warn']).toContain(record.doctor?.status);
    expect(process.env.OLLAMA_HOST).toBe('http://127.0.0.1:11434');
    expect(envContents).toContain('OLLAMA_HOST=http://127.0.0.1:11434');
  });

  it('records a blocked integration action when a before hook vetoes execution', async () => {
    const { installer, registry, health, probe } = createRuntime();
    const spawn = jest.fn();
    const run = jest.fn(async ({ event }: any) => ({
      ok: event !== 'integration.before_action' ? true : false,
      event,
      workspace: __dirname,
      listenerCount: 0,
      workspaceHookCount: 1,
    }));
    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      spawn,
      hookPipelineService: {
        run,
      } as any,
    });

    const record = await service.execute('openrouter', 'validate-now');

    expect(record.status).toBe('blocked');
    expect(record.note).toContain('hook bloqueou');
    expect(spawn).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs integration after_action hooks with the final action status', async () => {
    const { installer, registry, health, probe } = createRuntime();
    const run = jest.fn(async ({ event }: any) => ({
      ok: true,
      event,
      workspace: __dirname,
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const service = new IntegrationActionService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      healthService: health,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      hookPipelineService: {
        run,
      } as any,
    });

    const record = await service.execute('openrouter', 'validate-now', {
      requestedBy: 'tester',
    });

    expect(record.status).toBe('partial');
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'integration.before_action',
        context: expect.objectContaining({
          integrationId: 'openrouter',
          actionId: 'validate-now',
          requestedBy: 'tester',
        }),
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'integration.after_action',
        context: expect.objectContaining({
          integrationId: 'openrouter',
          actionId: 'validate-now',
          status: 'partial',
          ok: true,
          requestedBy: 'tester',
        }),
      }),
    );
  });
});
