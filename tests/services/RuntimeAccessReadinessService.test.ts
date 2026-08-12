import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { RuntimeAccessReadinessService } from '../../src/runtime/access/RuntimeAccessReadinessService.js';

function createProviderSnapshot(overrides: Partial<any> = {}) {
  return {
    activeProviderName: 'gemini',
    activeModelName: 'gemini-2.5-flash',
    preferredZavorthBridgeModel: 'zavorth-control-coder',
    readyCount: 1,
    needsConfigurationCount: 1,
    needsProbeCount: 1,
    recommendedProfile: 'Balanced',
    readyProviders: ['gemini'],
    pendingConfigProviders: ['openai'],
    probeProviders: ['AIGateway'],
    recommendations: ['Mantenha Gemini como rota principal enquanto o resto entra em estado saudavel.'],
    ...overrides,
  };
}

function createMcpSnapshot(overrides: Partial<any> = {}) {
  return {
    manifestPath: 'config/mcp-servers.json',
    summary: {
      total: 2,
      enabled: 1,
      connected: 1,
      failed: 0,
      disabled: 1,
      stopped: 0,
      toolCount: 2,
      capabilityCount: 2,
    },
    capabilities: ['filesystem', 'reasoning'],
    recommendations: ['MCP esta coerente com o manifesto e com o runtime atual.'],
    ...overrides,
  };
}

function createDiscordBridgeSnapshot(overrides: Partial<any> = {}) {
  return {
    mode: 'native',
    enabled: false,
    started: false,
    allowDirectMessages: false,
    allowedGuildIds: [],
    pendingInbox: 0,
    pendingOutbox: 0,
    lastError: null,
    updatedAt: null,
    ...overrides,
  };
}

function writeNodeMeshSmokeReport(root: string, overrides: Partial<any> = {}) {
  const nodeMeshSmokeReportFile = path.join(root, 'node-mesh-smoke-last.json');
  fs.writeFileSync(
    nodeMeshSmokeReportFile,
    JSON.stringify(
      {
        startedAt: '2026-04-01T09:00:00.000Z',
        finishedAt: '2026-04-01T09:01:00.000Z',
        status: 'passed',
        ok: true,
        command: 'npm run test:nodes:smoke',
        summary: 'Smoke real do Node Mesh passou com pairing, heartbeat e invoke completos.',
        nodeId: 'node-smoke-1',
        baseUrl: 'http://127.0.0.1:33444',
        runStdout: 'NODE_MESH_SMOKE_OK',
        outputFile: path.join(root, 'workspace', 'artifacts', 'node-mesh-smoke.txt'),
        finalNodeStatus: 'online',
        recentCapabilityId: 'files.write',
        error: null,
        artifactsRoot: root,
        artifactsPreserved: false,
        ...overrides,
      },
      null,
      2,
    ),
    'utf8',
  );
  return nodeMeshSmokeReportFile;
}

function writeChannelProviderDoctorReport(root: string, overrides: Partial<any> = {}) {
  const channelProviderDoctorReportFile = path.join(root, 'channel-provider-doctor-last.json');
  fs.writeFileSync(
    channelProviderDoctorReportFile,
    JSON.stringify(
      {
        checkedAt: '2026-04-01T09:02:00.000Z',
        status: 'passed',
        command: 'npm run test:channels:smoke',
        summary: 'Doctor dos canais nativos validou os providers configurados.',
        items: [
          {
            channelId: 'slack',
            mode: 'native',
            status: 'passed',
            configured: true,
            summary: 'Slack native validado.',
            error: null,
          },
          {
            channelId: 'whatsapp',
            mode: 'cloud-api',
            status: 'passed',
            configured: true,
            summary: 'WhatsApp Cloud API validada.',
            error: null,
          },
        ],
        ...overrides,
      },
      null,
      2,
    ),
    'utf8',
  );
  return channelProviderDoctorReportFile;
}

function writeRemoteTransportDoctorReport(root: string, overrides: Partial<any> = {}) {
  const remoteTransportDoctorReportFile = path.join(root, 'remote-transport-doctor-last.json');
  fs.writeFileSync(
    remoteTransportDoctorReportFile,
    JSON.stringify(
      {
        checkedAt: '2026-04-05T09:03:00.000Z',
        status: 'passed',
        command: 'npm run test:transports:smoke',
        summary: 'Doctor dos transportes remotos validou os fluxos configurados.',
        items: [
          {
            transportId: 'AIGateway',
            mode: 'remote',
            status: 'passed',
            configured: true,
            summary: 'AIGateway remoto validado.',
            error: null,
          },
          {
            transportId: 'node-host',
            mode: 'local',
            status: 'passed',
            configured: true,
            summary: 'Node host pareado validado.',
            error: null,
          },
        ],
        ...overrides,
      },
      null,
      2,
    ),
    'utf8',
  );
  return remoteTransportDoctorReportFile;
}

