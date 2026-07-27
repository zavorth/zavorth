import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index';
import { OperationsHealthService } from '../../src/services/OperationsHealthService';
import { SandboxExecutionService } from '../../src/services/SandboxExecutionService';
import { OperationalSecurityService } from '../../src/services/OperationalSecurityService';
import { SidecarStatusService } from '../../src/services/SidecarStatusService';

describe('OperationsHealthService', () => {
  const tempDirs: string[] = [];
  const originalMaintenanceAutomationStateFile = config.maintenanceAutomationStateFile;
  const originalMaintenanceAutomationReportFile = config.maintenanceAutomationReportFile;
  const originalZavorthBridgeMobileLeaseFile = config.zavorthBridgeMobileLeaseFile;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(SandboxExecutionService.prototype, 'getDockerStatus').mockImplementation(((language: string) => ({
      enabled: false,
      language,
      image: `${language}:mock`,
      dockerReachable: false,
      daemonReachable: false,
      imagePresent: false,
      autoPullEnabled: false,
      sandboxRuntime: 'runc',
      canRun: false,
      detail: 'docker sandbox desabilitado por configuraction.',
    })) as any);
    jest.spyOn(SandboxExecutionService.prototype, 'isDockerAvailable').mockReturnValue(false);
    jest.spyOn(SandboxExecutionService.prototype, 'getFirecrackerStatus').mockReturnValue({
      enabled: false,
      available: false,
      canRun: false,
      detail: 'firecracker desabilitado por configuraction.',
      kvmAvailable: false,
      kernelPresent: false,
      rootfsPresent: false,
    } as any);
    jest.spyOn(SandboxExecutionService.prototype, 'isFirecrackerAvailable').mockReturnValue(false);
    jest.spyOn(OperationalSecurityService.prototype, 'readSnapshot').mockReturnValue({
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
        generatedAt: '2026-04-01T12:00:00.000Z',
        ok: true,
        summary: 'ok',
      },
      lastPreflight: {
        available: true,
        generatedAt: '2026-04-01T12:01:00.000Z',
        ok: true,
        summary: 'ok',
      },
      needsAttention: false,
    } as any);
    jest.spyOn(SidecarStatusService.prototype, 'readSummary').mockReturnValue({
      AIGateway: {
        name: 'AIGateway',
        enabled: true,
        ready: true,
        running: true,
        message: 'Ready.',
        checkedAt: '2026-04-01T12:00:00.000Z',
      },
      ZavorthTerminal: {
        name: 'Zavorth Remote Terminal Sidecar',
        enabled: false,
        ready: false,
        running: false,
        message: 'Desativado.',
        checkedAt: '2026-04-01T12:00:00.000Z',
      },
    } as any);
  });

  afterEach(() => {
    config.maintenanceAutomationStateFile = originalMaintenanceAutomationStateFile;
    config.maintenanceAutomationReportFile = originalMaintenanceAutomationReportFile;
    config.zavorthBridgeMobileLeaseFile = originalZavorthBridgeMobileLeaseFile;
    jest.restoreAllMocks();
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('includes channel health snapshots in the operations snapshot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ops-health-'));
    tempDirs.push(root);
    const discordBridgeStatusFile = path.join(root, 'discord-bridge-status.json');
    const whatsappStatusFile = path.join(root, 'whatsapp-status.json');
    const slackStatusFile = path.join(root, 'slack-status.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const nodeMeshSmokeReportFile = path.join(root, 'node-mesh-smoke-last.json');
    const channelProviderDoctorReportFile = path.join(root, 'channel-provider-doctor-last.json');
    const remoteTransportDoctorReportFile = path.join(root, 'remote-transport-doctor-last.json');
    const maintenanceAutomationStateFile = path.join(root, 'maintenance-automation-state.json');
    const maintenanceAutomationReportFile = path.join(root, 'maintenance-recurring-last.json');
    const zavorthBridgeMobileLeaseFile = path.join(root, 'zavorth-bridge-mobile-lease.json');

    config.maintenanceAutomationStateFile = maintenanceAutomationStateFile;
    config.maintenanceAutomationReportFile = maintenanceAutomationReportFile;
    config.zavorthBridgeMobileLeaseFile = zavorthBridgeMobileLeaseFile;

    fs.writeFileSync(
      discordBridgeStatusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: true,
        allowDirectMessages: true,
        allowedGuildIds: ['guild-1'],
        pendingInbox: 3,
        pendingOutbox: 1,
        lastError: null,
        updatedAt: '2026-04-01T12:03:00.000Z',
      }),
      'utf8',
    );
    fs.writeFileSync(
      whatsappStatusFile,
      JSON.stringify({
        mode: 'stub',
        enabled: true,
        started: true,
        recipientsConfigured: 2,
        allowedChatIds: ['5511999999999', '5511888888888'],
        sessionDir: path.join(root, 'whatsapp-session'),
        sessionDirConfigured: true,
        lastInboundAt: '2026-04-01T12:02:00.000Z',
        lastOutboundAt: '2026-04-01T12:03:00.000Z',
        lastError: null,
        updatedAt: '2026-04-01T12:03:30.000Z',
      }),
      'utf8',
    );
    fs.writeFileSync(
      slackStatusFile,
      JSON.stringify({
        mode: 'stub',
        enabled: true,
        started: true,
        recipientsConfigured: 1,
        allowedChannelIds: ['C-ops'],
        workspaceId: 'T-ops',
        workspaceConfigured: true,
        lastInboundAt: '2026-04-01T12:01:30.000Z',
        lastOutboundAt: '2026-04-01T12:03:10.000Z',
        lastError: null,
        updatedAt: '2026-04-01T12:03:40.000Z',
      }),
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
            firstSeenAt: '2026-04-01T12:00:00.000Z',
            lastSeenAt: '2026-04-01T12:04:00.000Z',
          },
        },
      }),
      'utf8',
    );
    fs.writeFileSync(
      nodeMeshSmokeReportFile,
      JSON.stringify({
        startedAt: '2026-04-01T12:01:00.000Z',
        finishedAt: '2026-04-01T12:02:00.000Z',
        status: 'passed',
        ok: true,
        command: 'npm run test:nodes:smoke',
        summary: 'Smoke real do Node Mesh passou com pairing, heartbeat e invoke completos.',
        nodeId: 'node-ops-1',
        finalNodeStatus: 'online',
        recentCapabilityId: 'files.write',
        error: null,
      }),
      'utf8',
    );
    fs.writeFileSync(
      channelProviderDoctorReportFile,
      JSON.stringify({
        checkedAt: '2026-04-01T12:02:30.000Z',
        status: 'passed',
        summary: 'Doctor dos canais nactives validou os providers configurados.',
        command: 'npm run test:channels:smoke',
        items: [
          {
            channelId: 'slack',
            mode: 'native',
            status: 'passed',
            configured: true,
            summary: 'Slack native validated.',
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
      }),
      'utf8',
    );
    fs.writeFileSync(
      remoteTransportDoctorReportFile,
      JSON.stringify({
        checkedAt: '2026-04-01T12:02:40.000Z',
        status: 'passed',
        summary: 'Doctor dos transportes remotos validou os fluxos configurados.',
        command: 'npm run test:transports:smoke',
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
      }),
      'utf8',
    );
    fs.writeFileSync(
      zavorthBridgeMobileLeaseFile,
      JSON.stringify({
        leaseId: 'lease-1',
        status: 'active',
        createdAt: '2026-04-01T12:00:00.000Z',
        updatedAt: '2026-04-01T12:03:20.000Z',
        expiresAt: '2026-04-01T14:03:20.000Z',
        requestedBy: 'operator-1',
        mode: 'public',
        accessUrl: 'https://ag.example.com',
        localUrl: 'http://192.168.0.20:4747',
        publicUrl: 'https://ag.example.com',
        baseUrl: 'http://127.0.0.1:4747',
        requiresPassword: true,
        startedSidecar: true,
        activatedRemoteMode: true,
        note: 'Acesso liberado para o celular.',
      }),
      'utf8',
    );
    fs.writeFileSync(
      maintenanceAutomationStateFile,
      JSON.stringify({
        enabled: true,
        running: false,
        lastTriggeredAt: '2026-04-01T12:04:00.000Z',
        lastTriggeredDateKey: '2026-04-01',
        lastTriggerSource: 'priority',
        lastPriorityReason: 'Operational priority: renew o Node Mesh smoke vencido.',
        lastActionId: 'validate-node-mesh-smoke',
        lastActionLogFile: path.join(root, 'validate-node-mesh-smoke.log'),
        updatedAt: '2026-04-01T12:04:00.000Z',
        updatedBy: null,
        note: 'Operational priority: renew o Node Mesh smoke vencido.',
      }),
      'utf8',
    );
    fs.writeFileSync(
      maintenanceAutomationReportFile,
      JSON.stringify({
        finishedAt: '2026-04-01T12:04:30.000Z',
        steps: [{ step: 'test:nodes:smoke', status: 'completed' }],
      }),
      'utf8',
    );

    const service = new OperationsHealthService(
      { getRecentLogs: jest.fn(() => []) } as any,
      {
        now: () => new Date('2026-04-01T12:05:00.000Z'),
        discordBridgeStatusFile,
        whatsappStatusFile,
        slackStatusFile,
        tenantRegistryFile,
        nodeMeshSmokeReportFile,
        channelProviderDoctorReportFile,
        remoteTransportDoctorReportFile,
        statfsSync: (() => ({ bsize: 1, blocks: 1_000, bavail: 800 })) as any,
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.channels?.discordBridge).toEqual(
      expect.objectContaining({
        mode: 'native',
        enabled: true,
        started: true,
        allowDirectMessages: true,
        allowedGuildIds: ['guild-1'],
        pendingInbox: 3,
        pendingOutbox: 1,
      }),
    );
    expect(snapshot.channels?.whatsapp).toEqual(
      expect.objectContaining({
        mode: 'stub',
        enabled: true,
        started: true,
        recipientsConfigured: 2,
        allowedChatIds: ['5511999999999', '5511888888888'],
        sessionDirConfigured: true,
      }),
    );
    expect(snapshot.channels?.slack).toEqual(
      expect.objectContaining({
        mode: 'stub',
        enabled: true,
        started: true,
        recipientsConfigured: 1,
        allowedChannelIds: ['C-ops'],
        workspaceId: 'T-ops',
        workspaceConfigured: true,
      }),
    );
    expect(snapshot.tenants).toEqual(
      expect.objectContaining({
        totalCount: 1,
        pendingOnboardingCount: 1,
        publicServerCount: 1,
        file: tenantRegistryFile,
      }),
    );
    expect(snapshot.nodeMeshSmoke).toEqual(
      expect.objectContaining({
        available: true,
        status: 'passed',
        nodeId: 'node-ops-1',
        finalNodeStatus: 'online',
        recentCapabilityId: 'files.write',
        stale: false,
        recommendedAction: null,
      }),
    );
    expect(snapshot.channelProviderDoctor).toEqual(
      expect.objectContaining({
        available: true,
        status: 'passed',
        command: 'npm run test:channels:smoke',
        recommendedAction: null,
        items: expect.arrayContaining([
          expect.objectContaining({
            channelId: 'slack',
            mode: 'native',
          }),
          expect.objectContaining({
            channelId: 'whatsapp',
            mode: 'cloud-api',
          }),
        ]),
      }),
    );
    expect(snapshot.remoteTransportDoctor).toEqual(
      expect.objectContaining({
        available: true,
        status: 'passed',
        command: 'npm run test:transports:smoke',
        recommendedAction: null,
        items: expect.arrayContaining([
          expect.objectContaining({ transportId: 'AIGateway', status: 'passed' }),
          expect.objectContaining({ transportId: 'node-host', status: 'passed' }),
        ]),
      }),
    );
    expect(snapshot.zavorthBridgeMobileAccess).toEqual(
      expect.objectContaining({
        available: true,
        status: 'active',
        mode: 'public',
        accessUrl: 'https://ag.example.com',
        requiresPassword: true,
      }),
    );
    expect(snapshot.maintenanceAutomation).toEqual(
      expect.objectContaining({
        enabled: true,
        lastTriggerSource: 'priority',
        lastPriorityReason: 'Operational priority: renew o Node Mesh smoke vencido.',
        lastActionId: 'validate-node-mesh-smoke',
        lastReportStepCount: 1,
      }),
    );
  });
  it('skips recursive hotspot scans when using the fast snapshot path', () => {
    const logRepo = {
      getRecentLogs: jest.fn(() => []),
    } as any;
    const service = new OperationsHealthService(logRepo, {
      statfsSync: jest.fn(() => ({
        bsize: 4096,
        blocks: 1000,
        bavail: 500,
      })) as any,
      existsSync: jest.fn(() => false),
      readFileSync: jest.fn(() => ''),
    });
    const safeDirectorySizeSpy = jest.spyOn(service as any, 'safeDirectorySize');

    const snapshot = service.readSnapshotFast();

    expect(snapshot.storage.hotspots).toEqual([]);
    expect(snapshot.storage.freePercent).toBe(50);
    expect(safeDirectorySizeSpy).not.toHaveBeenCalled();
  });

  it('reuses cached sandbox status between live and fast snapshots without reprobing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ops-health-cache-'));
    tempDirs.push(root);
    const operationsSnapshotCacheFile = path.join(root, 'operations-health-fast.json');
    const dockerSpy = jest.spyOn(SandboxExecutionService.prototype, 'getDockerStatus');
    const firecrackerSpy = jest.spyOn(SandboxExecutionService.prototype, 'getFirecrackerStatus');

    const service = new OperationsHealthService(
      { getRecentLogs: jest.fn(() => []) } as any,
      {
        operationsSnapshotCacheFile,
      },
    );

    service.readSnapshotLive();
    expect(dockerSpy).toHaveBeenCalledTimes(3);
    expect(firecrackerSpy).toHaveBeenCalledTimes(1);

    dockerSpy.mockClear();
    firecrackerSpy.mockClear();

    const fastSnapshot = service.readSnapshotFast();

    expect(fastSnapshot.generatedAt).toBeTruthy();
    expect(dockerSpy).not.toHaveBeenCalled();
    expect(firecrackerSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(operationsSnapshotCacheFile)).toBe(true);
  });

  it('reuses the persisted fast snapshot cache across process-like service instances', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ops-health-persisted-'));
    tempDirs.push(root);
    const operationsSnapshotCacheFile = path.join(root, 'operations-health-fast.json');

    const firstService = new OperationsHealthService(
      { getRecentLogs: jest.fn(() => []) } as any,
      {
        operationsSnapshotCacheFile,
        now: () => new Date('2026-04-01T12:00:00.000Z'),
      },
    );
    firstService.readSnapshotFast();

    const dockerSpy = jest.spyOn(SandboxExecutionService.prototype, 'getDockerStatus');
    const firecrackerSpy = jest.spyOn(SandboxExecutionService.prototype, 'getFirecrackerStatus');

    const secondService = new OperationsHealthService(
      { getRecentLogs: jest.fn(() => []) } as any,
      {
        operationsSnapshotCacheFile,
        now: () => new Date('2026-04-01T12:00:30.000Z'),
      },
    );

    const snapshot = secondService.readSnapshotFast();

    expect(snapshot.generatedAt).toBe('2026-04-01T12:00:00.000Z');
    expect(dockerSpy).not.toHaveBeenCalled();
    expect(firecrackerSpy).not.toHaveBeenCalled();
  });
});
