import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { LogRepository, type SystemLog } from '../storage/LogRepository.js';
import { OperationalSecurityService, type OperationalSecuritySnapshot } from './OperationalSecurityService.js';
import { SidecarStatusService, type SidecarStatusSummary } from './SidecarStatusService.js';
import { SandboxExecutionService } from './SandboxExecutionService.js';
import type { DockerSandboxStatus } from './sandbox/DockerSandboxRuntime.js';
import type { FirecrackerSandboxStatus } from './sandbox/FirecrackerSandboxRuntime.js';
import { TenantRegistryService, type TenantRegistrySummary } from './TenantRegistryService.js';
import { WasmSandboxCapabilityService, type WasmSandboxStatus } from './WasmSandboxCapabilityService.js';
import { OperationsHealthSnapshotService } from './operations-health/OperationsHealthSnapshotService.js';
import { logger } from '../logger.js';
import type {
ChannelsSnapshot,
  NodeMeshSmokeSnapshot,
  ChannelProviderDoctorSnapshot,
  RemoteTransportDoctorSnapshot,
  ZavorthBridgeMobileAccessSnapshot,
  SecuritySnapshot,
} from './operations-health/OperationsHealthSnapshotTypes.js';

type StorageHotspot = {
  id: string;
  label: string;
  path: string;
  bytes: number;
};

type PublishSnapshot = {
  available: boolean;
  publishedAt: string | null;
  branch: string | null;
  commit: string | null;
  sourceArchiveId: string | null;
  docsUrl: string | null;
  remoteConsoleUrl: string | null;
  gitPush: string | null;
  smokeTest: string | null;
  history: Array<{
    publishedAt: string | null;
    branch: string | null;
    commit: string | null;
    docsUrl: string | null;
    remoteConsoleUrl: string | null;
    archiveId: string | null;
    sourceArchiveId: string | null;
  }>;
};

type MaintenanceSnapshot = {
  available: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  stepCount: number;
  completedSteps: number;
  dryRun: boolean;
  withSoak: boolean;
  withPublish: boolean;
};

type MaintenanceAutomationSnapshot = {
  enabled: boolean;
  running: boolean;
  lastTriggeredAt: string | null;
  lastTriggerSource: 'automation' | 'manual' | 'priority' | null;
  lastPriorityReason: string | null;
  nextPlannedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  note: string | null;
  lastActionId: string | null;
  lastActionLogFile: string | null;
  lastReportFinishedAt: string | null;
  lastReportStepCount: number;
};

export type OperationsHealthSnapshot = {
  generatedAt: string;
  sidecars: SidecarStatusSummary;
  channels?: ChannelsSnapshot;
  tenants: TenantRegistrySummary & {
    file: string;
  };
  docker: {
    enabled: boolean;
    required: boolean;
    available: boolean;
    canRun: boolean;
    detail: string;
    sandboxRuntime: string;
    gvisorActive: boolean;
    hardeningActive: boolean;
    recommendedAction: string | null;
    languages: Record<
      'javascript' | 'python' | 'shell',
      {
        canRun: boolean;
        detail: string;
        image: string;
      }
    >;
  };
  firecracker: {
    enabled: boolean;
    available: boolean;
    canRun: boolean;
    detail: string;
    transport: 'direct' | 'wsl' | 'unknown';
    bridgeReady: boolean;
    kvmAvailable: boolean;
    kernelPresent: boolean;
    rootfsPresent: boolean;
    recommendedAction: string | null;
  };
  nodeMeshSmoke: NodeMeshSmokeSnapshot;
  channelProviderDoctor?: ChannelProviderDoctorSnapshot;
  remoteTransportDoctor: RemoteTransportDoctorSnapshot;
  zavorthBridgeMobileAccess: ZavorthBridgeMobileAccessSnapshot;
  wasm: WasmSandboxStatus;
  publish: PublishSnapshot;
  maintenance: MaintenanceSnapshot;
  maintenanceAutomation: MaintenanceAutomationSnapshot;
  storage: {
    rootPath: string;
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    freePercent: number;
    hotspots: StorageHotspot[];
  };
  security: OperationalSecuritySnapshot | SecuritySnapshot;
  errors: {
    lastError: {
      timestamp: string | null;
      level: string;
      category: string;
      message: string;
    } | null;
    recent: Array<{
      timestamp: string | null;
      level: string;
      category: string;
      message: string;
    }>;
  };
};

