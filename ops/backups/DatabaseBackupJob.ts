import fs from 'fs';
import path from 'path';
import { config } from '../../src/config/index.js';

export type BackupTargetEntry = {
  sourcePath: string;
  relativePath: string;
  exists: boolean;
};

type BackupTargetSpec = {
  sourcePath: string;
  relativePath: string;
  optional?: boolean;
};

export type BackupSnapshotManifest = {
  snapshotId: string;
  createdAt: string;
  sourceRoot: string;
  snapshotDir: string;
  targets: BackupTargetEntry[];
};

export type DefaultBackupRuntimeConfig = {
  projectRoot: string;
  dbPath: string;
  dbEncryptionKeyFile: string;
  hostIdentityFile: string;
  mailboxSecretFile: string;
  memoryDir: string;
  operationalMemoryDir: string;
  workspaceProfilesDir: string;
  securityAuditTrailDir: string;
  runtimeStateFiles: string[];
};

type BackupRuntime = {
  backupRoot?: string;
  sourceRoot?: string;
  targets?: BackupTargetSpec[];
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  cpSync?: typeof fs.cpSync;
  readdirSync?: typeof fs.readdirSync;
  rmSync?: typeof fs.rmSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
};

function isSubPath(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function dedupePaths(entries: string[]): string[] {
  const normalized = new Set<string>();
  const unique: string[] = [];
  for (const entry of entries) {
    const normalizedEntry = path.normalize(String(entry || ''));
    if (!normalizedEntry || normalized.has(normalizedEntry)) {
      continue;
    }
    normalized.add(normalizedEntry);
    unique.push(normalizedEntry);
  }
  return unique;
}

export function buildDefaultBackupRuntimeConfig(): DefaultBackupRuntimeConfig {
  return {
    projectRoot: config.projectRoot,
    dbPath: config.dbPath,
    dbEncryptionKeyFile: config.dbEncryptionKeyFile,
    hostIdentityFile: config.hostIdentityFile,
    mailboxSecretFile: config.mailboxSecretFile,
    memoryDir: path.resolve(config.projectRoot, 'memory'),
    operationalMemoryDir: config.operationalMemoryDir,
    workspaceProfilesDir: config.workspaceProfilesDir,
    securityAuditTrailDir: config.securityAuditTrailDir,
    runtimeStateFiles: dedupePaths([
      config.zavorthWebAuthTokenFile,
      config.dashboardRuntimeStateFile,
      config.mcpRuntimeStateFile,
      config.nodeMeshStateFile,
      config.nodeMeshSecretsFile,
      config.nodeMeshInvocationFile,
      config.pluginRegistryStateFile,
      config.platformRegistryRemoteCacheFile,
      config.platformRegistryRemoteStatusFile,
      config.surfaceIdentityStateFile,
      config.tenantRegistryStateFile,
      config.discordBridgeSecretFile,
      config.discordBridgeStateFile,
      config.discordBridgeStatusFile,
      config.whatsappStatusFile,
      config.slackStatusFile,
      config.remoteModeStateFile,
      config.operatorModeStateFile,
      config.presentationModeStateFile,
      config.demoModeStateFile,
      config.demoGuideStateFile,
      config.dailyReportStateFile,
      config.capabilityLifecycleStateFile,
      config.operationalModeStateFile,
      config.runtimeDiagnosticsFile,
      config.integrationHubStateFile,
      config.integrationHubSecretsFile,
      config.integrationHubDoctorReportFile,
      config.integrationHubProbeStateFile,
      config.securityAuditStatusFile,
      config.securityPreflightStatusFile,
      config.lastPublishStatusFile,
      config.publishHistoryFile,
      config.maintenanceStatusFile,
      config.maintenanceAutomationStateFile,
      config.maintenanceAutomationReportFile,
      config.nodeMeshSmokeReportFile,
      config.channelProviderDoctorReportFile,
      config.remoteTransportDoctorReportFile,
      config.supervisedReloadReportFile,
      config.supervisedReloadNotificationFile,
      config.autoRepairReportFile,
      config.zavorthBridgeRemoteDoctorReportFile,
      config.zavorthBridgeMobileLeaseFile,
      config.zavorthBridgePublicTunnelStateFile,
      config.AIGatewayGatewayStatusFile,
      config.AIGatewaySyncStatusFile,
      config.ZavorthTerminalSyncStatusFile,
      config.AIGatewayCompatibilityStatusFile,
      config.AIGatewaySidecarStatusFile,
      config.ZavorthTerminalSidecarStatusFile,
      config.hostSupervisorLockFile,
      config.hostAutoRepairStateFile,
      config.telegramProcessLockFile,
    ]),
  };
}

export function buildDefaultBackupTargets(runtimeConfig: DefaultBackupRuntimeConfig = buildDefaultBackupRuntimeConfig()) {
  const projectRoot = path.resolve(runtimeConfig.projectRoot);
  const runtimeTargets = dedupePaths([
    runtimeConfig.dbEncryptionKeyFile,
    runtimeConfig.hostIdentityFile,
    runtimeConfig.mailboxSecretFile,
    ...runtimeConfig.runtimeStateFiles,
  ])
    .map((sourcePath) => path.resolve(sourcePath))
    .filter((sourcePath) => isSubPath(projectRoot, sourcePath))
    .map((sourcePath) => ({
      sourcePath,
      relativePath: path.relative(projectRoot, sourcePath),
      optional: true,
    }));

  return [
    { sourcePath: runtimeConfig.dbPath, relativePath: path.join('data', 'zavorth.db') },
    { sourcePath: runtimeConfig.dbPath + '-wal', relativePath: path.join('data', 'zavorth.db-wal') },
    { sourcePath: runtimeConfig.dbPath + '-shm', relativePath: path.join('data', 'zavorth.db-shm') },
    { sourcePath: runtimeConfig.memoryDir, relativePath: 'memory' },
    { sourcePath: runtimeConfig.operationalMemoryDir, relativePath: path.join('data', 'operational-memory') },
    { sourcePath: runtimeConfig.workspaceProfilesDir, relativePath: path.join('data', 'workspace-profiles') },
    { sourcePath: runtimeConfig.securityAuditTrailDir, relativePath: path.join('data', 'runtime', 'security-audit-trail') },
    ...runtimeTargets,
  ];
}

export class DatabaseBackupJob {
  private readonly backupRoot: string;
  private readonly sourceRoot: string;
  private readonly targets: BackupTargetSpec[];
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly cpSync: typeof fs.cpSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly rmSync: typeof fs.rmSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: BackupRuntime = {}) {
    this.backupRoot = runtime.backupRoot || path.resolve(config.projectRoot, 'data', 'backups');
    this.sourceRoot = runtime.sourceRoot || config.projectRoot;
    this.targets = runtime.targets || buildDefaultBackupTargets();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.cpSync = runtime.cpSync || fs.cpSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.rmSync = runtime.rmSync || fs.rmSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public createSnapshot(): BackupSnapshotManifest {
    this.mkdirSync(this.backupRoot, { recursive: true });
    const snapshotId = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotDir = path.join(this.backupRoot, snapshotId);
    this.mkdirSync(snapshotDir, { recursive: true });

    const copiedTargets: BackupTargetEntry[] = [];
    for (const target of this.targets) {
      const destination = path.resolve(snapshotDir, target.relativePath);
      if (!isSubPath(snapshotDir, destination)) {
        throw new Error(`Target de backup invalido fora do snapshot: ${target.relativePath}`);
      }
      const exists = this.existsSync(target.sourcePath);
      if (!exists && target.optional) {
        continue;
      }
      copiedTargets.push({
        sourcePath: target.sourcePath,
        relativePath: target.relativePath,
        exists,
      });
      if (!exists) {
        continue;
      }
      this.mkdirSync(path.dirname(destination), { recursive: true });
      this.cpSync(target.sourcePath, destination, { recursive: true });
    }

    const manifest: BackupSnapshotManifest = {
      snapshotId,
      createdAt: new Date().toISOString(),
      sourceRoot: this.sourceRoot,
      snapshotDir,
      targets: copiedTargets,
    };
    this.writeFileSync(path.join(snapshotDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return manifest;
  }

  public listSnapshots(): BackupSnapshotManifest[] {
    if (!this.existsSync(this.backupRoot)) {
      return [];
    }
    return this.readdirSync(this.backupRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(this.backupRoot, entry.name, 'manifest.json'))
      .filter((filePath) => this.existsSync(filePath))
      .map((filePath) => JSON.parse(String(this.readFileSync(filePath, 'utf8') || '{}')) as BackupSnapshotManifest)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public cleanOldBackups(
    retentionDays = config.backupRetentionDays,
    maxSnapshots = config.backupRetentionCount,
  ): number {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const snapshots = this.listSnapshots();
    let removed = 0;
    for (const [index, snapshot] of snapshots.entries()) {
      const isOlderThanCutoff = Date.parse(snapshot.createdAt) < cutoff;
      const exceedsRetentionCount = index >= maxSnapshots;
      if (!isOlderThanCutoff && !exceedsRetentionCount) {
        continue;
      }
      this.rmSync(snapshot.snapshotDir, { recursive: true, force: true });
      removed += 1;
    }
    return removed;
  }
}
