import { RuntimeBootstrapService } from '../../src/services/RuntimeBootstrapService';

describe('RuntimeBootstrapService', () => {
  it('reports a healthy bootstrap when env, dependencies and runtime are ready', () => {
    const service = new RuntimeBootstrapService({
      existsSync: (target: any) => String(target).endsWith('.env') || String(target).endsWith('skill-sources.json'),
      llmProvider: 'gemini',
      llmCredentialReady: true,
      supervisedRuntimeService: {
        inspect: () => ({
          projectRoot: 'C:/tmp/zavorth',
          gitAvailable: true,
          branch: 'main',
          modifiedFiles: [],
          stagedFiles: [],
          untrackedFiles: [],
          recentCommits: [],
          installRequired: false,
          buildRequired: false,
          hostSupervisor: { active: true, pid: 3001, owner: 'host-supervisor', startedAt: '2026-03-31T10:00:00.000Z', alive: true },
          telegramWorker: { active: true, pid: 3002, owner: 'telegram-worker', startedAt: '2026-03-31T10:00:02.000Z', alive: true },
          accessReadiness: {
            checkedAt: '2026-03-31T10:05:00.000Z',
            runtime: {
              hostSupervisor: { active: true, pid: 3001, owner: 'host-supervisor', startedAt: '2026-03-31T10:00:00.000Z', alive: true },
              telegramWorker: { active: true, pid: 3002, owner: 'telegram-worker', startedAt: '2026-03-31T10:00:02.000Z', alive: true },
              remoteTransportDoctor: {
                available: true,
                status: 'passed',
                checkedAt: '2026-03-31T10:04:00.000Z',
                summary: 'Remote transport doctor validated configured flows.',
                command: 'npm run test:transports:smoke',
                file: 'C:/tmp/zavorth/data/runtime/remote-transport-doctor-last.json',
                stale: false,
                ageMs: 60000,
                maxAgeMs: 43200000,
                recommendedAction: null,
                items: [],
              },
              hostAuthorized: true,
              firstRun: false,
            },
            auth: { enabled: true, source: 'env', tokenFile: 'token.txt' },
            local: { baseUrl: 'http://127.0.0.1:33333', dashboardUrl: 'http://127.0.0.1:33333/', appUrl: 'http://127.0.0.1:33333/app', ready: true, issues: [] },
            remote: { baseUrl: 'https://zavorth.example.com', appUrl: 'https://zavorth.example.com/app', ready: true, issues: [] },
            recommendations: ['The remote frontend can now point to the Zavorth public URL with a dedicated web token.'],
            nextSteps: [{ id: 'connect-remote-frontend', title: 'Connect remote frontend', description: 'Open the published app.', blocking: false }],
summary: 'Zavorth ready for local and remote use.',
          },
          lastReloadReport: null,
        }),
      } as any,
      platformCapabilityService: {
        getCapabilities: () => [
          {
            platform: 'telegram',
            implementationState: 'full',
            readiness: 'ready',
            configured: true,
            transport: 'native',
            envKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS'],
            notes: ['ok'],
          },
        ],
      } as any,
      modelPickerContractService: {
        buildContract: () => ({
          schemaVersion: 1,
          generatedAt: '2026-03-31T10:05:00.000Z',
          families: { schemaVersion: 1, generatedAt: '2026-03-31T10:05:00.000Z', families: [] },
          routes: { schemaVersion: 1, generatedAt: '2026-03-31T10:05:00.000Z', routes: [] },
          profiles: [],
          selected: {
            schemaVersion: 1,
            source: 'current-config',
            providerName: 'openai',
            providerLabel: 'OpenAI',
            modelName: 'gpt-4o',
            modelLabel: 'gpt-4o',
            routeId: 'openai',
            familyId: 'openai',
            readiness: 'ready',
            ready: true,
            fallbackOrder: ['openai', 'gemini'],
            explanation: ['Configuracao atual seleciona openai/gpt-4o.'],
          },
        }),
      } as any,
    });

    const report = service.inspect();

    expect(report.summary).toBe('Bootstrap complete: Zavorth ready for local and remote use.');
    expect(report.actions).toHaveLength(0);
    expect(report.env.issues).toHaveLength(0);
    expect(report.env.selectedModel).toMatchObject({
      providerLabel: 'OpenAI',
      modelLabel: 'gpt-4o',
      readiness: 'ready',
      ready: true,
    });
  });

  it('builds blocking actions when setup is incomplete', () => {
    const service = new RuntimeBootstrapService({
      existsSync: () => false,
      llmProvider: 'AIGateway',
      llmCredentialReady: false,
      projectRoot: 'C:/tmp/zavorth',
      supervisedRuntimeService: {
        inspect: () => ({
          projectRoot: 'C:/tmp/zavorth',
          gitAvailable: false,
          branch: null,
          modifiedFiles: [],
          stagedFiles: [],
          untrackedFiles: [],
          recentCommits: [],
          installRequired: true,
          buildRequired: true,
          hostSupervisor: { active: false, pid: null, owner: null, startedAt: null, alive: false },
          telegramWorker: { active: false, pid: null, owner: null, startedAt: null, alive: false },
          accessReadiness: {
            checkedAt: '2026-03-31T10:05:00.000Z',
            runtime: {
              hostSupervisor: { active: false, pid: null, owner: null, startedAt: null, alive: false },
              telegramWorker: { active: false, pid: null, owner: null, startedAt: null, alive: false },
              nodeMeshSmoke: {
                available: false,
                status: 'missing',
                checkedAt: null,
                summary: null,
                command: 'npm run test:nodes:smoke',
                file: 'C:/tmp/zavorth/data/runtime/node-mesh-smoke-last.json',
                nodeId: null,
                finalNodeStatus: null,
                recentCapabilityId: null,
                error: null,
                stale: false,
                ageMs: null,
                maxAgeMs: 43200000,
              },
              channelProviderDoctor: {
                available: true,
                status: 'failed',
                checkedAt: '2026-03-31T09:58:00.000Z',
                summary: 'Native channel doctor found operational pending items in Slack native.',
                command: 'npm run test:channels:smoke',
                file: 'C:/tmp/zavorth/data/runtime/channel-provider-doctor-last.json',
                stale: false,
                ageMs: 420000,
                maxAgeMs: 43200000,
                items: [
                  {
                    channelId: 'slack',
                    mode: 'native',
                    status: 'failed',
                    configured: true,
                    summary: 'Slack native with pending signature.',
                    error: 'SLACK_SIGNING_SECRET missing.',
                  },
                ],
              },
              remoteTransportDoctor: {
                available: false,
                status: 'missing',
                checkedAt: null,
                summary: null,
                command: 'npm run test:transports:smoke',
                file: 'C:/tmp/zavorth/data/runtime/remote-transport-doctor-last.json',
                stale: false,
                ageMs: null,
                maxAgeMs: 43200000,
                recommendedAction: 'npm run test:transports:smoke',
                items: [],
              },
              hostAuthorized: false,
              firstRun: false,
            },
            auth: { enabled: false, source: 'missing', tokenFile: 'token.txt' },
            local: { baseUrl: 'http://127.0.0.1:33333', dashboardUrl: 'http://127.0.0.1:33333/', appUrl: 'http://127.0.0.1:33333/app', ready: false, issues: ['offline'] },
            remote: { baseUrl: null, appUrl: null, ready: false, issues: ['sem url'] },
            recommendations: ['The high-risk PIN remains reserved for critical confirmations; set a dedicated ZAVORTH_WEB_AUTH_TOKEN to unlock web access.'],
            nextSteps: [
              { id: 'start-supervised-host', title: 'Start supervised host', description: 'Run npm run dev:supervised.', blocking: true },
              { id: 'trust-host', title: 'Authorize this host', description: 'Use /hostauth trust.', blocking: true },
              { id: 'validate-node-mesh-smoke', title: 'Validate Node Mesh with real smoke', description: 'Run npm run test:nodes:smoke.', blocking: false },
              { id: 'validate-channel-providers', title: 'Validate native channels', description: 'Run npm run test:channels:smoke.', blocking: false },
              { id: 'validate-remote-transports', title: 'Validate remote transports', description: 'Run npm run test:transports:smoke.', blocking: false },
              { id: 'configure-public-base-url', title: 'Set public URL', description: 'Configure ZAVORTH_PUBLIC_BASE_URL.', blocking: false },
              { id: 'configure-web-token', title: 'Configure web token', description: 'Set ZAVORTH_WEB_AUTH_TOKEN.', blocking: true },
            ],
            summary: 'Zavorth not yet ready for consistent use.',
          },
          lastReloadReport: null,
        }),
      } as any,
      platformCapabilityService: {
        getCapabilities: () => [
          {
            platform: 'telegram',
            implementationState: 'full',
            readiness: 'disabled',
            configured: false,
            transport: 'native',
            envKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS'],
            notes: ['disabled'],
          },
        ],
      } as any,
    });

    const report = service.inspect();
    const actionIds = report.actions.map((entry) => entry.id);

    expect(report.env.issues).toEqual(
      expect.arrayContaining([
        'The .env file has not been created yet.',
        'Missing valid credential for aigateway provider.',
      ]),
    );
    expect(actionIds).toEqual(
      expect.arrayContaining([
        'setup-env',
        'prepare-telegram',
        'prepare-operator-channels',
        'configure-llm',
        'install-dependencies',
        'build-runtime',
        'start-supervised-runtime',
        'trust-host',
        'validate-node-mesh-smoke',
        'validate-channel-providers',
        'validate-remote-transports',
        'configure-public-base-url',
      ]),
    );
    expect(report.actions.find((entry) => entry.id === 'install-dependencies')?.autoFixCommand).toEqual({
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['install'],
      cwd: 'C:/tmp/zavorth',
    });
    expect(report.actions.find((entry) => entry.id === 'build-runtime')?.autoFixCommand).toEqual({
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', 'build'],
      cwd: 'C:/tmp/zavorth',
    });
    expect(report.actions.find((entry) => entry.id === 'validate-node-mesh-smoke')?.autoFixCommand).toEqual({
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', 'test:nodes:smoke'],
      cwd: 'C:/tmp/zavorth',
    });
    expect(report.actions.find((entry) => entry.id === 'validate-channel-providers')?.autoFixCommand).toEqual({
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', 'test:channels:smoke'],
      cwd: 'C:/tmp/zavorth',
    });
    expect(report.actions.find((entry) => entry.id === 'validate-remote-transports')?.autoFixCommand).toEqual({
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', 'test:transports:smoke'],
      cwd: 'C:/tmp/zavorth',
    });
    expect(report.actions.find((entry) => entry.id === 'trust-host')?.autoFixCommand).toBeNull();
  });

  it('can build a live bootstrap report from inspectLive when available', async () => {
    const inspectLive = jest.fn().mockResolvedValue({
      projectRoot: 'C:/tmp/zavorth',
      gitAvailable: true,
      branch: 'main',
      modifiedFiles: [],
      stagedFiles: [],
      untrackedFiles: [],
      recentCommits: [],
      installRequired: false,
      buildRequired: false,
      hostSupervisor: { active: true, pid: 3001, owner: 'host-supervisor', startedAt: '2026-03-31T10:00:00.000Z', alive: true },
      telegramWorker: { active: true, pid: 3002, owner: 'telegram-worker', startedAt: '2026-03-31T10:00:02.000Z', alive: true },
      accessReadiness: {
        checkedAt: '2026-03-31T10:05:00.000Z',
        runtime: {
          hostSupervisor: { active: true, pid: 3001, owner: 'host-supervisor', startedAt: '2026-03-31T10:00:00.000Z', alive: true },
          telegramWorker: { active: true, pid: 3002, owner: 'telegram-worker', startedAt: '2026-03-31T10:00:02.000Z', alive: true },
          discordBridge: {
            mode: 'unknown',
            enabled: false,
            started: false,
            allowDirectMessages: false,
            allowedGuildIds: [],
            pendingInbox: 0,
            pendingOutbox: 0,
            lastError: null,
            updatedAt: null,
          },
          hostAuthorized: true,
          firstRun: false,
          dashboard: null,
        },
        auth: { enabled: true, source: 'env', tokenFile: 'token.txt' },
        local: { baseUrl: 'http://127.0.0.1:33333', dashboardUrl: 'http://127.0.0.1:33333/', appUrl: 'http://127.0.0.1:33333/app', ready: true, issues: [] },
        remote: { baseUrl: 'https://zavorth.example.com', appUrl: 'https://zavorth.example.com/app', ready: true, issues: [] },
        recommendations: [],
        nextSteps: [],
        summary: 'Zavorth ready for local and remote use.',
      },
      lastReloadReport: null,
    });

    const service = new RuntimeBootstrapService({
      existsSync: (target: any) => String(target).endsWith('.env'),
      llmProvider: 'gemini',
      llmCredentialReady: true,
      supervisedRuntimeService: {
        inspect: inspectLive,
        inspectLive,
      } as any,
      platformCapabilityService: {
        getCapabilities: () => [
          {
            platform: 'telegram',
            implementationState: 'full',
            readiness: 'ready',
            configured: true,
            transport: 'native',
            envKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS'],
            notes: ['ok'],
          },
        ],
      } as any,
    });

    const report = await service.inspectLive();

    expect(inspectLive).toHaveBeenCalled();
    expect(report.summary).toBe('Bootstrap complete: Zavorth ready for local and remote use.');
  });
});
