import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { IntegrationProbeService } from '../../src/services/IntegrationProbeService';
import { IntegrationRegistryService } from '../../src/services/IntegrationRegistryService';

describe('IntegrationProbeService', () => {
  const originalOpenRouterApiKey = config.openRouterApiKey;
  const originalOpenAiApiKey = config.openaiApiKey;
  const originalMiniMaxApiKey = (config as any).minimaxApiKey;
  const originalGeminiApiKey = config.geminiApiKey;
  const originalAiStudioApiKey = config.aiStudioApiKey;
  const originalTunnelHostname = config.cloudflareTunnelPublicHostname;
  const originalGatewayEnabled = config.cloudflareAiGatewayEnabled;
  const originalEnvOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
  const originalEnvOllamaHost = process.env.OLLAMA_HOST;
  const originalEnvOllamaBaseUrl = process.env.OLLAMA_BASE_URL;

  beforeEach(() => {
    (config as any).openRouterApiKey = '';
    (config as any).openaiApiKey = '';
    (config as any).minimaxApiKey = '';
    (config as any).geminiApiKey = '';
    (config as any).aiStudioApiKey = '';
    (config as any).cloudflareTunnelPublicHostname = '';
    (config as any).cloudflareAiGatewayEnabled = false;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_HOST;
    delete process.env.OLLAMA_BASE_URL;
  });

  afterEach(() => {
    (config as any).openRouterApiKey = originalOpenRouterApiKey;
    (config as any).openaiApiKey = originalOpenAiApiKey;
    (config as any).minimaxApiKey = originalMiniMaxApiKey;
    (config as any).geminiApiKey = originalGeminiApiKey;
    (config as any).aiStudioApiKey = originalAiStudioApiKey;
    (config as any).cloudflareTunnelPublicHostname = originalTunnelHostname;
    (config as any).cloudflareAiGatewayEnabled = originalGatewayEnabled;
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
  });

  it('runs a successful lightweight probe for OpenRouter and persists the result', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    (config as any).openRouterApiKey = 'sk-probe-123';
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{"data":[]}',
    })) as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('openrouter');
    const cached = service.getLatestProbe('openrouter');

    expect(snapshot.status).toBe('ok');
    expect(snapshot.checkedTarget).toBe('https://openrouter.ai/api/v1/models');
    expect(snapshot.latencyMs).toBeGreaterThanOrEqual(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(cached).toEqual(snapshot);
  });

  it('returns not_configured without hitting the network when the runtime credential is absent', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    const fetchImpl = jest.fn() as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('openrouter');

    expect(snapshot.status).toBe('not_configured');
    expect(snapshot.summary).toContain('chave');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces authentication failures as failed probes', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    (config as any).openaiApiKey = 'sk-openai-123';
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'invalid api key',
    })) as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('openai');

    expect(snapshot.status).toBe('failed');
    expect(snapshot.httpStatus).toBe(401);
    expect(snapshot.summary).toContain('autenticacao');
    expect(snapshot.detail).toContain('invalid api key');
  });

  it('runs a successful lightweight probe for MiniMax direct', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    (config as any).minimaxApiKey = 'sk-minimax-123';
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{"data":[]}',
    })) as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('minimax');

    expect(snapshot.status).toBe('ok');
    expect(snapshot.checkedTarget).toBe('https://api.minimax.io/v1/models');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/models',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('probes AIGateway through the local sidecar when it is ready', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{"data":[]}',
    })) as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      sidecarStatusService: {
        readSummary: () => ({
          AIGateway: {
            id: 'AIGateway',
            name: 'AIGateway',
            enabled: true,
            running: true,
            ready: true,
            spawnedByZavorth: true,
            pid: 1234,
            baseUrl: 'http://127.0.0.1:20128/v1',
            localUrl: null,
            sourceDir: 'C:/vendor/AIGateway',
            checkedAt: '2026-04-01T18:00:00.000Z',
            message: 'AIGateway online.',
          },
          ZavorthTerminal: {} as any,
        }),
      } as any,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('AIGateway');

    expect(snapshot.status).toBe('ok');
    expect(snapshot.transport).toBe('runtime');
    expect(snapshot.checkedTarget).toBe('http://127.0.0.1:20128/v1/models');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:20128/v1/models',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('probes ZavorthBridge Remote through the local sidecar health endpoint when it is ready', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    })) as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      sidecarStatusService: {
        readSummary: () => ({
          AIGateway: {} as any,
          ZavorthTerminal: {
            id: 'omni-zavorth-bridge-remote',
            name: 'ZavorthBridge Remote',
            enabled: true,
            running: true,
            ready: true,
            spawnedByZavorth: true,
            pid: 5151,
            baseUrl: 'http://127.0.0.1:4747',
            localUrl: 'http://192.168.0.10:4747',
            sourceDir: 'C:/vendor/agremote',
            checkedAt: '2026-04-01T18:00:00.000Z',
            message: 'ZavorthBridge Remote online.',
          },
        }),
      } as any,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('omni-zavorth-bridge-remote-chat');

    expect(snapshot.status).toBe('ok');
    expect(snapshot.transport).toBe('runtime');
    expect(snapshot.checkedTarget).toBe('http://127.0.0.1:4747/health');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:4747/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('probes ExternalExecutor through the real executor availability check', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    const fetchImpl = jest.fn() as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      externalExecutorExecutor: {
        isAvailable: jest.fn(async () => true),
      } as any,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('external_executor');

    expect(snapshot.status).toBe('ok');
    expect(snapshot.transport).toBe('cli');
    expect(snapshot.summary).toContain('ExternalExecutor');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('probes Ollama through the configured local host', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    process.env.OLLAMA_HOST = 'http://127.0.0.1:11434';
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{"models":[]}',
    })) as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('ollama');

    expect(snapshot.status).toBe('ok');
    expect(snapshot.transport).toBe('runtime');
    expect(snapshot.checkedTarget).toBe('http://127.0.0.1:11434/api/tags');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('marks unsupported integrations clearly instead of probing blindly', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    const fetchImpl = jest.fn() as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('custom-api');

    expect(snapshot.status).toBe('unsupported');
    expect(snapshot.summary).toContain('ainda nao disponivel');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps channel doctor results into probe snapshots for channel integrations', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    const fetchImpl = jest.fn() as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      channelProviderDoctorService: {
        run: jest.fn(async () => ({
          status: 'passed',
          summary: 'Todos os canais conferidos.',
          generatedAt: '2026-04-01T18:00:00.000Z',
          command: 'npm run test:channels:smoke',
          items: [
            {
              channelId: 'slack',
              status: 'passed',
              configured: true,
              mode: 'stub',
              summary: 'Slack pronto em modo stub.',
              details: ['Doctor honesto no runtime local.'],
              error: null,
            },
          ],
        })),
      } as any,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('slack');

    expect(snapshot.status).toBe('ok');
    expect(snapshot.transport).toBe('runtime');
    expect(snapshot.summary).toContain('Slack');
    expect(snapshot.detail).toContain('runtime local');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('probes the public /app for the Oracle + Cloudflare + Gemma recipe when configured', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-')), 'probes.json');
    (config as any).cloudflareTunnelPublicHostname = 'zavorth.example.com';
    (config as any).cloudflareAiGatewayEnabled = true;
    (config as any).geminiApiKey = 'AIza-rollout';
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '<html></html>',
    })) as any;
    const service = new IntegrationProbeService({
      registryService: new IntegrationRegistryService(),
      stateFile,
      fetchImpl,
      now: () => new Date('2026-04-01T18:00:00.000Z'),
    });

    const snapshot = await service.runProbe('oracle-cloudflare-gemma');

    expect(snapshot.status).toBe('ok');
    expect(snapshot.checkedTarget).toBe('https://zavorth.example.com/app');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://zavorth.example.com/app',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