type OperationsHealthRuntime = {
  now?: () => Date;
  statfsSync?: typeof fs.statfsSync;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  operationsSnapshotCacheFile?: string;
  discordBridgeStatusFile?: string;
  whatsappStatusFile?: string;
  slackStatusFile?: string;
  tenantRegistryFile?: string;
  nodeMeshSmokeReportFile?: string;
  nodeMeshSmokeMaxAgeMs?: number;
  channelProviderDoctorReportFile?: string;
  channelProviderDoctorMaxAgeMs?: number;
  remoteTransportDoctorReportFile?: string;
  remoteTransportDoctorMaxAgeMs?: number;
};

export class OperationsHealthService {
  private static readonly FAST_SNAPSHOT_CACHE_TTL_MS = 30_000;
  private static readonly PERSISTED_FAST_SNAPSHOT_MAX_AGE_MS = 120_000;
  private readonly sidecars = new SidecarStatusService();
  private readonly sandbox = new SandboxExecutionService();
  private readonly wasm = new WasmSandboxCapabilityService();
  private readonly security = new OperationalSecurityService();
  private readonly now: () => Date;
  private readonly statfsSync: typeof fs.statfsSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly operationsSnapshotCacheFile: string;
  private readonly discordBridgeStatusFile: string;
  private readonly whatsappStatusFile: string;
  private readonly slackStatusFile: string;
  private readonly tenantRegistryFile: string;
  private readonly nodeMeshSmokeReportFile: string;
  private readonly nodeMeshSmokeMaxAgeMs: number;
  private readonly channelProviderDoctorReportFile: string;
  private readonly channelProviderDoctorMaxAgeMs: number;
  private readonly remoteTransportDoctorReportFile: string;
  private readonly remoteTransportDoctorMaxAgeMs: number;
  private readonly tenantRegistry: TenantRegistryService;
  private readonly snapshotService: OperationsHealthSnapshotService;
  private sizeCache: { generatedAt: number; hotspots: StorageHotspot[] } | null = null;
  private fastSnapshotCache: { generatedAt: number; snapshot: OperationsHealthSnapshot } | null = null;
  private liveSnapshotCache: { generatedAt: number; snapshot: OperationsHealthSnapshot } | null = null;

  constructor(
    private readonly logRepo: LogRepository,
    runtime: OperationsHealthRuntime = {},
  ) {
    this.now = runtime.now || (() => new Date());
    this.statfsSync = runtime.statfsSync || fs.statfsSync.bind(fs);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.operationsSnapshotCacheFile =
      runtime.operationsSnapshotCacheFile || path.resolve(config.dataDir, 'runtime', 'operations-health-fast.json');
    this.discordBridgeStatusFile = runtime.discordBridgeStatusFile || config.discordBridgeStatusFile;
    this.whatsappStatusFile = runtime.whatsappStatusFile || config.whatsappStatusFile;
    this.slackStatusFile = runtime.slackStatusFile || config.slackStatusFile;
    this.tenantRegistryFile = runtime.tenantRegistryFile || config.tenantRegistryStateFile;
    this.nodeMeshSmokeReportFile = runtime.nodeMeshSmokeReportFile || config.nodeMeshSmokeReportFile;
    this.nodeMeshSmokeMaxAgeMs = Number(runtime.nodeMeshSmokeMaxAgeMs || config.nodeMeshSmokeMaxAgeMs) || 43_200_000;
    this.channelProviderDoctorReportFile =
      runtime.channelProviderDoctorReportFile || config.channelProviderDoctorReportFile;
    this.channelProviderDoctorMaxAgeMs =
      Number(runtime.channelProviderDoctorMaxAgeMs || config.channelProviderDoctorMaxAgeMs) || 43_200_000;
    this.remoteTransportDoctorReportFile =
      runtime.remoteTransportDoctorReportFile
      || config.remoteTransportDoctorReportFile
      || path.resolve(config.dataDir, 'runtime', 'remote-transport-doctor-last.json');
    this.remoteTransportDoctorMaxAgeMs =
      Number(runtime.remoteTransportDoctorMaxAgeMs || config.remoteTransportDoctorMaxAgeMs) || 43_200_000;
    this.tenantRegistry = new TenantRegistryService({
      filePath: this.tenantRegistryFile,
      now: this.now,
      existsSync: this.existsSync,
      readFileSync: this.readFileSync,
      writeFileSync: fs.writeFileSync.bind(fs),
      mkdirSync: fs.mkdirSync.bind(fs),
    });
    this.snapshotService = new OperationsHealthSnapshotService({
      now: this.now,
      statfsSync: this.statfsSync,
      existsSync: this.existsSync,
      readFileSync: this.readFileSync,
      logRepo: this.logRepo,
      discordBridgeStatusFile: this.discordBridgeStatusFile,
      whatsappStatusFile: this.whatsappStatusFile,
      slackStatusFile: this.slackStatusFile,
      nodeMeshSmokeReportFile: this.nodeMeshSmokeReportFile,
      nodeMeshSmokeMaxAgeMs: this.nodeMeshSmokeMaxAgeMs,
      channelProviderDoctorReportFile: this.channelProviderDoctorReportFile,
      channelProviderDoctorMaxAgeMs: this.channelProviderDoctorMaxAgeMs,
      remoteTransportDoctorReportFile: this.remoteTransportDoctorReportFile,
      remoteTransportDoctorMaxAgeMs: this.remoteTransportDoctorMaxAgeMs,
    });
  }

