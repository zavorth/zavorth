import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index';
import { IntegrationHealthService } from '../../src/services/IntegrationHealthService';
import { IntegrationInstallerService } from '../../src/services/IntegrationInstallerService';
import { IntegrationProbeService } from '../../src/services/IntegrationProbeService';

describe('IntegrationHealthService', () => {
  const originalDbEncryptionKey = config.dbEncryptionKey;
  const originalOpenAiApiKey = config.openaiApiKey;
  const originalOpenRouterApiKey = config.openRouterApiKey;
  const originalMiniMaxApiKey = (config as any).minimaxApiKey;
  const originalEnvOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
  const originalTunnelHostname = config.cloudflareTunnelPublicHostname;
  const originalGatewayEnabled = config.cloudflareAiGatewayEnabled;
  const originalAIGatewaySidecarEnabled = config.AIGatewaySidecarEnabled;
  const originalGeminiApiKey = config.geminiApiKey;

  beforeEach(() => {
    (config as any).dbEncryptionKey = 'integration-health-test-key';
    (config as any).openaiApiKey = '';
    (config as any).openRouterApiKey = '';
    (config as any).minimaxApiKey = '';
    (config as any).cloudflareTunnelPublicHostname = '';
    (config as any).cloudflareAiGatewayEnabled = false;
    (config as any).AIGatewaySidecarEnabled = false;
    (config as any).geminiApiKey = '';
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    (config as any).dbEncryptionKey = originalDbEncryptionKey;
    (config as any).openaiApiKey = originalOpenAiApiKey;
    (config as any).openRouterApiKey = originalOpenRouterApiKey;
    (config as any).minimaxApiKey = originalMiniMaxApiKey;
    (config as any).cloudflareTunnelPublicHostname = originalTunnelHostname;
    (config as any).cloudflareAiGatewayEnabled = originalGatewayEnabled;
    (config as any).AIGatewaySidecarEnabled = originalAIGatewaySidecarEnabled;
    (config as any).geminiApiKey = originalGeminiApiKey;
    if (typeof originalEnvOpenRouterApiKey === 'string') {
      process.env.OPENROUTER_API_KEY = originalEnvOpenRouterApiKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it('reports native providers as healthy when runtime credentials already exist', () => {
    const previous = config.openRouterApiKey;
    const previousEnv = process.env.OPENROUTER_API_KEY;
    (config as any).openRouterApiKey = 'test-key';
    process.env.OPENROUTER_API_KEY = 'test-key';

    try {
      const service = new IntegrationHealthService();
      const snapshot = service.buildDoctorSnapshot('openrouter');

      expect(snapshot.status).toBe('ok');
      expect(snapshot.findings.some((entry) => entry.title === 'Runtime detectado')).toBe(true);
      expect(snapshot.playbook?.headline).toBe('Integration ready for use');
    } finally {
      (config as any).openRouterApiKey = previous;
      if (typeof previousEnv === 'string') {
        process.env.OPENROUTER_API_KEY = previousEnv;
      } else {
        delete process.env.OPENROUTER_API_KEY;
      }
    }
  });

  it('reports MiniMax direct as healthy when MINIMAX_API_KEY already exists in runtime', () => {
    const previous = (config as any).minimaxApiKey;
    (config as any).minimaxApiKey = 'minimax-runtime-key';

    try {
      const service = new IntegrationHealthService();
      const snapshot = service.buildDoctorSnapshot('minimax');

      expect(snapshot.status).toBe('ok');
      expect(snapshot.findings.some((entry) => entry.title === 'Runtime detectado')).toBe(true);
      expect(snapshot.playbook?.headline).toBe('Integration ready for use');
    } finally {
      (config as any).minimaxApiKey = previous;
    }
  });

  it('keeps templates in warning mode', () => {
    const service = new IntegrationHealthService();
    const snapshot = service.buildDoctorSnapshot('custom-api');

    expect(snapshot.status).toBe('warn');
    expect(snapshot.findings.some((entry) => entry.title.includes('Template'))).toBe(true);
    expect(snapshot.playbook?.steps.some((entry) => entry.id === 'onboarding')).toBe(true);
  });

  it('flags missing provider credentials when only a draft exists', () => {
    const installer = new IntegrationInstallerService({
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    });
    installer.buildDraft({
      requestedId: 'openai',
      persist: false,
    });

    const service = new IntegrationHealthService({
      installerService: installer,
    });
    const snapshot = service.buildDoctorSnapshot('openai');

    expect(snapshot.status).toBe('warn');
    expect(snapshot.findings.some((entry) => entry.title === 'Requisitos pendentes')).toBe(true);
    expect(snapshot.playbook?.steps.some((entry) => entry.id === 'requirements')).toBe(true);
  });

  it('suggests runtime repair when the hub already stores the secret', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-health-'));
    const installer = new IntegrationInstallerService({
      stateFile: path.join(tempDir, 'state.json'),
      secretsFile: path.join(tempDir, 'secrets.json'),
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    });
    installer.buildDraft({
      requestedId: 'openrouter',
      answers: {
        openrouter_api_key: 'sk-health-123',
      },
      persist: true,
    });

    const service = new IntegrationHealthService({
      installerService: installer,
    });
    const snapshot = service.buildDoctorSnapshot('openrouter');

    expect(snapshot.status).toBe('warn');
    expect(snapshot.nextAction.label).toBe('Reparar binding do runtime');
    expect(snapshot.nextAction.command).toBe('usar fluxo assistido do Integration Hub');
    expect(snapshot.playbook?.steps.some((entry) => entry.actionId === 'repair-runtime' && entry.status === 'next')).toBe(true);
  });

  it('suggests runtime repair for channel configs stored as env-backed non-secret answers', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-health-'));
    const installer = new IntegrationInstallerService({
      stateFile: path.join(tempDir, 'state.json'),
      secretsFile: path.join(tempDir, 'secrets.json'),
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    });
    installer.buildDraft({
      requestedId: 'slack',
      answers: {
        slack_enabled: true,
        slack_transport: 'stub',
        slack_workspace_id: 'T-ops',
      },
      persist: true,
    });

    const service = new IntegrationHealthService({
      installerService: installer,
    });
    const snapshot = service.buildDoctorSnapshot('slack');

    expect(snapshot.status).toBe('warn');
    expect(snapshot.nextAction.label).toBe('Reparar binding do runtime');
    expect(snapshot.findings.some((entry) => entry.title.includes('Configuraction guardada'))).toBe(true);
    expect(snapshot.playbook?.steps.some((entry) => entry.actionId === 'repair-runtime' && entry.status === 'next')).toBe(true);
  });

  it('escalates the doctor when the last real probe failed', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-health-'));
    const installer = new IntegrationInstallerService({
      stateFile: path.join(tempDir, 'state.json'),
      secretsFile: path.join(tempDir, 'secrets.json'),
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    });
    (config as any).openRouterApiKey = 'sk-live-health';
    process.env.OPENROUTER_API_KEY = 'sk-live-health';
    const probe = new IntegrationProbeService({
      stateFile: path.join(tempDir, 'probes.json'),
      now: () => new Date('2026-04-01T12:00:00.000Z'),
      fetchImpl: jest.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => 'invalid api key',
      })) as any,
    });
    await probe.runProbe('openrouter');

    const service = new IntegrationHealthService({
      installerService: installer,
      probeService: probe,
    });
    const snapshot = service.buildDoctorSnapshot('openrouter');

    expect(snapshot.status).toBe('error');
    expect(snapshot.probe).toEqual(
      expect.objectContaining({
        status: 'failed',
        httpStatus: 401,
      }),
    );
    expect(snapshot.findings.some((entry) => entry.title === 'Probe real falhou')).toBe(true);
    expect(snapshot.nextAction.label).toContain('Revalidar');
    expect(snapshot.playbook?.steps.some((entry) => entry.actionId === 'validate-now' && entry.detail.includes('falhou'))).toBe(true);
  });

  it('reports when the last real probe succeeded', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-health-'));
    (config as any).openRouterApiKey = 'sk-live-health';
    process.env.OPENROUTER_API_KEY = 'sk-live-health';
    const probe = new IntegrationProbeService({
      stateFile: path.join(tempDir, 'probes.json'),
      now: () => new Date('2026-04-01T12:00:00.000Z'),
      fetchImpl: jest.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '{"data":[]}',
      })) as any,
    });
    await probe.runProbe('openrouter');

    const service = new IntegrationHealthService({
      probeService: probe,
    });
    const snapshot = service.buildDoctorSnapshot('openrouter');

    expect(snapshot.status).toBe('ok');
    expect(snapshot.findings.some((entry) => entry.title === 'Probe real approved')).toBe(true);
    expect(snapshot.playbook?.steps.some((entry) => entry.id === 'use-runtime' && entry.status === 'done')).toBe(true);
  });

  it('suggests starting the AIGateway sidecar when the runtime is not ready yet', () => {
    (config as any).AIGatewaySidecarEnabled = true;

    const service = new IntegrationHealthService({
      sidecarStatusService: {
        readSummary: () => ({
          AIGateway: {
            id: 'AIGateway',
            name: 'AIGateway',
            enabled: true,
            running: false,
            ready: false,
            spawnedByZavorth: false,
            pid: null,
            baseUrl: 'http://127.0.0.1:20128/v1',
            localUrl: null,
            sourceDir: 'C:/vendor/AIGateway',
            checkedAt: '',
            message: 'Ainda not iniciou.',
          },
          ZavorthTerminal: {} as any,
        }),
      } as any,
    });

    const snapshot = service.buildDoctorSnapshot('AIGateway');

    expect(snapshot.status).toBe('warn');
    expect(snapshot.nextAction.label).toBe('Subir sidecar AIGateway');
    expect(snapshot.playbook?.steps.some((entry) => entry.actionId === 'recipe:AIGateway:start-sidecar')).toBe(true);
  });

  it('suggests starting the ZavorthBridge Remote sidecar when the runtime is not ready yet', () => {
    const service = new IntegrationHealthService({
      sidecarStatusService: {
        readSummary: () => ({
          AIGateway: {} as any,
          ZavorthTerminal: {
            id: 'omni-zavorth-bridge-remote',
            name: 'ZavorthBridge Remote',
            enabled: true,
            running: false,
            ready: false,
            spawnedByZavorth: false,
            pid: null,
            baseUrl: 'http://127.0.0.1:4747',
            localUrl: null,
            sourceDir: 'C:/vendor/agremote',
            checkedAt: '',
            message: 'Ainda not iniciou.',
          },
        }),
      } as any,
    });

    const snapshot = service.buildDoctorSnapshot('omni-zavorth-bridge-remote-chat');

    expect(snapshot.status).toBe('warn');
    expect(snapshot.nextAction.label).toBe('Subir sidecar ZavorthBridge Remote');
    expect(snapshot.playbook?.steps.some((entry) => entry.actionId === 'recipe:zavorth-bridge-remote:start-sidecar')).toBe(true);
  });

  it('suggests preparing the Ollama host when the draft exists but no host was configured yet', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-health-'));
    const installer = new IntegrationInstallerService({
      stateFile: path.join(tempDir, 'state.json'),
      secretsFile: path.join(tempDir, 'secrets.json'),
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    });
    installer.buildDraft({
      requestedId: 'ollama',
      selectedMode: 'docker',
      persist: true,
    });

    const service = new IntegrationHealthService({
      installerService: installer,
    });
    const snapshot = service.buildDoctorSnapshot('ollama');

    expect(snapshot.status).toBe('warn');
    expect(snapshot.nextAction.label).toBe('Prepare local Ollama host');
    expect(snapshot.playbook?.steps.some((entry) => entry.actionId === 'recipe:ollama:prepare-host')).toBe(true);
  });

  it('recognizes the Oracle + Cloudflare + Gemma recipe when the stack markers exist', () => {
    (config as any).cloudflareTunnelPublicHostname = 'zavorth.example.com';
    (config as any).cloudflareAiGatewayEnabled = true;
    (config as any).geminiApiKey = 'AIza-rollout';

    const service = new IntegrationHealthService();
    const snapshot = service.buildDoctorSnapshot('oracle-cloudflare-gemma');

    expect(snapshot.status).toBe('ok');
    expect(snapshot.findings.some((entry) => entry.title === 'Runtime detectado')).toBe(true);
    expect(snapshot.binding.status).toBe('ready');
  });
});
