import fs from 'fs';
import type { SystemLog } from '../../storage/LogRepository.js';
import { OperationsHealthChannelSnapshotSupport } from './OperationsHealthChannelSnapshotSupport.js';
import { OperationsHealthDoctorSnapshotSupport } from './OperationsHealthDoctorSnapshotSupport.js';
import { OperationsHealthOpsSnapshotSupport } from './OperationsHealthOpsSnapshotSupport.js';
import type {
  ChannelsSnapshot,
  NodeMeshSmokeSnapshot,
  DiscordBridgeSnapshot,
  WhatsAppChannelSnapshot,
  SlackChannelSnapshot,
  PlannedChannelSnapshot,
  ChannelProviderDoctorSnapshot,
  RemoteTransportDoctorSnapshot,
  MaintenanceSnapshot,
  StorageSnapshot,
  RecentErrorsSnapshot,
  SecuritySnapshot,
  PublishSnapshot,
  PublishHistoryEntry,
  MaintenanceAutomationSnapshot,
  ZavorthBridgeMobileAccessSnapshot,
  HotspotEntry,
  MappedLog,
  SecurityCheckSnapshot,
} from './OperationsHealthSnapshotTypes.js';

type OperationsHealthSnapshotReaderOptions = {
  now: () => Date;
  statfsSync: typeof fs.statfsSync;
  existsSync: typeof fs.existsSync;
  readFileSync: typeof fs.readFileSync;
  logRepo: { getRecentLogs: (limit: number) => SystemLog[] };
  discordBridgeStatusFile: string;
  whatsappStatusFile: string;
  slackStatusFile: string;
  nodeMeshSmokeReportFile: string;
  nodeMeshSmokeMaxAgeMs: number;
  channelProviderDoctorReportFile: string;
  channelProviderDoctorMaxAgeMs: number;
  remoteTransportDoctorReportFile: string;
  remoteTransportDoctorMaxAgeMs: number;
};

export class OperationsHealthSnapshotService {
  private readonly channelSupport: OperationsHealthChannelSnapshotSupport;
  private readonly doctorSupport: OperationsHealthDoctorSnapshotSupport;
  private readonly opsSupport: OperationsHealthOpsSnapshotSupport;

  constructor(options: OperationsHealthSnapshotReaderOptions) {
    this.channelSupport = new OperationsHealthChannelSnapshotSupport({
      now: options.now,
      existsSync: options.existsSync,
      readFileSync: options.readFileSync,
      discordBridgeStatusFile: options.discordBridgeStatusFile,
      whatsappStatusFile: options.whatsappStatusFile,
      slackStatusFile: options.slackStatusFile,
    });
    this.doctorSupport = new OperationsHealthDoctorSnapshotSupport({
      now: options.now,
      existsSync: options.existsSync,
      readFileSync: options.readFileSync,
      nodeMeshSmokeReportFile: options.nodeMeshSmokeReportFile,
      nodeMeshSmokeMaxAgeMs: options.nodeMeshSmokeMaxAgeMs,
      channelProviderDoctorReportFile: options.channelProviderDoctorReportFile,
      channelProviderDoctorMaxAgeMs: options.channelProviderDoctorMaxAgeMs,
      remoteTransportDoctorReportFile: options.remoteTransportDoctorReportFile,
      remoteTransportDoctorMaxAgeMs: options.remoteTransportDoctorMaxAgeMs,
    });
    this.opsSupport = new OperationsHealthOpsSnapshotSupport({
      now: options.now,
      statfsSync: options.statfsSync,
      existsSync: options.existsSync,
      readFileSync: options.readFileSync,
      logRepo: options.logRepo,
    });
  }

  public readChannelsSnapshot(): ChannelsSnapshot {
    return this.channelSupport.readChannelsSnapshot();
  }

  public readNodeMeshSmokeSnapshot(): NodeMeshSmokeSnapshot {
    return this.doctorSupport.readNodeMeshSmokeSnapshot();
  }