function writeSystemOverlordSmokeReport(root: string, overrides: Partial<any> = {}) {
  const systemOverlordSmokeReportFile = path.join(root, 'system-overlord-smoke-last.json');
  fs.writeFileSync(
    systemOverlordSmokeReportFile,
    JSON.stringify(
      {
        startedAt: '2026-04-05T09:04:00.000Z',
        finishedAt: '2026-04-05T09:05:00.000Z',
        status: 'passed',
        ok: true,
        command: 'npm run test:overlord:smoke',
        summary: 'Smoke do System Overlord validou browser e tunel e pulou dependencias opcionais honestamente.',
        probeUrl: 'http://127.0.0.1:33555/',
        items: [
          {
            capability: 'browser.control',
            status: 'passed',
            runtimeTarget: 'browser',
            summary: 'Browser control supervisionado navegou no alvo local.',
            error: null,
            operatorNextStep: null,
          },
          {
            capability: 'network.tunnel',
            status: 'passed',
            runtimeTarget: 'host',
            summary: 'Tunel supervisionado publicou um alvo local e encerrou o publish com rollback.',
            error: null,
            operatorNextStep: null,
          },
          {
            capability: 'wsl.exec',
            status: 'skipped',
            runtimeTarget: 'wsl',
            summary: 'WSL supervisionado pulado porque o runtime ainda nao esta pronto.',
            error: null,
            operatorNextStep: 'Instale/configure o WSL antes de validar wsl.exec.',
          },
        ],
        error: null,
        ...overrides,
      },
      null,
      2,
    ),
    'utf8',
  );
  return systemOverlordSmokeReportFile;
}