  public readSnapshot(): OperationsHealthSnapshot {
    return this.readSnapshotLive();
  }

  public readSnapshotFast(): OperationsHealthSnapshot {
    const nowMs = this.now().getTime();
    if (
      this.fastSnapshotCache
      && nowMs - this.fastSnapshotCache.generatedAt < OperationsHealthService.FAST_SNAPSHOT_CACHE_TTL_MS
    ) {
      return this.fastSnapshotCache.snapshot;
    }

    const persisted = this.readPersistedFastSnapshot(nowMs);
    if (persisted) {
      this.fastSnapshotCache = {
        generatedAt: nowMs,
        snapshot: persisted,
      };
      return persisted;
    }

    const fallbackSnapshot = this.readPersistedFastSnapshot(nowMs, true);
    const snapshot = this.readSnapshotCore('fast', fallbackSnapshot);
    this.cacheSnapshot(snapshot, { persist: true });
    return snapshot;
  }

  public readSnapshotLive(): OperationsHealthSnapshot {
    const snapshot = this.readSnapshotCore('live');
    this.cacheSnapshot(snapshot, { persist: true });
    return snapshot;
  }

  private readSnapshotCore(
    mode: 'fast' | 'live',
    fallbackSnapshot: OperationsHealthSnapshot | null = null,
  ): OperationsHealthSnapshot {
    const cachedSnapshot = this.getLatestCachedSnapshot() || fallbackSnapshot;
    const liveProbe = mode === 'live';
    const dockerJavascript = liveProbe
      ? this.sandbox.getDockerStatus('javascript')
      : this.buildEstimatedDockerStatus('javascript', cachedSnapshot?.docker);
    const dockerPython = liveProbe
      ? this.sandbox.getDockerStatus('python')
      : this.buildEstimatedDockerStatus('python', cachedSnapshot?.docker);
    const dockerShell = liveProbe
      ? this.sandbox.getDockerStatus('shell')
      : this.buildEstimatedDockerStatus('shell', cachedSnapshot?.docker);
    const firecrackerStatus = liveProbe
      ? this.sandbox.getFirecrackerStatus()
      : this.buildEstimatedFirecrackerStatus(cachedSnapshot?.firecracker);
    const wasmStatus = !liveProbe && cachedSnapshot?.wasm
      ? cachedSnapshot.wasm
      : this.wasm.getStatus('wasm');
    const securitySnapshot = !liveProbe
      ? this.snapshotService.buildEstimatedSecuritySnapshot(cachedSnapshot?.security)
      : this.security.readSnapshot();
    const errors = !liveProbe
      ? this.snapshotService.buildEstimatedErrors(cachedSnapshot?.errors)
      : this.snapshotService.readRecentErrors();

    return {
      generatedAt: this.now().toISOString(),
      sidecars: this.sidecars.readSummary(),
      channels: this.snapshotService.readChannelsSnapshot(),
      tenants: {
        ...this.tenantRegistry.summarize(),
        file: this.tenantRegistryFile,
      },
      docker: {
        enabled: dockerJavascript.enabled,
        required: config.dockerSandboxRequired,
        available: dockerJavascript.dockerReachable && dockerJavascript.daemonReachable,
        canRun: dockerJavascript.canRun,
        detail: dockerJavascript.detail,
        sandboxRuntime: dockerJavascript.sandboxRuntime,
        gvisorActive: dockerJavascript.sandboxRuntime === 'runsc' && dockerJavascript.canRun,
        hardeningActive:
          config.dockerSandboxReadOnly
          && config.dockerSandboxCapDropAll
          && config.dockerSandboxNoNewPrivileges
          && config.dockerSandboxPidsLimit > 0,
        recommendedAction: !dockerJavascript.enabled
          ? null
          : (!dockerJavascript.canRun
            ? 'npm run sandbox:doctor'
            : (dockerJavascript.sandboxRuntime === 'runsc' ? 'npm run sandbox:doctor:smoke' : 'npm run sandbox:doctor')),
        languages: {
          javascript: {
            canRun: dockerJavascript.canRun,
            detail: dockerJavascript.detail,
            image: dockerJavascript.image,
          },
          python: {
            canRun: dockerPython.canRun,
            detail: dockerPython.detail,
            image: dockerPython.image,
          },
          shell: {
            canRun: dockerShell.canRun,
            detail: dockerShell.detail,
            image: dockerShell.image,
          },
        },
      },
      firecracker: {
        enabled: firecrackerStatus.enabled,
        available: firecrackerStatus.firecrackerReachable,
        canRun: firecrackerStatus.canRun,
        detail: firecrackerStatus.detail,
        transport: firecrackerStatus.transport || 'unknown',
        bridgeReady: firecrackerStatus.bridgeReady === true,
        kvmAvailable: firecrackerStatus.kvmAvailable,
        kernelPresent: firecrackerStatus.kernelPresent,
        rootfsPresent: firecrackerStatus.rootfsPresent,
        recommendedAction: firecrackerStatus.enabled ? 'npm run sandbox:firecracker:smoke' : null,
      },
      nodeMeshSmoke: this.snapshotService.readNodeMeshSmokeSnapshot(),
      channelProviderDoctor: this.snapshotService.readChannelProviderDoctorSnapshot(),
      remoteTransportDoctor: this.snapshotService.readRemoteTransportDoctorSnapshot(),
      zavorthBridgeMobileAccess: this.snapshotService.readZavorthBridgeMobileAccessSnapshot(),
      wasm: wasmStatus,
      publish: this.snapshotService.readPublishSnapshot(),
      maintenance: this.snapshotService.readMaintenanceSnapshot(),
      maintenanceAutomation: this.snapshotService.readMaintenanceAutomationSnapshot(),
      storage: this.snapshotService.readStorageSnapshot(!liveProbe),
      security: securitySnapshot,
      errors,
    };
  }