  public readDiscordBridgeSnapshot(): DiscordBridgeSnapshot {
    return this.channelSupport.readDiscordBridgeSnapshot();
  }

  public readWhatsAppChannelSnapshot(): WhatsAppChannelSnapshot {
    return this.channelSupport.readWhatsAppChannelSnapshot();
  }

  public readSlackChannelSnapshot(): SlackChannelSnapshot {
    return this.channelSupport.readSlackChannelSnapshot();
  }

  public readSignalChannelSnapshot(): PlannedChannelSnapshot {
    return this.channelSupport.readSignalChannelSnapshot();
  }

  public readIMessageChannelSnapshot(): PlannedChannelSnapshot {
    return this.channelSupport.readIMessageChannelSnapshot();
  }

  public readTeamsChannelSnapshot(): PlannedChannelSnapshot {
    return this.channelSupport.readTeamsChannelSnapshot();
  }

  public readEmailChannelSnapshot(): PlannedChannelSnapshot {
    return this.channelSupport.readEmailChannelSnapshot();
  }

  public readPlannedChannelHealthSnapshot(input: { statusFile: string; fallback: PlannedChannelSnapshot }): PlannedChannelSnapshot {
    return this.channelSupport.readPlannedChannelHealthSnapshot(input);
  }

  public readZavorthBridgeMobileAccessSnapshot(): ZavorthBridgeMobileAccessSnapshot {
    return this.channelSupport.readZavorthBridgeMobileAccessSnapshot();
  }

  public readChannelProviderDoctorSnapshot(): ChannelProviderDoctorSnapshot {
    return this.doctorSupport.readChannelProviderDoctorSnapshot();
  }

  public readRemoteTransportDoctorSnapshot(): RemoteTransportDoctorSnapshot {
    return this.doctorSupport.readRemoteTransportDoctorSnapshot();
  }

  public readMaintenanceSnapshot(): MaintenanceSnapshot {
    return this.opsSupport.readMaintenanceSnapshot();
  }

  public readStorageSnapshot(cachedHotspotsOnly = false): StorageSnapshot {
    return this.opsSupport.readStorageSnapshot(cachedHotspotsOnly);
  }

  public readRecentErrors(): RecentErrorsSnapshot {
    return this.opsSupport.readRecentErrors();
  }

  public buildEstimatedSecuritySnapshot(cachedSecurity?: SecuritySnapshot): SecuritySnapshot {
    return this.opsSupport.buildEstimatedSecuritySnapshot(cachedSecurity);
  }

  public buildEstimatedErrors(cachedErrors?: RecentErrorsSnapshot): RecentErrorsSnapshot {
    return this.opsSupport.buildEstimatedErrors(cachedErrors);
  }

  public readPublishSnapshot(): PublishSnapshot {
    return this.opsSupport.readPublishSnapshot();
  }

  public readPublishHistory(): PublishHistoryEntry[] {
    return this.opsSupport.readPublishHistory();
  }

  public readMaintenanceAutomationSnapshot(): MaintenanceAutomationSnapshot {
    return this.opsSupport.readMaintenanceAutomationSnapshot();
  }

  public computeNextMaintenanceAutomationAt(enabled: boolean, now: Date, hour: number, minute: number): string | null {
    return this.opsSupport.computeNextMaintenanceAutomationAt(enabled, now, hour, minute);
  }

  public readHotspots(cachedOnly = false): HotspotEntry[] {
    return this.opsSupport.readHotspots(cachedOnly);
  }

  public safeDirectorySize(targetPath: string): number {
    return this.opsSupport.safeDirectorySize(targetPath);
  }

  public shouldIgnoreOperationalWarning(entry: SystemLog): boolean {
    return this.opsSupport.shouldIgnoreOperationalWarning(entry);
  }

  public mapLog(entry: SystemLog): MappedLog {
    return this.opsSupport.mapLog(entry);
  }

  public readEstimatedSecurityCheck(filePath: string): SecurityCheckSnapshot {
    return this.opsSupport.readEstimatedSecurityCheck(filePath);
  }
}
