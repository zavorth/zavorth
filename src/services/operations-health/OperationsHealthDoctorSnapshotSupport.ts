import { logger } from '../../logger.js';
import type {
NodeMeshSmokeSnapshot,
  ChannelProviderDoctorSnapshot,
  RemoteTransportDoctorSnapshot,
  DoctorItem,
  TransportDoctorItem,
  ChannelMode,
  TransportMode,
} from './OperationsHealthSnapshotTypes.js';

type OperationsHealthDoctorSnapshotSupportOptions = {
  now: () => Date;
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: BufferEncoding) => string;
  nodeMeshSmokeReportFile: string;
  nodeMeshSmokeMaxAgeMs: number;
  channelProviderDoctorReportFile: string;
  channelProviderDoctorMaxAgeMs: number;
  remoteTransportDoctorReportFile: string;
  remoteTransportDoctorMaxAgeMs: number;
};

export class OperationsHealthDoctorSnapshotSupport {
  private readonly now: () => Date;
  private readonly existsSync: (path: string) => boolean;
  private readonly readFileSync: (path: string, encoding: BufferEncoding) => string;
  private readonly nodeMeshSmokeReportFile: string;
  private readonly nodeMeshSmokeMaxAgeMs: number;
  private readonly channelProviderDoctorReportFile: string;
  private readonly channelProviderDoctorMaxAgeMs: number;
  private readonly remoteTransportDoctorReportFile: string;
  private readonly remoteTransportDoctorMaxAgeMs: number;

  constructor(options: OperationsHealthDoctorSnapshotSupportOptions) {
    this.now = options.now;
    this.existsSync = options.existsSync;
    this.readFileSync = options.readFileSync;
    this.nodeMeshSmokeReportFile = options.nodeMeshSmokeReportFile;
    this.nodeMeshSmokeMaxAgeMs = options.nodeMeshSmokeMaxAgeMs;
    this.channelProviderDoctorReportFile = options.channelProviderDoctorReportFile;
    this.channelProviderDoctorMaxAgeMs = options.channelProviderDoctorMaxAgeMs;
    this.remoteTransportDoctorReportFile = options.remoteTransportDoctorReportFile;
    this.remoteTransportDoctorMaxAgeMs = options.remoteTransportDoctorMaxAgeMs;
  }

  public readNodeMeshSmokeSnapshot(): NodeMeshSmokeSnapshot {
    const fallback = {
      available: false,
      status: 'missing' as const,
      checkedAt: null,
      summary: null,
      command: 'npm run test:nodes:smoke',
      file: this.nodeMeshSmokeReportFile,
      nodeId: null,
      finalNodeStatus: null,
      recentCapabilityId: null,
      error: null,
      stale: false,
      ageMs: null,
      maxAgeMs: this.nodeMeshSmokeMaxAgeMs,
      recommendedAction: 'npm run test:nodes:smoke',
    };

    try {
      if (!this.nodeMeshSmokeReportFile || !this.existsSync(this.nodeMeshSmokeReportFile)) {
        return fallback;
      }

      const parsed = JSON.parse(this.readFileSync(this.nodeMeshSmokeReportFile, 'utf8')) as Record<string, unknown>;
      const rawStatus = String(parsed.status || '').trim().toLowerCase();
      const status = rawStatus === 'passed' ? 'passed' : rawStatus === 'failed' ? 'failed' : rawStatus === 'running' ? 'running' : 'missing';
      const checkedAt = String(parsed.finishedAt || parsed.startedAt || '').trim() || null;
      const checkedAtMs = checkedAt ? Date.parse(checkedAt) : Number.NaN;
      const ageMs = Number.isFinite(checkedAtMs) ? Math.max(0, this.now().getTime() - checkedAtMs) : null;
      const stale = status === 'passed' && ageMs !== null && ageMs > this.nodeMeshSmokeMaxAgeMs;
      return {
        available: status !== 'missing',
        status,
        checkedAt,
        summary: String(parsed.summary || '').trim() || null,
        command: String(parsed.command || fallback.command).trim() || fallback.command,
        file: this.nodeMeshSmokeReportFile,
        nodeId: String(parsed.nodeId || '').trim() || null,
        finalNodeStatus: String(parsed.finalNodeStatus || '').trim() || null,
        recentCapabilityId: String(parsed.recentCapabilityId || '').trim() || null,
        error: String(parsed.error || '').trim() || null,
        stale,
        ageMs,
        maxAgeMs: this.nodeMeshSmokeMaxAgeMs,
        recommendedAction: status === 'passed' && !stale ? null : (String(parsed.command || fallback.command).trim() || fallback.command),
      };
    } catch (error) { logger.warn('[Operations  Doctor Snapshot] parsing failed', error); return fallback; }
  }

