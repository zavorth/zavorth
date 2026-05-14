import fs from 'fs';
import type { SystemLog } from '../../storage/LogRepository.js';
import { OperationsHealthChannelSnapshotSupport } from './OperationsHealthChannelSnapshotSupport.js';
import { OperationsHealthDoctorSnapshotSupport } from './OperationsHealthDoctorSnapshotSupport.js';
import { OperationsHealthOpsSnapshotSupport } from './OperationsHealthOpsSnapshotSupport.js';

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

  public readChannelsSnapshot(): any {
    return this.channelSupport.readChannelsSnapshot();
  }

  public readNodeMeshSmokeSnapshot(): any {
    return this.doctorSupport.readNodeMeshSmokeSnapshot();
  }

  public readDiscordBridgeSnapshot(): any {
    return this.channelSupport.readDiscordBridgeSnapshot();
  }

  public readWhatsAppChannelSnapshot(): any {
    return this.channelSupport.readWhatsAppChannelSnapshot();
  }

  public readSlackChannelSnapshot(): any {
    return this.channelSupport.readSlackChannelSnapshot();
  }

  public readSignalChannelSnapshot(): any {
    return this.channelSupport.readSignalChannelSnapshot();
  }

  public readIMessageChannelSnapshot(): any {
    return this.channelSupport.readIMessageChannelSnapshot();
  }

  public readTeamsChannelSnapshot(): any {
    return this.channelSupport.readTeamsChannelSnapshot();
  }

  public readEmailChannelSnapshot(): any {
    return this.channelSupport.readEmailChannelSnapshot();
  }

  public readPlannedChannelHealthSnapshot(input: { statusFile: string; fallback: any }): any {
    return this.channelSupport.readPlannedChannelHealthSnapshot(input);
  }

  public readZavorthBridgeMobileAccessSnapshot(): any {
    return this.channelSupport.readZavorthBridgeMobileAccessSnapshot();
  }

  public readChannelProviderDoctorSnapshot(): any {
    return this.doctorSupport.readChannelProviderDoctorSnapshot();
  }

  public readRemoteTransportDoctorSnapshot(): any {
    return this.doctorSupport.readRemoteTransportDoctorSnapshot();
  }

  public readMaintenanceSnapshot(): any {
    return this.opsSupport.readMaintenanceSnapshot();
  }

  public readStorageSnapshot(cachedHotspotsOnly = false): any {
    return this.opsSupport.readStorageSnapshot(cachedHotspotsOnly);
  }

  public readRecentErrors(): any {
    return this.opsSupport.readRecentErrors();
  }

  public buildEstimatedSecuritySnapshot(cachedSecurity?: any): any {
    return this.opsSupport.buildEstimatedSecuritySnapshot(cachedSecurity);
  }

  public buildEstimatedErrors(cachedErrors?: any): any {
    return this.opsSupport.buildEstimatedErrors(cachedErrors);
  }

  public readPublishSnapshot(): any {
    return this.opsSupport.readPublishSnapshot();
  }

  public readPublishHistory(): any {
    return this.opsSupport.readPublishHistory();
  }

  public readMaintenanceAutomationSnapshot(): any {
    return this.opsSupport.readMaintenanceAutomationSnapshot();
  }

  public computeNextMaintenanceAutomationAt(enabled: boolean, now: Date, hour: number, minute: number): string | null {
    return this.opsSupport.computeNextMaintenanceAutomationAt(enabled, now, hour, minute);
  }

  public readHotspots(cachedOnly = false): any[] {
    return this.opsSupport.readHotspots(cachedOnly);
  }

  public safeDirectorySize(targetPath: string): number {
    return this.opsSupport.safeDirectorySize(targetPath);
  }

  public shouldIgnoreOperationalWarning(entry: SystemLog): boolean {
    return this.opsSupport.shouldIgnoreOperationalWarning(entry);
  }

  public mapLog(entry: SystemLog): any {
    return this.opsSupport.mapLog(entry);
  }

  public readEstimatedSecurityCheck(filePath: string): any {
    return this.opsSupport.readEstimatedSecurityCheck(filePath);
  }
}
