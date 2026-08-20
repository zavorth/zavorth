import { OperationsCockpitService } from '../../src/services/OperationsCockpitService';

describe('OperationsCockpitService', () => {
  const logRepo = { getRecentLogs: jest.fn(() => []), log: jest.fn() } as any;

  it('delegates fast and live snapshots to the matching health service methods', () => {
    const operationsHealthService = {
      readSnapshotFast: jest.fn(() => createOperationsSnapshot()),
      readSnapshotLive: jest.fn(() => createOperationsSnapshot({ generatedAt: '2026-03-29T12:05:00.000Z' })),
    } as any;

    const service = new OperationsCockpitService(
      logRepo,
      { operationsHealthService },
      {
        now: () => new Date('2026-03-29T12:10:00.000Z'),
        statsProvider: () => ({
          uptime_seconds: 3600,
          ram_mb_rss: 128,
          ram_mb_heap: 64,
          cpu_arch: 'x64',
          platform: 'win32',
          timestamp: '2026-03-29T12:10:00.000Z',
        }),
      },
    );

    service.readSnapshotFast();
    service.readSnapshotLive();

    expect(operationsHealthService.readSnapshotFast).toHaveBeenCalledTimes(1);
    expect(operationsHealthService.readSnapshotLive).toHaveBeenCalledTimes(1);
  });

  function createOperationsSnapshot(overrides: Record<string, any> = {}) {
    return {
      generatedAt: '2026-03-29T12:00:00.000Z',
      sidecars: {
        AIGateway: {
          name: 'AIGateway',
          enabled: true,
          ready: true,
          running: true,
          message: 'Ready.',
          updatedAt: '2026-03-29T11:58:00.000Z',
        },
        ZavorthTerminal: {
          name: 'Zavorth Remote Terminal Sidecar',
          enabled: false,
          ready: false,
          running: false,
          message: 'Disabled.',
          updatedAt: '2026-03-29T11:58:00.000Z',
        },
      },
      channels: {
        discordBridge: {
          mode: 'unknown',
          enabled: false,
          started: false,
          allowDirectMessages: false,
          allowedGuildIds: [],
          pendingInbox: 0,
          pendingOutbox: 0,
          lastError: null,
          updatedAt: '2026-03-29T11:58:00.000Z',
        },
        whatsapp: {
          mode: 'unknown',
          enabled: false,
          started: false,
          recipientsConfigured: 0,
          allowedChatIds: [],
          provider: 'unknown',
          providerConfigured: false,
          providerDecision: null,
          sessionDir: null,
          sessionDirConfigured: false,
          phoneNumberId: null,
          webhookConfigured: false,
          lastInboundAt: null,
          lastOutboundAt: null,
          lastError: null,
          updatedAt: null,
        },
        slack: {
          mode: 'unknown',
          enabled: false,
          started: false,
          recipientsConfigured: 0,
          allowedChannelIds: [],
          transport: 'unknown',
          nativeConfigured: false,
          apiBaseUrl: null,
          workspaceId: null,
          workspaceConfigured: false,
          lastInboundAt: null,
          lastOutboundAt: null,
          lastError: null,
          updatedAt: null,
        },
      },
      tenants: {
        totalCount: 1,
        sharedCount: 0,
        personalCount: 1,
        pendingOnboardingCount: 0,
        publicServerCount: 0,
        byPlatform: {
          telegram: 1,
        },
        recent: [],
        pendingOnboarding: [],
        file: 'C:/runtime/tenant-registry.json',
      },
      docker: {
        enabled: true,
        required: false,
        available: true,
        canRun: true,
        detail: 'Docker available.',
        languages: {
          javascript: { canRun: true, detail: 'ok', image: 'node:22-bullseye' },
          python: { canRun: true, detail: 'ok', image: 'python:3.12-slim' },
          shell: { canRun: true, detail: 'ok', image: 'bash:5.2' },
        },
      },
      wasm: {
        enabled: true,
        available: true,
        canRun: true,
        detail: 'Wasm tier ready.',
        runtime: 'node-webassembly',
        supportedLanguages: ['wasm'],
        recommendedAction: 'npm run sandbox:wasm:smoke',
      },
      nodeMeshSmoke: {
        available: true,
        status: 'passed',
        checkedAt: '2026-03-29T11:57:00.000Z',
        summary: 'Real Node Mesh smoke passed with pairing, heartbeat and invoke complete.',
        command: 'npm run test:nodes:smoke',
        file: 'C:/runtime/node-mesh-smoke-last.json',
        nodeId: 'node-cockpit-1',
        finalNodeStatus: 'online',
        recentCapabilityId: 'files.write',
        error: null,
        stale: false,
        recommendedAction: null,
      },
      channelProviderDoctor: {
        available: true,
        status: 'passed',
        checkedAt: '2026-03-29T11:56:30.000Z',
        summary: 'Native channel doctor validated configured providers.',
        command: 'npm run test:channels:smoke',
        file: 'C:/runtime/channel-provider-doctor-last.json',
        stale: false,
        ageMs: 210000,
        maxAgeMs: 43_200_000,
        recommendedAction: null,
        items: [
          {
            channelId: 'slack',
            mode: 'native',
            status: 'passed',
            configured: true,
            summary: 'Native Slack validated.',
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
      },
      remoteTransportDoctor: {
        available: true,
        status: 'passed',
        checkedAt: '2026-03-29T11:56:10.000Z',
        summary: 'Remote transport doctor validated configured flows.',
        command: 'npm run test:transports:smoke',
        file: 'C:/runtime/remote-transport-doctor-last.json',
        stale: false,
        ageMs: 300000,
        maxAgeMs: 43_200_000,
        recommendedAction: null,
        items: [
          {
            transportId: 'AIGateway',
            mode: 'remote',
            status: 'passed',
            configured: true,
            summary: 'Remote AIGateway validated.',
            error: null,
          },
          {
            transportId: 'node-host',
            mode: 'local',
            status: 'passed',
            configured: true,
            summary: 'Paired node host validated.',
            error: null,
          },
        ],
      },
      publish: {
        available: true,
        publishedAt: '2026-03-29T11:50:00.000Z',
        branch: 'codex/initial-publish',
        commit: 'abc12345',
        sourceArchiveId: null,
        docsUrl: 'https://docs.example.com',
        remoteConsoleUrl: 'https://console.example.com',
        gitPush: 'completed',
        smokeTest: 'passed',
        history: [],
      },
      maintenance: {
        available: true,
        startedAt: '2026-03-29T11:30:00.000Z',
        finishedAt: '2026-03-29T11:34:00.000Z',
        stepCount: 4,
        completedSteps: 4,
        dryRun: false,
        withSoak: true,
        withPublish: false,
      },
      maintenanceAutomation: {
        enabled: true,
        running: false,
        lastTriggeredAt: '2026-03-29T04:30:00.000Z',
        lastTriggerSource: null,
        lastPriorityReason: null,
        nextPlannedAt: '2026-03-30T04:30:00.000Z',
        updatedAt: '2026-03-29T04:30:00.000Z',
        updatedBy: null,
        note: 'ok',
        lastActionId: 'scheduled-maintenance',
        lastActionLogFile: 'C:/runtime/actions/scheduled.log',
        lastReportFinishedAt: '2026-03-29T04:32:00.000Z',
        lastReportStepCount: 5,
      },
      storage: {
        rootPath: 'C:/workspace/zavorth/data',
        totalBytes: 1_000_000,
        freeBytes: 800_000,
        usedBytes: 200_000,
        freePercent: 80,
        hotspots: [],
      },
      security: {
        dashboardAuth: {
          enabled: true,
          source: 'env',
          tokenFile: 'C:/runtime/web-api-token.txt',
          tokenFileExists: true,
          note: 'ok',
        },
        mailboxSecret: {
          source: 'runtime-file',
          filePath: 'C:/runtime/mailbox-secret.key',
          fileExists: true,
        },
        dbEncryption: {
          enabled: true,
          source: 'runtime-file',
          filePath: 'C:/runtime/db-field.key',
          fileExists: true,
        },
        hostIdentity: {
          filePath: 'C:/runtime/authorized-host.json',
          exists: true,
        },
        lastAudit: {
          available: true,
          generatedAt: '2026-03-29T11:55:00.000Z',
          ok: true,
          summary: 'All good.',
          trailAvailable: true,
          trailDir: 'C:/runtime/security-audit-trail',
          eventsFile: 'C:/runtime/security-audit-trail/events.ndjson',
          ledgerFile: 'C:/runtime/security-audit-trail/ledger.json',
          totalEvents: 3,
          latestEventId: 'audit-0000003',
          latestEventType: 'PERMISSION_DECISION',
          latestTaskId: 'task-ops-1',
          latestTimestamp: '2026-03-29T11:55:00.000Z',
          latestChainHash: 'abcdef1234567890',
          recentChain: [
            {
              eventId: 'audit-0000003',
              eventType: 'PERMISSION_DECISION',
              taskId: 'task-ops-1',
              timestamp: '2026-03-29T11:55:00.000Z',
              chainHash: 'abcdef1234567890',
              previousChainHash: '1234567890abcdef',
            },
          ],
        },
        lastPreflight: {
          available: true,
          generatedAt: '2026-03-29T11:56:00.000Z',
          ok: true,
          summary: 'All good.',
        },
        needsAttention: false,
      },
      errors: {
        lastError: null,
        recent: [],
      },
      ...overrides,
    };
  }

  it('returns a healthy cockpit when the host is stable', () => {
    const service = new OperationsCockpitService(
      logRepo,
      {
        operationsHealthService: {
          readSnapshot: jest.fn(() => createOperationsSnapshot()),
        } as any,
      },
      {
        now: () => new Date('2026-03-29T12:00:00.000Z'),
        statsProvider: () => ({
          uptime_seconds: 7200,
          ram_mb_rss: 256,
          ram_mb_heap: 128,
          cpu_arch: 'x64',
          platform: 'win32',
          timestamp: '2026-03-29T12:00:00.000Z',
        }),
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.status).toBe('healthy');
    expect(snapshot.headline).toContain('Runtime stable');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        enabledSidecars: 1,
        readySidecars: 1,
        freeDiskPercent: 80,
      }),
    );
    expect(snapshot.highlights.join(' ')).toContain('Recurring automation active');
    expect(snapshot.highlights.join(' ')).toContain('Audit trail with 3 event(s)');
    expect(snapshot.highlights.join(' ')).toContain('Node Mesh validated by real smoke');
    expect(snapshot.highlights.join(' ')).toContain('Native channels validated by doctor');
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'npm run ops:maintain',
        }),
      ]),
    );
  });

  it('surfaces degraded state, alerts and remediation actions when the host is under stress', () => {
    const degradedSnapshot = createOperationsSnapshot({
      sidecars: {
        AIGateway: {
          name: 'AIGateway',
          enabled: true,
          ready: false,
          running: false,
          message: 'Offline.',
          updatedAt: '2026-03-29T11:59:00.000Z',
        },
        ZavorthTerminal: {
          name: 'Zavorth Remote Terminal Sidecar',
          enabled: true,
          ready: false,
          running: true,
          message: 'Subindo.',
          updatedAt: '2026-03-29T11:59:00.000Z',
        },
      },
      docker: {
        enabled: true,
        required: true,
        available: false,
        canRun: false,
        detail: 'Docker daemon offline.',
        languages: {
          javascript: { canRun: false, detail: 'offline', image: 'node:22-bullseye' },
          python: { canRun: false, detail: 'offline', image: 'python:3.12-slim' },
          shell: { canRun: false, detail: 'offline', image: 'bash:5.2' },
        },
      },
      publish: {
        available: false,
        publishedAt: null,
        branch: null,
        commit: null,
        sourceArchiveId: null,
        docsUrl: null,
        remoteConsoleUrl: null,
        gitPush: null,
        smokeTest: null,
        history: [],
      },
      maintenanceAutomation: {
        enabled: false,
        running: false,
        lastTriggeredAt: null,
        lastTriggerSource: null,
        lastPriorityReason: null,
        nextPlannedAt: null,
        updatedAt: null,
        updatedBy: null,
        note: 'Disabled.',
        lastActionId: null,
        lastActionLogFile: null,
        lastReportFinishedAt: null,
        lastReportStepCount: 0,
      },
      storage: {
        rootPath: 'C:/workspace/zavorth/data',
        totalBytes: 1_000_000,
        freeBytes: 40_000,
        usedBytes: 960_000,
        freePercent: 4,
        hotspots: [],
      },
      security: {
        ...createOperationsSnapshot().security,
        needsAttention: true,
        lastPreflight: {
          available: true,
          generatedAt: '2026-03-29T11:57:00.000Z',
          ok: false,
          summary: 'Token web ausente.',
        },
      },
      errors: {
        lastError: {
          timestamp: '2026-03-29T11:58:00.000Z',
          level: 'error',
          category: 'Host',
          message: 'Runtime failed.',
        },
        recent: [
          {
            timestamp: '2026-03-29T11:58:00.000Z',
            level: 'error',
            category: 'Host',
message: 'Runtime failed.',
          },
        ],
      },
    });

    const service = new OperationsCockpitService(
      logRepo,
      {
        operationsHealthService: {
          readSnapshot: jest.fn(() => degradedSnapshot),
        } as any,
      },
      {
        now: () => new Date('2026-03-29T12:00:00.000Z'),
        statsProvider: () => ({
          uptime_seconds: 1800,
          ram_mb_rss: 512,
          ram_mb_heap: 256,
          cpu_arch: 'x64',
          platform: 'win32',
          timestamp: '2026-03-29T12:00:00.000Z',
        }),
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'security' }),
        expect.objectContaining({ source: 'docker' }),
        expect.objectContaining({ source: 'sidecar' }),
      ]),
    );
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'npm run ops:maintain' }),
        expect.objectContaining({ command: 'npm run security:preflight' }),
        expect.objectContaining({ command: 'npm run remote:publish:fast' }),
        expect.objectContaining({ command: 'npm run ops:maintain' }),
        expect.objectContaining({ command: 'ZAVORTH_MAINTENANCE_AUTOMATION_ENABLED=true' }),
      ]),
    );
  });

  it('promotes Wasm remediation when the tier is enabled but not ready yet', () => {
    const service = new OperationsCockpitService(
      logRepo,
      {
        operationsHealthService: {
          readSnapshot: jest.fn(() => createOperationsSnapshot({
            wasm: {
              enabled: true,
              available: true,
              canRun: false,
              detail: 'Wasm tier unavailable on this host.',
              runtime: 'node-webassembly',
              supportedLanguages: ['wasm'],
              recommendedAction: 'npm run sandbox:wasm:smoke',
            },
          })),
        } as any,
      },
      {
        now: () => new Date('2026-04-03T22:30:00.000Z'),
        statsProvider: () => ({
          uptime_seconds: 3600,
          ram_mb_rss: 192,
          ram_mb_heap: 96,
          cpu_arch: 'x64',
          platform: 'win32',
          timestamp: '2026-04-03T22:30:00.000Z',
        }),
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'wasm-sandbox',
          title: 'Wasm tier needs validation',
        }),
      ]),
    );
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'validate-wasm-smoke',
          command: 'npm run sandbox:wasm:smoke',
          priority: 'high',
        }),
      ]),
    );
    expect(snapshot.highlights.join(' ')).toContain('Tier Wasm pending');
  });

  it('surfaces native Discord drift when the gateway is enabled but not started', () => {
    const service = new OperationsCockpitService(
      logRepo,
      {
        operationsHealthService: {
          readSnapshot: jest.fn(() =>
            createOperationsSnapshot({
              channels: {
                discordBridge: {
                  mode: 'native',
                  enabled: true,
                  started: false,
                  allowDirectMessages: true,
                  allowedGuildIds: ['guild-1'],
                  pendingInbox: 2,
                  pendingOutbox: 1,
                  lastError: null,
                  updatedAt: '2026-03-29T11:59:30.000Z',
                },
              },
            }),
          ),
        } as any,
      },
      {
        now: () => new Date('2026-03-29T12:00:00.000Z'),
        statsProvider: () => ({
          uptime_seconds: 7200,
          ram_mb_rss: 256,
          ram_mb_heap: 128,
          cpu_arch: 'x64',
          platform: 'win32',
          timestamp: '2026-03-29T12:00:00.000Z',
        }),
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'discord-bridge',
          title: 'Native Discord gateway requires intervention',
        }),
      ]),
    );
    expect(snapshot.highlights.join(' ')).toContain('Native Discord gateway enabled, but outside ready state.');
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'recover-discord-bridge',
          label: 'Recover Discord gateway',
          command: 'npm run ops:maintain',
        }),
      ]),
    );
  });

  it('surfaces Slack and WhatsApp preparation when local adapters are enabled but not ready', () => {
    const service = new OperationsCockpitService(
      logRepo,
      {
        operationsHealthService: {
          readSnapshot: jest.fn(() =>
            createOperationsSnapshot({
              channels: {
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
                whatsapp: {
                  mode: 'stub',
                  enabled: true,
                  started: false,
                  recipientsConfigured: 1,
                  allowedChatIds: ['5511999999999'],
                  sessionDir: 'C:/runtime/whatsapp-session',
                  sessionDirConfigured: true,
                  lastInboundAt: null,
                  lastOutboundAt: '2026-03-29T11:58:00.000Z',
                  lastError: null,
                  updatedAt: '2026-03-29T11:58:00.000Z',
                },
                slack: {
                  mode: 'stub',
                  enabled: true,
                  started: true,
                  recipientsConfigured: 0,
                  allowedChannelIds: [],
                  workspaceId: 'T-ops',
                  workspaceConfigured: true,
                  lastInboundAt: null,
                  lastOutboundAt: '2026-03-29T11:58:30.000Z',
                  lastError: null,
                  updatedAt: '2026-03-29T11:58:30.000Z',
                },
              },
            }),
          ),
        } as any,
      },
      {
        now: () => new Date('2026-03-29T12:00:00.000Z'),
        statsProvider: () => ({
          uptime_seconds: 7200,
          ram_mb_rss: 256,
          ram_mb_heap: 128,
          cpu_arch: 'x64',
          platform: 'win32',
          timestamp: '2026-03-29T12:00:00.000Z',
        }),
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'whatsapp-channel',
          title: 'WhatsApp requires preparation',
        }),
        expect.objectContaining({
          source: 'slack-channel',
          title: 'Slack requires preparation',
        }),
      ]),
    );
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'prepare-whatsapp-channel',
          command: '/channels prepare whatsapp',
        }),
        expect.objectContaining({
          id: 'prepare-slack-channel',
          command: '/channels prepare slack',
        }),
      ]),
    );
    expect(snapshot.highlights.join(' ')).toContain('WhatsApp enabled in supervised local mode');
    expect(snapshot.highlights.join(' ')).toContain('Slack enabled in supervised local mode');
  });

  it('surfaces Node Mesh smoke failure as a degraded operational signal', () => {
    const service = new OperationsCockpitService(
      logRepo,
      {
        operationsHealthService: {
          readSnapshot: jest.fn(() =>
            createOperationsSnapshot({
              nodeMeshSmoke: {
                available: true,
                status: 'failed',
                checkedAt: '2026-03-29T11:58:30.000Z',
                summary: 'Real Node Mesh smoke failed.',
                command: 'npm run test:nodes:smoke',
                file: 'C:/runtime/node-mesh-smoke-last.json',
                nodeId: 'node-cockpit-err',
                finalNodeStatus: 'offline',
                recentCapabilityId: 'system.run',
                error: 'system.run did not return expected marker in real smoke.',
                stale: false,
                recommendedAction: 'npm run test:nodes:smoke',
              },
            }),
          ),
        } as any,
      },
      {
        now: () => new Date('2026-03-29T12:00:00.000Z'),
        statsProvider: () => ({
          uptime_seconds: 7200,
          ram_mb_rss: 256,
          ram_mb_heap: 128,
          cpu_arch: 'x64',
          platform: 'win32',
          timestamp: '2026-03-29T12:00:00.000Z',
        }),
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'node-mesh-smoke',
          title: 'Node Mesh smoke failed',
        }),
      ]),
    );
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'validate-node-mesh-smoke',
          command: 'npm run test:nodes:smoke',
          priority: 'high',
        }),
      ]),
    );
    expect(snapshot.highlights.join(' ')).toContain('Node Mesh failed last real smoke');
  });

  it('surfaces stale Node Mesh smoke as an attention signal with revalidation action', () => {
    const service = new OperationsCockpitService(
      logRepo,
      {
        operationsHealthService: {
          readSnapshot: jest.fn(() =>
            createOperationsSnapshot({
              nodeMeshSmoke: {
                available: true,
                status: 'passed',
                checkedAt: '2026-03-28T00:00:00.000Z',
                summary: 'Real Node Mesh smoke passed, but is already old.',
                command: 'npm run test:nodes:smoke',
                file: 'C:/runtime/node-mesh-smoke-last.json',
                nodeId: 'node-cockpit-stale',
                finalNodeStatus: 'online',
                recentCapabilityId: 'files.write',
                error: null,
                stale: true,
                recommendedAction: 'npm run test:nodes:smoke',
              },
            }),
          ),
        } as any,
      },
      {
        now: () => new Date('2026-03-29T12:00:00.000Z'),
        statsProvider: () => ({
          uptime_seconds: 7200,
          ram_mb_rss: 256,
          ram_mb_heap: 128,
          cpu_arch: 'x64',
          platform: 'win32',
          timestamp: '2026-03-29T12:00:00.000Z',
        }),
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'node-mesh-smoke',
          title: 'Node Mesh smoke is stale',
        }),
      ]),
    );
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'validate-node-mesh-smoke',
          command: 'npm run test:nodes:smoke',
        }),
      ]),
    );
    expect(snapshot.highlights.join(' ')).toContain('report became stale');
  });

  it('shows when maintenance automation was prioritized by Node Mesh smoke', () => {
    const service = new OperationsCockpitService(
      logRepo,
      {
        operationsHealthService: {
          readSnapshot: jest.fn(() =>
            createOperationsSnapshot({
              maintenanceAutomation: {
                enabled: true,
                running: false,
                lastTriggeredAt: '2026-03-29T11:58:00.000Z',
                lastTriggerSource: 'priority',
                lastPriorityReason: 'Operational priority: renew stale Node Mesh smoke.',
                nextPlannedAt: '2026-03-30T04:30:00.000Z',
                updatedAt: '2026-03-29T11:58:00.000Z',
                updatedBy: null,
                note: 'Operational priority: renew stale Node Mesh smoke.',
                lastActionId: 'validate-node-mesh-smoke',
                lastActionLogFile: 'C:/runtime/actions/node-mesh.log',
                lastReportFinishedAt: '2026-03-29T11:59:00.000Z',
                lastReportStepCount: 1,
              },
            }),
          ),
        } as any,
      },
      {
        now: () => new Date('2026-03-29T12:00:00.000Z'),
        statsProvider: () => ({
          uptime_seconds: 7200,
          ram_mb_rss: 256,
          ram_mb_heap: 128,
          cpu_arch: 'x64',
          platform: 'win32',
          timestamp: '2026-03-29T12:00:00.000Z',
        }),
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'maintenance-automation',
          title: 'Automacao prioritaria executada',
        }),
      ]),
    );
    expect(snapshot.highlights.join(' ')).toContain('Last priority auto-trigger');
    expect(snapshot.highlights.join(' ')).toContain('stale Node Mesh smoke');
  });

  it('describes native Slack and WhatsApp Cloud API honestly when both channels are healthy', () => {
    const service = new OperationsCockpitService(
      logRepo,
      {
        operationsHealthService: {
          readSnapshot: jest.fn(() => createOperationsSnapshot({
            channels: {
              discordBridge: createOperationsSnapshot().channels.discordBridge,
              whatsapp: {
                mode: 'cloud-api',
                enabled: true,
                started: true,
                recipientsConfigured: 2,
                allowedChatIds: ['5511999999999', '5511888888888'],
                provider: 'cloud-api',
                providerConfigured: true,
                providerDecision: 'Cloud API conectada.',
                sessionDir: null,
                sessionDirConfigured: false,
                phoneNumberId: '1234567890',
                webhookConfigured: true,
                lastInboundAt: '2026-03-29T11:58:30.000Z',
                lastOutboundAt: '2026-03-29T11:58:40.000Z',
                lastError: null,
                updatedAt: '2026-03-29T11:58:40.000Z',
              },
              slack: {
                mode: 'native',
                enabled: true,
                started: true,
                recipientsConfigured: 1,
                allowedChannelIds: ['C-ops'],
                transport: 'native',
                nativeConfigured: true,
                apiBaseUrl: 'https://slack.test/api',
                workspaceId: 'T-ops',
                workspaceConfigured: true,
                lastInboundAt: '2026-03-29T11:58:20.000Z',
                lastOutboundAt: '2026-03-29T11:58:35.000Z',
                lastError: null,
                updatedAt: '2026-03-29T11:58:35.000Z',
              },
            },
          })),
        } as any,
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.highlights.join(' ')).toContain('WhatsApp Cloud API active');
    expect(snapshot.highlights.join(' ')).toContain('Native Slack active');
    expect(snapshot.actions.find((entry) => entry.id === 'prepare-whatsapp-channel')).toBeUndefined();
    expect(snapshot.actions.find((entry) => entry.id === 'prepare-slack-channel')).toBeUndefined();
  });

  it('surfaces native webhook validation actions when Slack or WhatsApp are misconfigured', () => {
    const service = new OperationsCockpitService(
      logRepo,
      {
        operationsHealthService: {
          readSnapshot: jest.fn(() => createOperationsSnapshot({
            channelProviderDoctor: {
              available: true,
              status: 'failed',
              checkedAt: '2026-03-29T11:58:45.000Z',
              summary: 'Native channel doctor found operational pending items.',
              command: 'npm run test:channels:smoke',
              file: 'C:/runtime/channel-provider-doctor-last.json',
              stale: false,
              ageMs: 60_000,
              maxAgeMs: 43_200_000,
              recommendedAction: 'npm run test:channels:smoke',
              items: [
                {
                  channelId: 'slack',
                  mode: 'native',
                  status: 'failed',
                  configured: false,
                  summary: 'Native Slack is enabled but still missing operational prerequisites.',
                  error: 'Missing fields: SLACK_SIGNING_SECRET.',
                },
              ],
            },
            channels: {
              discordBridge: createOperationsSnapshot().channels.discordBridge,
              whatsapp: {
                mode: 'cloud-api',
                enabled: true,
                started: false,
                recipientsConfigured: 0,
                allowedChatIds: [],
                provider: 'cloud-api',
                providerConfigured: false,
                providerDecision: 'Cloud API escolhida.',
                sessionDir: null,
                sessionDirConfigured: false,
                phoneNumberId: null,
                webhookConfigured: false,
                lastInboundAt: null,
                lastOutboundAt: null,
                lastError: null,
                updatedAt: '2026-03-29T11:58:40.000Z',
              },
              slack: {
                mode: 'native',
                enabled: true,
                started: false,
                recipientsConfigured: 0,
                allowedChannelIds: [],
                transport: 'native',
                nativeConfigured: false,
                apiBaseUrl: 'https://slack.test/api',
                workspaceId: 'T-ops',
                workspaceConfigured: true,
                lastInboundAt: null,
                lastOutboundAt: null,
                lastError: null,
                updatedAt: '2026-03-29T11:58:35.000Z',
              },
            },
          })),
        } as any,
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Native channel doctor failed' }),
      expect.objectContaining({ title: 'WhatsApp Cloud API requires validation' }),
      expect.objectContaining({ title: 'Native Slack requires validation' }),
    ]));
    expect(snapshot.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'validate-channel-providers', command: 'npm run test:channels:smoke' }),
      expect.objectContaining({ id: 'prepare-whatsapp-channel', label: 'Validar WhatsApp Cloud API' }),
      expect.objectContaining({ id: 'prepare-slack-channel', label: 'Validar Slack nativo' }),
    ]));
  });
});