  public readChannelProviderDoctorSnapshot(): ChannelProviderDoctorSnapshot {
    const fallback = {
      available: false,
      status: 'missing' as const,
      checkedAt: null,
      summary: null,
      command: 'npm run test:channels:smoke',
      file: this.channelProviderDoctorReportFile,
      stale: false,
      ageMs: null,
      maxAgeMs: this.channelProviderDoctorMaxAgeMs,
      recommendedAction: 'npm run test:channels:smoke',
      items: [],
    };

    try {
      if (!this.channelProviderDoctorReportFile || !this.existsSync(this.channelProviderDoctorReportFile)) {
        return fallback;
      }
      const parsed = JSON.parse(this.readFileSync(this.channelProviderDoctorReportFile, 'utf8')) as Record<string, unknown>;
      const rawStatus = String(parsed.status || '').trim().toLowerCase();
      const status = rawStatus === 'passed' ? 'passed' : rawStatus === 'failed' ? 'failed' : rawStatus === 'skipped' ? 'skipped' : 'missing';
      const checkedAt = String(parsed.checkedAt || '').trim() || null;
      const checkedAtMs = checkedAt ? Date.parse(checkedAt) : Number.NaN;
      const ageMs = Number.isFinite(checkedAtMs) ? Math.max(0, this.now().getTime() - checkedAtMs) : null;
      const stale = status === 'passed' && ageMs !== null && ageMs > this.channelProviderDoctorMaxAgeMs;
      const items = Array.isArray(parsed.items)
        ? parsed.items.filter((entry) => entry && typeof entry === 'object').map((entry) => {
            const item = entry as Record<string, unknown>;
            const normalizedChannelId = String(item.channelId || '').trim().toLowerCase();
            return {
              channelId:
                normalizedChannelId === 'telegram'
                || normalizedChannelId === 'discord'
                || normalizedChannelId === 'whatsapp'
                || normalizedChannelId === 'slack'
                || normalizedChannelId === 'signal'
                || normalizedChannelId === 'imessage'
                || normalizedChannelId === 'teams'
                || normalizedChannelId === 'email'
                  ? normalizedChannelId
                  : 'slack',
              mode: (item.mode === 'native'
                || item.mode === 'cloud-api'
                || item.mode === 'stub'
                || item.mode === 'baileys'
                || item.mode === 'bridge'
                || item.mode === 'signal-cli'
                || item.mode === 'mac-bridge'
                || item.mode === 'graph-bot'
                || item.mode === 'smtp-imap'
                  ? item.mode
                  : 'unknown') as ChannelMode,
              status: item.status === 'passed' || item.status === 'failed' || item.status === 'skipped' ? item.status : 'failed',
              configured: item.configured === true,
              summary: String(item.summary || '').trim(),
              error: String(item.error || '').trim() || null,
            };
          })
        : [];

      return {
        available: status !== 'missing',
        status,
        checkedAt,
        summary: String(parsed.summary || '').trim() || null,
        command: String(parsed.command || fallback.command).trim() || fallback.command,
        file: this.channelProviderDoctorReportFile,
        stale,
        ageMs,
        maxAgeMs: this.channelProviderDoctorMaxAgeMs,
        recommendedAction: status === 'passed' && !stale ? null : (String(parsed.command || fallback.command).trim() || fallback.command),
        items: items as DoctorItem[],
      };
    } catch (error) { logger.warn('[Operations  Doctor Snapshot] parsing failed', error); return fallback; }
  }

  public readRemoteTransportDoctorSnapshot(): RemoteTransportDoctorSnapshot {
    const fallback = {
      available: false,
      status: 'missing' as const,
      checkedAt: null,
      summary: null,
      command: 'npm run test:transports:smoke',
      file: this.remoteTransportDoctorReportFile,
      stale: false,
      ageMs: null,
      maxAgeMs: this.remoteTransportDoctorMaxAgeMs,
      recommendedAction: 'npm run test:transports:smoke',
      items: [],
    };

    try {
      if (!this.remoteTransportDoctorReportFile || !this.existsSync(this.remoteTransportDoctorReportFile)) {
        return fallback;
      }
      const parsed = JSON.parse(this.readFileSync(this.remoteTransportDoctorReportFile, 'utf8')) as Record<string, unknown>;
      const rawStatus = String(parsed.status || '').trim().toLowerCase();
      const status = rawStatus === 'passed' ? 'passed' : rawStatus === 'failed' ? 'failed' : rawStatus === 'running' ? 'running' : rawStatus === 'skipped' ? 'skipped' : 'missing';
      const checkedAt = String(parsed.checkedAt || parsed.finishedAt || parsed.startedAt || '').trim() || null;
      const checkedAtMs = checkedAt ? Date.parse(checkedAt) : Number.NaN;
      const ageMs = Number.isFinite(checkedAtMs) ? Math.max(0, this.now().getTime() - checkedAtMs) : null;
      const stale = status === 'passed' && ageMs !== null && ageMs > this.remoteTransportDoctorMaxAgeMs;
      const items = Array.isArray(parsed.items)
        ? parsed.items.filter((entry) => entry && typeof entry === 'object').map((entry) => {
            const item = entry as Record<string, unknown>;
            return {
              transportId: String(item.transportId || item.id || '').trim() || 'unknown',
              mode: (item.mode === 'native' || item.mode === 'remote' || item.mode === 'local' || item.mode === 'stub' ? item.mode : 'stub') as TransportMode,
              status: (item.status === 'passed' || item.status === 'failed' || item.status === 'running' || item.status === 'skipped' ? item.status : 'failed') as TransportDoctorItem['status'],
              configured: item.configured === true,
              summary: String(item.summary || '').trim(),
              error: String(item.error || '').trim() || null,
            };
          })
        : [];

      return {
        available: status !== 'missing',
        status,
        checkedAt,
        summary: String(parsed.summary || '').trim() || null,
        command: String(parsed.command || fallback.command).trim() || fallback.command,
        file: this.remoteTransportDoctorReportFile,
        stale,
        ageMs,
        maxAgeMs: this.remoteTransportDoctorMaxAgeMs,
        recommendedAction: status === 'passed' && !stale ? null : (String(parsed.command || fallback.command).trim() || fallback.command),
        items: items as TransportDoctorItem[],
      };
    } catch (error) { logger.warn('[Operations  Doctor Snapshot] parsing failed', error); return fallback; }
  }
}