  private getLatestCachedSnapshot(): OperationsHealthSnapshot | null {
    const nowMs = this.now().getTime();
    if (
      this.liveSnapshotCache
      && nowMs - this.liveSnapshotCache.generatedAt <= OperationsHealthService.PERSISTED_FAST_SNAPSHOT_MAX_AGE_MS
    ) {
      return this.liveSnapshotCache.snapshot;
    }

    if (
      this.fastSnapshotCache
      && nowMs - this.fastSnapshotCache.generatedAt <= OperationsHealthService.PERSISTED_FAST_SNAPSHOT_MAX_AGE_MS
    ) {
      return this.fastSnapshotCache.snapshot;
    }

    return null;
  }

  private cacheSnapshot(snapshot: OperationsHealthSnapshot, options: { persist?: boolean } = {}): void {
    const generatedAt = this.now().getTime();
    this.liveSnapshotCache = {
      generatedAt,
      snapshot,
    };
    this.fastSnapshotCache = {
      generatedAt,
      snapshot,
    };

    if (options.persist !== true) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(this.operationsSnapshotCacheFile), { recursive: true });
      fs.writeFileSync(this.operationsSnapshotCacheFile, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (error: any) {
      // Fast snapshot persistence must never break operational reads.
      logger.warn('[Operations] filesystem operation failed', error);
    }
  }