describe('RuntimeAccessReadinessService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    jest.restoreAllMocks();
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('reports local and remote readiness when runtime, auth and public url are healthy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-ready-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const discordBridgeStatusFile = path.join(root, 'discord-bridge-status.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const tokenFile = path.join(root, 'web-token.txt');
    const remoteTransportDoctorReportFileReady = writeRemoteTransportDoctorReport(root);

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4101, owner: 'host-supervisor', startedAt: '2026-03-31T12:00:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4102, owner: 'telegram-worker', startedAt: '2026-03-31T12:00:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      discordBridgeStatusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: true,
        allowDirectMessages: true,
        allowedGuildIds: ['guild-1'],
        pendingInbox: 0,
        pendingOutbox: 0,
        lastError: null,
        updatedAt: '2026-03-31T12:00:03.000Z',
      }),
      'utf8',
    );
    fs.writeFileSync(tokenFile, 'runtime-token-123', 'utf8');

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      discordBridgeStatusFile,
      tenantRegistryFile,
      webAuthTokenFile: tokenFile,
      publicBaseUrl: 'https://zavorth.example.com',
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFileReady,
      webAuthToken: '',
      highRiskApprovalPin: '',
      kill: (pid: number) => {
        if (pid !== 4101 && pid !== 4102) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-a',
        storedFingerprint: 'fingerprint-a',
      },
    });

    expect(report.local.ready).toBe(true);
    expect(report.remote.ready).toBe(true);
    expect(report.auth.source).toBe('runtime-file');
    expect(report.runtime.discordBridge).toEqual(
      expect.objectContaining({
        enabled: true,
        started: true,
        allowedGuildIds: ['guild-1'],
      }),
    );
    expect(report.runtime.providers).toEqual(
      expect.objectContaining({
        activeProviderName: 'gemini',
        readyCount: 1,
        recommendedProfile: 'Balanced',
      }),
    );
    expect(report.runtime.mcp).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          connected: 1,
          toolCount: 2,
        }),
      }),
    );
    expect(report.remote.appUrl).toBe('https://zavorth.example.com/zavorthControl');
    expect(report.runtime.remoteTransportDoctor).toEqual(
      expect.objectContaining({
        available: true,
        status: 'passed',
        stale: expect.any(Boolean),
      }),
    );
    expect(report.summary).toBe('Zavorth pronto para uso local e remoto.');
    expect(report.recommendations).toContain(
      'O gateway nativo do Discord esta pronto para receber mensagens diretamente.',
    );
    expect(report.nextSteps.some((step) => step.id === 'connect-remote-frontend')).toBe(true);
  });

  it('surfaces learning, layered memory and platform governance in recommendations and next steps', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-learning-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tokenFile = path.join(root, 'web-token.txt');

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4301, owner: 'host-supervisor', startedAt: '2026-03-31T12:20:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4302, owner: 'telegram-worker', startedAt: '2026-03-31T12:20:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(tokenFile, 'runtime-token-789', 'utf8');

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      webAuthTokenFile: tokenFile,
      publicBaseUrl: 'https://zavorth.example.com',
      kill: (pid: number) => {
        if (pid !== 4301 && pid !== 4302) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-c',
        storedFingerprint: 'fingerprint-c',
      },
      learning: {
        generatedAt: '2026-04-09T12:00:00.000Z',
        summary: {
          total: 3,
          pending: 2,
          approved: 1,
          promoted: 1,
          quarantined: 1,
          highConfidence: 2,
        },
        narrative: {
          headline: 'Learning com drafts de alta confianca.',
          operatorSummary: '2 pendentes e 1 promoted.',
        },
      },
      layeredMemory: {
        generatedAt: '2026-04-09T12:00:00.000Z',
        summary: {
          total: 8,
          episodic: 3,
          semantic: 2,
          procedural: 3,
        },
        budgets: {
          perLayer: 12,
          episodicUsage: 0.25,
          semanticUsage: 0.17,
          proceduralUsage: 0.25,
        },
        narrative: {
          headline: 'Recall em camadas ativo.',
          operatorSummary: '3 procedimentos prontos.',
        },
      },
      platform: {
        generatedAt: '2026-04-09T12:00:00.000Z',
        summary: {
          total: 9,
          plugins: 2,
          skills: 3,
          mcps: 2,
          collections: 1,
          recipes: 1,
          reviewPending: 2,
          quarantined: 1,
          learnedLocal: 2,
        },
        catalogSyncSummary: 'Registry remoto sincronizado.',
        narrative: {
          headline: 'Governanca do platform plane ativa.',
          operatorSummary: '2 em review e 1 em quarentena.',
        },
      },
    });

    expect(report.runtime.learning).toEqual(
      expect.objectContaining({
        available: true,
        summary: expect.objectContaining({
          pending: 2,
          quarantined: 1,
        }),
      }),
    );
    expect(report.runtime.layeredMemory).toEqual(
      expect.objectContaining({
        available: true,
        summary: expect.objectContaining({
          procedural: 3,
        }),
      }),
    );
    expect(report.runtime.platform).toEqual(
      expect.objectContaining({
        available: true,
        summary: expect.objectContaining({
          reviewPending: 2,
          quarantined: 1,
        }),
      }),
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('learning plane tem 2 candidato(s) pendente(s)'),
        expect.stringContaining('layered memory tem 3 procedimento(s) validado(s)'),
        expect.stringContaining('platform plane tem 2 item(ns) em review e 1 em quarentena'),
      ]),
    );
    expect(report.nextSteps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        'review-learning-candidates',
        'consult-procedural-memory',
        'review-platform-governance',
      ]),
    );
  });

  it('flags missing public access, unauthorized host and worker outage with actionable next steps', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-pending-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const discordBridgeStatusFile = path.join(root, 'discord-bridge-status.json');
    const capabilityLifecycleStateFile = path.join(root, 'capability-lifecycle-state.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const remoteTransportDoctorReportFilePending = writeRemoteTransportDoctorReport(root);
    const tokenFile = path.join(root, 'web-token.txt');

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4201, owner: 'host-supervisor', startedAt: '2026-03-31T12:10:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 9999, owner: 'telegram-worker', startedAt: '2026-03-31T12:10:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      discordBridgeStatusFile,
      JSON.stringify({
        mode: 'bridge',
        enabled: true,
        started: false,
        allowDirectMessages: false,
        allowedGuildIds: ['guild-2'],
        pendingInbox: 1,
        pendingOutbox: 0,
        lastError: 'relay offline',
        updatedAt: '2026-03-31T12:10:03.000Z',
      }),
      'utf8',
    );

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      discordBridgeStatusFile,
      tenantRegistryFile,
      webAuthTokenFile: tokenFile,
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFilePending,
      webAuthToken: '',
      highRiskApprovalPin: '654321',
      publicBaseUrl: '',
      capabilityLifecycleStateFile,
      discordRequiredOnBoot: true,
      kill: (pid: number) => {
        if (pid === 4201) {
          return;
        }
        const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
        throw error;
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot({
        summary: {
          total: 1,
          enabled: 1,
          connected: 0,
          failed: 1,
          disabled: 0,
          stopped: 0,
          toolCount: 0,
          capabilityCount: 1,
        },
        recommendations: ['Existe servidor MCP falhando no bootstrap; vale revisar manifesto, binario e credenciais antes de confiar nessa capability.'],
      }),
      hostIdentityStatus: {
        authorized: false,
        firstRun: false,
        currentFingerprint: 'fingerprint-b',
        storedFingerprint: 'fingerprint-a',
      },
    });

    expect(report.local.ready).toBe(false);
    expect(report.remote.ready).toBe(false);
    expect(report.auth.source).toBe('missing');
    expect(report.local.issues).toEqual(
      expect.arrayContaining([
        'O worker principal do Zavorth nao esta ativo.',
        'O host atual ainda nao foi autorizado para execucoes mutaveis.',
      ]),
    );
    expect(report.remote.issues).toEqual(
      expect.arrayContaining([
        'ZAVORTH_PUBLIC_BASE_URL ainda nao foi configurada.',
        'O host atual ainda nao foi autorizado para execucoes mutaveis.',
      ]),
    );
    expect(report.nextSteps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        'recover-worker',
        'trust-host',
        'recover-discord-bridge',
        'recover-mcp-runtime',
        'configure-public-base-url',
        'configure-web-token',
      ]),
    );
    expect(report.recommendations).toContain(
      'O PIN de alto risco continua reservado para confirmacoes criticas; defina ZAVORTH_WEB_AUTH_TOKEN dedicado para liberar o acesso web.',
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Discord .*degradado|Discord .*ainda nao entrou em estado pronto\./),
      ]),
    );
  });

  it('blocks readiness when no conversational provider is ready', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-providers-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tokenFile = path.join(root, 'web-token.txt');

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4211, owner: 'host-supervisor', startedAt: '2026-03-31T12:11:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4212, owner: 'telegram-worker', startedAt: '2026-03-31T12:11:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(tokenFile, 'runtime-token-456', 'utf8');

    const service = new RuntimeAccessReadinessService({
      now: () => new Date('2026-04-01T09:05:00.000Z'),
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      webAuthTokenFile: tokenFile,
      publicBaseUrl: 'https://zavorth.example.com',
      kill: (pid: number) => {
        if (pid !== 4211 && pid !== 4212) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot({
        readyCount: 0,
        needsConfigurationCount: 2,
        readyProviders: [],
        recommendations: ['Configure GEMINI_API_KEY antes do rollout publico.'],
      }),
      mcp: createMcpSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-provider',
        storedFingerprint: 'fingerprint-provider',
      },
    });

    expect(report.local.ready).toBe(false);
    expect(report.local.issues).toEqual(
      expect.arrayContaining(['Nenhum provider conversacional esta pronto no runtime atual.']),
    );
    expect(report.nextSteps.map((step) => step.id)).toContain('configure-primary-provider');
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        'Nenhum provider pronto foi encontrado; configure ao menos uma rota cloud antes de tratar o runtime como operacional.',
      ]),
    );
  });

  it('surfaces pending tenant onboarding as a readiness blocker for public runtimes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-tenants-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const remoteTransportDoctorReportFileTenant = writeRemoteTransportDoctorReport(root);
    const tokenFile = path.join(root, 'web-token.txt');

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4401, owner: 'host-supervisor', startedAt: '2026-03-31T13:00:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4402, owner: 'telegram-worker', startedAt: '2026-03-31T13:00:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      tenantRegistryFile,
      JSON.stringify({
        tenants: {
          'discord:guild:guild-1': {
            tenantId: 'discord:guild:guild-1',
            tenantType: 'discord_guild',
            boundary: 'shared',
            isolationMode: 'tenant',
            onboardingStatus: 'pending_onboarding',
            platform: 'discord',
            policyProfile: 'discord-public-guild',
            publicServerMode: true,
            channelId: 'channel-9',
            ownerUserIds: ['owner-1'],
            allowedGuildIds: ['guild-1'],
            allowedChannelIds: [],
            firstSeenAt: '2026-03-31T12:59:00.000Z',
            lastSeenAt: '2026-03-31T13:00:30.000Z',
          },
        },
      }),
      'utf8',
    );
    fs.writeFileSync(tokenFile, 'runtime-token-123', 'utf8');

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      webAuthTokenFile: tokenFile,
      publicBaseUrl: 'https://zavorth.example.com',
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFileTenant,
      kill: (pid: number) => {
        if (pid !== 4401 && pid !== 4402) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      discordBridge: createDiscordBridgeSnapshot(),
      tenants: {
        totalCount: 1,
        sharedCount: 1,
        personalCount: 0,
        pendingOnboardingCount: 1,
        publicServerCount: 1,
        byPlatform: { discord: 1 },
        recent: [],
        pendingOnboarding: [
          {
            tenantId: 'discord:guild:guild-1',
            platform: 'discord',
            onboardingStatus: 'pending_onboarding',
            publicServerMode: true,
          },
        ],
        file: tenantRegistryFile,
      },
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-d',
        storedFingerprint: 'fingerprint-d',
      },
    });

    expect(report.local.ready).toBe(true);
    expect(report.remote.ready).toBe(false);
    expect(report.runtime.tenants.pendingOnboardingCount).toBe(1);
    expect(report.local.issues).toEqual([]);
    expect(report.remote.issues).toEqual(
      expect.arrayContaining([
        'Ainda existem tenants compartilhados sem onboarding/policy completos.',
      ]),
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Feche o onboarding/policy de discord:guild:guild-1'),
      ]),
    );
    expect(report.nextSteps.map((step) => step.id)).toContain('finish-tenant-onboarding');
  });

  it('surfaces a passed Node Mesh smoke report in the readiness snapshot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-node-smoke-pass-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tokenFile = path.join(root, 'web-token.txt');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const remoteTransportDoctorReportFileNodePass = writeRemoteTransportDoctorReport(root);
    const nodeMeshSmokeReportFile = writeNodeMeshSmokeReport(root);
    const systemOverlordSmokeReportFile = writeSystemOverlordSmokeReport(root);

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4701, owner: 'host-supervisor', startedAt: '2026-04-01T09:00:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4702, owner: 'telegram-worker', startedAt: '2026-04-01T09:00:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(tokenFile, 'runtime-token-pass', 'utf8');

    const service = new RuntimeAccessReadinessService({
      now: () => new Date('2026-04-01T09:05:00.000Z'),
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      webAuthTokenFile: tokenFile,
      publicBaseUrl: 'https://zavorth.example.com',
      nodeMeshSmokeReportFile,
      systemOverlordSmokeReportFile,
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFileNodePass,
      kill: (pid: number) => {
        if (pid !== 4701 && pid !== 4702) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-node-pass',
        storedFingerprint: 'fingerprint-node-pass',
      },
    });

    expect(report.runtime.nodeMeshSmoke).toEqual(
      expect.objectContaining({
        available: true,
        status: 'passed',
        nodeId: 'node-smoke-1',
        finalNodeStatus: 'online',
        recentCapabilityId: 'files.write',
      }),
    );
    expect(report.runtime.systemOverlordSmoke).toEqual(
      expect.objectContaining({
        available: true,
        status: 'passed',
        items: expect.arrayContaining([
          expect.objectContaining({
            capability: 'browser.control',
            status: 'passed',
          }),
        ]),
      }),
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('O Node Mesh passou no smoke real'),
        expect.stringContaining('O System Overlord passou no smoke'),
      ]),
    );
    expect(report.nextSteps.map((step) => step.id)).not.toContain('validate-node-mesh-smoke');
    expect(report.nextSteps.map((step) => step.id)).not.toContain('validate-system-overlord-smoke');
  });

  it('keeps readiness usable but asks for revalidation when the Node Mesh smoke report gets stale', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-node-smoke-stale-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tokenFile = path.join(root, 'web-token.txt');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const nodeMeshSmokeReportFile = writeNodeMeshSmokeReport(root);
    const remoteTransportDoctorReportFileNodeStale = writeRemoteTransportDoctorReport(root);

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4705, owner: 'host-supervisor', startedAt: '2026-04-01T09:00:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4706, owner: 'telegram-worker', startedAt: '2026-04-01T09:00:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(tokenFile, 'runtime-token-stale', 'utf8');

    const service = new RuntimeAccessReadinessService({
      now: () => new Date('2026-04-02T00:00:00.000Z'),
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      webAuthTokenFile: tokenFile,
      publicBaseUrl: 'https://zavorth.example.com',
      nodeMeshSmokeReportFile,
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFileNodeStale,
      kill: (pid: number) => {
        if (pid !== 4705 && pid !== 4706) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-node-stale',
        storedFingerprint: 'fingerprint-node-stale',
      },
    });

    expect(report.local.ready).toBe(true);
    expect(report.remote.ready).toBe(true);
    expect(report.runtime.nodeMeshSmoke).toEqual(
      expect.objectContaining({
        available: true,
        status: 'passed',
        stale: true,
      }),
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ficou velho'),
      ]),
    );
    expect(report.nextSteps.map((step) => step.id)).toContain('validate-node-mesh-smoke');
  });

  it('surfaces a passed native channel doctor report in the readiness snapshot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-channel-doctor-pass-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tokenFile = path.join(root, 'web-token.txt');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const channelProviderDoctorReportFile = writeChannelProviderDoctorReport(root);
    const remoteTransportDoctorReportFileChannelPass = writeRemoteTransportDoctorReport(root);

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4721, owner: 'host-supervisor', startedAt: '2026-04-01T09:00:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4722, owner: 'telegram-worker', startedAt: '2026-04-01T09:00:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(tokenFile, 'runtime-token-channel-pass', 'utf8');

    const service = new RuntimeAccessReadinessService({
      now: () => new Date('2026-04-01T09:05:00.000Z'),
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      webAuthTokenFile: tokenFile,
      publicBaseUrl: 'https://zavorth.example.com',
      channelProviderDoctorReportFile,
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFileChannelPass,
      kill: (pid: number) => {
        if (pid !== 4721 && pid !== 4722) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-channel-pass',
        storedFingerprint: 'fingerprint-channel-pass',
      },
    });

    expect(report.runtime.channelProviderDoctor).toEqual(
      expect.objectContaining({
        available: true,
        status: 'passed',
        stale: false,
        command: 'npm run test:channels:smoke',
      }),
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('doctor dos canais nativos validou Slack native e WhatsApp Cloud API'),
      ]),
    );
    expect(report.nextSteps.map((step) => step.id)).not.toContain('validate-channel-providers');
  });

  it('asks for native channel doctor revalidation when the report gets stale', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-channel-doctor-stale-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tokenFile = path.join(root, 'web-token.txt');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const channelProviderDoctorReportFile = writeChannelProviderDoctorReport(root);
    const remoteTransportDoctorReportFileChannelStale = writeRemoteTransportDoctorReport(root);

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4725, owner: 'host-supervisor', startedAt: '2026-04-01T09:00:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4726, owner: 'telegram-worker', startedAt: '2026-04-01T09:00:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(tokenFile, 'runtime-token-channel-stale', 'utf8');

    const service = new RuntimeAccessReadinessService({
      now: () => new Date('2026-04-02T00:00:00.000Z'),
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      webAuthTokenFile: tokenFile,
      publicBaseUrl: 'https://zavorth.example.com',
      channelProviderDoctorReportFile,
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFileChannelStale,
      kill: (pid: number) => {
        if (pid !== 4725 && pid !== 4726) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-channel-stale',
        storedFingerprint: 'fingerprint-channel-stale',
      },
    });

    expect(report.local.ready).toBe(true);
    expect(report.remote.ready).toBe(true);
    expect(report.runtime.channelProviderDoctor).toEqual(
      expect.objectContaining({
        available: true,
        status: 'passed',
        stale: true,
      }),
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('relatorio ficou velho'),
      ]),
    );
    expect(report.nextSteps.map((step) => step.id)).toContain('validate-channel-providers');
  });

  it('surfaces a failed Node Mesh smoke report as an actionable blocker', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-node-smoke-fail-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tokenFile = path.join(root, 'web-token.txt');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const nodeMeshSmokeReportFile = writeNodeMeshSmokeReport(root, {
      status: 'failed',
      ok: false,
      summary: 'Smoke real do Node Mesh falhou.',
      finalNodeStatus: 'offline',
      error: 'system.run nao retornou o marcador esperado no smoke real.',
    });

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4711, owner: 'host-supervisor', startedAt: '2026-04-01T09:10:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4712, owner: 'telegram-worker', startedAt: '2026-04-01T09:10:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(tokenFile, 'runtime-token-fail', 'utf8');

    const service = new RuntimeAccessReadinessService({
      now: () => new Date('2026-04-01T09:15:00.000Z'),
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      webAuthTokenFile: tokenFile,
      publicBaseUrl: 'https://zavorth.example.com',
      nodeMeshSmokeReportFile,
      kill: (pid: number) => {
        if (pid !== 4711 && pid !== 4712) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-node-fail',
        storedFingerprint: 'fingerprint-node-fail',
      },
    });

    expect(report.local.ready).toBe(false);
    expect(report.local.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('O smoke real do Node Mesh falhou na ultima execucao'),
      ]),
    );
    expect(report.remote.issues).toEqual(
      expect.arrayContaining([
        'O ultimo smoke real do Node Mesh falhou; revise o plano remoto antes de confiar em invokes pareados.',
      ]),
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        'O ultimo smoke real do Node Mesh falhou; rode npm run test:nodes:smoke antes de confiar em invokes remotos.',
      ]),
    );
    expect(report.nextSteps.map((step) => step.id)).toContain('validate-node-mesh-smoke');
  });

  it('prefers the active dashboard runtime url when the dashboard binds to a different port', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-dashboard-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const zavorthControlRuntimeFile = path.join(root, 'dashboard-runtime.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4301, owner: 'host-supervisor', startedAt: '2026-03-31T12:20:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4302, owner: 'telegram-worker', startedAt: '2026-03-31T12:20:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      zavorthControlRuntimeFile,
      JSON.stringify({
        pid: 4302,
        host: '127.0.0.1',
        port: 33337,
        url: 'http://127.0.0.1:33337',
        startedAt: '2026-03-31T12:20:03.000Z',
        updatedAt: '2026-03-31T12:20:03.000Z',
      }),
      'utf8',
    );

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      zavorthControlRuntimeFile,
      webHost: '127.0.0.1',
      webPort: 33333,
      publicBaseUrl: 'https://zavorth.example.com',
      webAuthToken: 'runtime-token',
      kill: (pid: number) => {
        if (pid !== 4301 && pid !== 4302) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-c',
        storedFingerprint: 'fingerprint-c',
      },
    });

    expect(report.runtime.zavorthControl).toEqual(
      expect.objectContaining({
        active: true,
        port: 33337,
        url: 'http://127.0.0.1:33337',
      }),
    );
    expect(report.local.baseUrl).toBe('http://127.0.0.1:33337');
    expect(report.local.appUrl).toBe('http://127.0.0.1:33337/zavorthControl');
  });

  it('ignores a dashboard snapshot that does not belong to the active worker pid', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-dashboard-mismatch-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const zavorthControlRuntimeFile = path.join(root, 'dashboard-runtime.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4351, owner: 'host-supervisor', startedAt: '2026-03-31T12:20:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4352, owner: 'telegram-worker', startedAt: '2026-03-31T12:20:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      zavorthControlRuntimeFile,
      JSON.stringify({
        pid: 9999,
        host: '127.0.0.1',
        port: 33339,
        url: 'http://127.0.0.1:33339',
        startedAt: '2026-03-31T12:20:03.000Z',
        updatedAt: '2026-03-31T12:20:03.000Z',
      }),
      'utf8',
    );

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      zavorthControlRuntimeFile,
      webHost: '127.0.0.1',
      webPort: 33333,
      publicBaseUrl: 'https://zavorth.example.com',
      webAuthToken: 'runtime-token',
      kill: (pid: number) => {
        if (pid !== 4351 && pid !== 4352 && pid !== 9999) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = service.inspect({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-c',
        storedFingerprint: 'fingerprint-c',
      },
    });

    expect(report.runtime.zavorthControl).toBeNull();
    expect(report.local.baseUrl).toBe('http://127.0.0.1:33333');
    expect(report.local.appUrl).toBe('http://127.0.0.1:33333/zavorthControl');
  });

  it('confirms live local readiness when the app shell responds', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-live-ready-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const remoteTransportDoctorReportFileLiveReady = writeRemoteTransportDoctorReport(root);

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4401, owner: 'host-supervisor', startedAt: '2026-03-31T12:30:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4402, owner: 'telegram-worker', startedAt: '2026-03-31T12:30:02.000Z' }),
      'utf8',
    );

    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      publicBaseUrl: 'https://zavorth.example.com',
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFileLiveReady,
      webAuthToken: 'runtime-token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      kill: (pid: number) => {
        if (pid !== 4401 && pid !== 4402) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

      const report = await service.inspectLive({
        providers: createProviderSnapshot(),
        mcp: createMcpSnapshot(),
        discordBridge: createDiscordBridgeSnapshot(),
        hostIdentityStatus: {
          authorized: true,
          firstRun: false,
          currentFingerprint: 'fingerprint-d',
        storedFingerprint: 'fingerprint-d',
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:33333/api/auth/status',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(report.local.ready).toBe(true);
    expect(report.summary).toBe('Zavorth pronto para uso local e remoto.');
  });

  it('trusts the live app shell even when supervisor locks look stale', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-live-stale-locks-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const remoteTransportDoctorReportFileLiveStale = writeRemoteTransportDoctorReport(root);

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 999001, owner: 'host-supervisor', startedAt: '2026-03-31T12:35:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 999002, owner: 'telegram-worker', startedAt: '2026-03-31T12:35:02.000Z' }),
      'utf8',
    );

    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFileLiveStale,
      publicBaseUrl: 'https://zavorth.example.com',
      webAuthToken: 'runtime-token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      kill: () => {
        const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
        throw error;
      },
    });

      const report = await service.inspectLive({
        providers: createProviderSnapshot(),
        mcp: createMcpSnapshot(),
        discordBridge: createDiscordBridgeSnapshot(),
        hostIdentityStatus: {
          authorized: true,
          firstRun: false,
          currentFingerprint: 'fingerprint-stale',
        storedFingerprint: 'fingerprint-stale',
      },
    });

    expect(report.local.ready).toBe(true);
    expect(report.remote.ready).toBe(true);
    expect(report.local.issues).toEqual([]);
    expect(report.nextSteps.map((step) => step.id)).not.toEqual(
      expect.arrayContaining(['start-supervised-host', 'recover-worker']),
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('lock do supervisor ou do worker parece desatualizado'),
      ]),
    );
  });

  it('marks local readiness as pending when the app shell does not respond live', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-live-down-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const remoteTransportDoctorReportFileLiveDown = writeRemoteTransportDoctorReport(root);

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4501, owner: 'host-supervisor', startedAt: '2026-03-31T12:40:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4502, owner: 'telegram-worker', startedAt: '2026-03-31T12:40:02.000Z' }),
      'utf8',
    );

    const fetchImpl = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:33333'));
    const reservedServer = http.createServer((_req, res) => {
      res.writeHead(204);
      res.end();
    });
    await new Promise<void>((resolve) => reservedServer.listen(0, '127.0.0.1', () => resolve()));
    const reservedAddress = reservedServer.address();
    const unavailablePort = typeof reservedAddress === 'object' && reservedAddress ? reservedAddress.port : 33333;
    await new Promise<void>((resolve, reject) => reservedServer.close((error) => (error ? reject(error) : resolve())));

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFileLiveDown,
      publicBaseUrl: 'https://zavorth.example.com',
      webAuthToken: 'runtime-token',
      webHost: '127.0.0.1',
      webPort: unavailablePort,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      kill: (pid: number) => {
        if (pid !== 4501 && pid !== 4502) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const report = await service.inspectLive({
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      discordBridge: createDiscordBridgeSnapshot(),
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-e',
        storedFingerprint: 'fingerprint-e',
      },
    });

    expect(report.local.ready).toBe(false);
    expect(report.remote.ready).toBe(false);
    expect(report.local.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`A superficie web do Zavorth nao respondeu em http://127.0.0.1:${unavailablePort}/api/auth/status`),
      ]),
    );
    expect(report.nextSteps.map((step) => step.id)).toContain('recover-web-surface');
    expect(report.summary).toContain('Zavorth ainda nao esta pronto para uso consistente');
  });

  it('falls back to the Node HTTP probe when fetch fails but the local app responds', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-live-fallback-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const remoteTransportDoctorReportFileLiveFallback = writeRemoteTransportDoctorReport(root);

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4601, owner: 'host-supervisor', startedAt: '2026-03-31T12:50:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4602, owner: 'telegram-worker', startedAt: '2026-03-31T12:50:02.000Z' }),
      'utf8',
    );

    const server = http.createServer((req, res) => {
      if (req.url === '/api/auth/status') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404);
      res.end('missing');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 33333;

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      remoteTransportDoctorReportFile: remoteTransportDoctorReportFileLiveFallback,
      publicBaseUrl: 'https://zavorth.example.com',
      webAuthToken: 'runtime-token',
      webHost: '127.0.0.1',
      webPort: port,
      fetchImpl: jest.fn().mockRejectedValue(new Error('fetch failed')) as unknown as typeof fetch,
      kill: (pid: number) => {
        if (pid !== 4601 && pid !== 4602) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    try {
      const report = await service.inspectLive({
        providers: createProviderSnapshot(),
        mcp: createMcpSnapshot(),
        discordBridge: createDiscordBridgeSnapshot(),
        hostIdentityStatus: {
          authorized: true,
          firstRun: false,
          currentFingerprint: 'fingerprint-f',
          storedFingerprint: 'fingerprint-f',
        },
      });

      expect(report.local.ready).toBe(true);
      expect(report.summary).toBe('Zavorth pronto para uso local e remoto.');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('tolerates a slower /app response during live probe before flagging the local surface as down', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-live-slow-app-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const remoteTransportDoctorReportFile = writeRemoteTransportDoctorReport(root);

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 4701, owner: 'host-supervisor', startedAt: '2026-03-31T13:00:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 4702, owner: 'telegram-worker', startedAt: '2026-03-31T13:00:02.000Z' }),
      'utf8',
    );

    const server = http.createServer((req, res) => {
      if (req.url === '/api/auth/status') {
        setTimeout(() => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        }, 3000);
        return;
      }

      res.writeHead(404);
      res.end('missing');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 33333;

    const service = new RuntimeAccessReadinessService({
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      tenantRegistryFile,
      remoteTransportDoctorReportFile,
      publicBaseUrl: 'https://zavorth.example.com',
      webAuthToken: 'runtime-token',
      webHost: '127.0.0.1',
      webPort: port,
      kill: (pid: number) => {
        if (pid !== 4701 && pid !== 4702) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    try {
      const report = await service.inspectLive({
        providers: createProviderSnapshot(),
        mcp: createMcpSnapshot(),
        discordBridge: createDiscordBridgeSnapshot(),
        hostIdentityStatus: {
          authorized: true,
          firstRun: false,
          currentFingerprint: 'fingerprint-g',
          storedFingerprint: 'fingerprint-g',
        },
      });

      expect(report.local.ready).toBe(true);
      expect(report.local.issues).toEqual([]);
      expect(report.summary).toBe('Zavorth pronto para uso local e remoto.');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('normalizes a malformed MCP snapshot before building readiness recommendations', () => {
    const service = new RuntimeAccessReadinessService({
      publicBaseUrl: 'https://zavorth.example.com',
      webAuthToken: 'runtime-token',
    });

    const report = service.inspect({
      hostSupervisor: {
        active: true,
        pid: 5101,
        owner: 'host-supervisor',
        startedAt: '2026-04-07T20:00:00.000Z',
        alive: true,
      },
      telegramWorker: {
        active: true,
        pid: 5102,
        owner: 'telegram-worker',
        startedAt: '2026-04-07T20:00:02.000Z',
        alive: true,
      },
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot({ summary: undefined }),
      tenants: {
        totalCount: 1,
        sharedCount: 0,
        personalCount: 1,
        pendingOnboardingCount: 0,
        publicServerCount: 0,
        byPlatform: { telegram: 1 },
        recent: [],
        pendingOnboarding: [],
        file: 'tenant-registry.json',
      },
      nodeMeshSmoke: {
        available: false,
        status: 'missing',
        checkedAt: null,
        summary: null,
        command: 'npm run test:nodes:smoke',
        file: 'node-mesh-smoke-last.json',
        nodeId: null,
        finalNodeStatus: null,
        recentCapabilityId: null,
        error: null,
        stale: false,
        ageMs: null,
        maxAgeMs: 43200000,
      },
      systemOverlordSmoke: {
        available: false,
        status: 'missing',
        checkedAt: null,
        summary: null,
        command: 'npm run test:overlord:smoke',
        file: 'system-overlord-smoke-last.json',
        stale: false,
        ageMs: null,
        maxAgeMs: 43200000,
        items: [],
      },
      channelProviderDoctor: {
        available: false,
        status: 'missing',
        checkedAt: null,
        summary: null,
        command: 'npm run test:channels:smoke',
        file: 'channel-provider-doctor-last.json',
        stale: false,
        ageMs: null,
        maxAgeMs: 43200000,
        items: [],
      },
      remoteTransportDoctor: {
        available: false,
        status: 'missing',
        checkedAt: null,
        summary: null,
        command: 'npm run test:transports:smoke',
        file: 'remote-transport-doctor-last.json',
        stale: false,
        ageMs: null,
        maxAgeMs: 43200000,
        recommendedAction: null,
        items: [],
      },
      authStatus: {
        enabled: true,
        source: 'env',
        tokenFile: 'web-api-token.txt',
      },
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-h',
        storedFingerprint: 'fingerprint-h',
      },
    });

    expect(report.runtime.mcp.summary.connected).toBe(0);
    expect(report.runtime.mcp.summary.enabled).toBe(0);
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('O provider plane tem 1 rota(s) pronta(s)'),
      ]),
    );
  });

  it('preserves expanded channel ids from the channel doctor snapshot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-channels-'));
    tempDirs.push(root);
    const channelProviderDoctorReportFile = writeChannelProviderDoctorReport(root, {
      items: [
        {
          channelId: 'signal',
          mode: 'signal-cli',
          status: 'passed',
          configured: true,
          summary: 'Signal bridge validada.',
          error: null,
        },
        {
          channelId: 'email',
          mode: 'local-outbox',
          status: 'passed',
          configured: true,
          summary: 'Email local-outbox validado.',
          error: null,
        },
      ],
    });

    const service = new RuntimeAccessReadinessService({
      channelProviderDoctorReportFile,
    });

    const report = service.inspect({
      hostSupervisor: {
        active: true,
        pid: 1,
        owner: 'host',
        startedAt: new Date().toISOString(),
        alive: true,
      },
      telegramWorker: {
        active: true,
        pid: 2,
        owner: 'worker',
        startedAt: new Date().toISOString(),
        alive: true,
      },
      discordBridge: createDiscordBridgeSnapshot(),
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      tenants: {
        totalCount: 0,
        sharedCount: 0,
        personalCount: 0,
        pendingOnboardingCount: 0,
        publicServerCount: 0,
        byPlatform: {},
        recent: [],
        pendingOnboarding: [],
        file: path.join(root, 'tenants.json'),
      },
      authStatus: {
        enabled: false,
        source: 'missing',
        tokenFile: path.join(root, 'token.txt'),
      },
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-x',
        storedFingerprint: 'fingerprint-x',
      },
    });

    expect(report.runtime.channelProviderDoctor.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channelId: 'signal', mode: 'signal-cli' }),
        expect.objectContaining({ channelId: 'email', mode: 'local-outbox' }),
      ]),
    );
  });

  it('keeps Discord recovery and stale health as non-blocking guidance when the local runtime is otherwise ready', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-access-discord-guidance-'));
    tempDirs.push(root);
    const capabilityLifecycleStateFile = path.join(root, 'capability-lifecycle-state.json');
    const service = new RuntimeAccessReadinessService({
      publicBaseUrl: 'https://zavorth.example.com',
      webAuthToken: 'runtime-token',
      capabilityLifecycleStateFile,
      discordRequiredOnBoot: true,
    });

    const report = service.inspect({
      hostSupervisor: {
        active: true,
        pid: 9101,
        owner: 'host-supervisor',
        startedAt: '2026-04-09T10:00:00.000Z',
        alive: true,
      },
      telegramWorker: {
        active: true,
        pid: 9102,
        owner: 'telegram-worker',
        startedAt: '2026-04-09T10:00:02.000Z',
        alive: true,
      },
      discordBridge: createDiscordBridgeSnapshot({
        enabled: true,
        started: false,
        lastError: 'Gateway nativo ainda inicializando.',
      }),
      providers: createProviderSnapshot(),
      mcp: createMcpSnapshot(),
      tenants: {
        totalCount: 1,
        sharedCount: 0,
        personalCount: 1,
        pendingOnboardingCount: 0,
        publicServerCount: 0,
        byPlatform: { telegram: 1 },
        recent: [],
        pendingOnboarding: [],
        file: 'tenant-registry.json',
      },
      nodeMeshSmoke: {
        available: true,
        status: 'passed',
        checkedAt: '2026-04-01T10:00:00.000Z',
        summary: 'Smoke real passou.',
        command: 'npm run test:nodes:smoke',
        file: 'node-mesh-smoke-last.json',
        nodeId: 'node-1',
        finalNodeStatus: 'online',
        recentCapabilityId: 'files.write',
        error: null,
        stale: true,
        ageMs: 86_400_000,
        maxAgeMs: 43_200_000,
      },
      authStatus: {
        enabled: true,
        source: 'env',
        tokenFile: 'web-api-token.txt',
      },
      hostIdentityStatus: {
        authorized: true,
        firstRun: false,
        currentFingerprint: 'fingerprint-y',
        storedFingerprint: 'fingerprint-y',
      },
    });

    expect(report.local.ready).toBe(true);
    expect(report.local.issues).toEqual([]);
    expect(report.nextSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'recover-discord-bridge', blocking: false }),
        expect.objectContaining({ id: 'renew-gateway-health', blocking: false }),
      ]),
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Discord nativo degradado'),
        expect.stringContaining('renovacao leve recomendada'),
      ]),
    );
  });
});