  private readPersistedFastSnapshot(
    nowMs: number,
    allowStale = false,
  ): OperationsHealthSnapshot | null {
    try {
      if (!this.existsSync(this.operationsSnapshotCacheFile)) {
        return null;
      }

      const parsed = JSON.parse(this.readFileSync(this.operationsSnapshotCacheFile, 'utf8')) as OperationsHealthSnapshot;
      const generatedAtMs = Date.parse(String(parsed?.generatedAt || ''));
      if (!Number.isFinite(generatedAtMs)) {
        return null;
      }

      if (
        !allowStale
        && nowMs - generatedAtMs > OperationsHealthService.PERSISTED_FAST_SNAPSHOT_MAX_AGE_MS
      ) {
        return null;
      }

      if (!parsed.remoteTransportDoctor) {
        parsed.remoteTransportDoctor = this.snapshotService.readRemoteTransportDoctorSnapshot();
      }

      if (!parsed.zavorthBridgeMobileAccess) {
        parsed.zavorthBridgeMobileAccess = this.snapshotService.readZavorthBridgeMobileAccessSnapshot();
      }

      return parsed;
    } catch (error: any) { logger.warn('[Operations] parsing failed', error); return null; }
  }

  private buildEstimatedDockerStatus(
    language: 'javascript' | 'python' | 'shell',
    cachedDocker?: OperationsHealthSnapshot['docker'],
  ): DockerSandboxStatus {
    const image = this.sandbox.getDockerImageForLanguage(language);
    const sandboxRuntime = cachedDocker?.sandboxRuntime || config.dockerSandboxRuntime || 'runc';
    const cachedLanguage = cachedDocker?.languages?.[language];
    const cachedAvailable = cachedDocker?.available === true;
    const cachedCanRun = cachedLanguage?.canRun === true;

    if (!config.dockerSandboxEnabled) {
      return {
        enabled: false,
        language,
        image,
        dockerReachable: false,
        daemonReachable: false,
        imagePresent: false,
        autoPullEnabled: config.dockerSandboxAutoPull,
        sandboxRuntime,
        canRun: false,
        detail: 'docker sandbox desabilitado por configuracao.',
      };
    }

    return {
      enabled: true,
      language,
      image,
      dockerReachable: cachedAvailable,
      daemonReachable: cachedAvailable,
      imagePresent: cachedCanRun,
      autoPullEnabled: config.dockerSandboxAutoPull,
      sandboxRuntime,
      canRun: cachedCanRun,
      detail:
        cachedLanguage?.detail
        || (cachedAvailable
          ? `Fast snapshot reutilizou o ultimo status conhecido do Docker (${sandboxRuntime}). Use --live para renovar o probe.`
          : 'Fast snapshot sem probe ao vivo do Docker. Use --live para validar daemon, runtime e imagens agora.'),
    };
  }

  private buildEstimatedFirecrackerStatus(
    cachedFirecracker?: OperationsHealthSnapshot['firecracker'],
  ): FirecrackerSandboxStatus {
    if (!config.firecrackerEnabled) {
      return {
        enabled: false,
        transport: cachedFirecracker?.transport === 'direct' || cachedFirecracker?.transport === 'wsl'
          ? cachedFirecracker.transport
          : undefined,
        bridgeReady: false,
        firecrackerReachable: false,
        kvmAvailable: false,
        kernelPresent: false,
        rootfsPresent: false,
        canRun: false,
        detail: 'Firecracker MicroVM desabilitado por configuracao (ZAVORTH_FIRECRACKER_ENABLED).',
      };
    }

    return {
      enabled: true,
      transport: cachedFirecracker?.transport === 'direct' || cachedFirecracker?.transport === 'wsl'
        ? cachedFirecracker.transport
        : undefined,
      bridgeReady: cachedFirecracker?.bridgeReady === true,
      firecrackerReachable: cachedFirecracker?.available === true,
      kvmAvailable: cachedFirecracker?.kvmAvailable === true,
      kernelPresent: cachedFirecracker?.kernelPresent === true,
      rootfsPresent: cachedFirecracker?.rootfsPresent === true,
      canRun: cachedFirecracker?.canRun === true,
      detail:
        cachedFirecracker?.detail
        || 'Fast snapshot sem probe ao vivo do Firecracker. Use --live para validar a MicroVM agora.',
    };
  }

  private safeDirectorySize(targetPath: string): number {
    return this.snapshotService.safeDirectorySize(targetPath);
  }

}
