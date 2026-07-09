import { config } from '../config/index.js';
import { RuntimeAccessManifestService } from '../runtime/access/RuntimeAccessManifestService.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';
import { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import { ZavorthRemoteTransportService } from './ZavorthRemoteTransportService.js';
import { ZavorthDistributedRuntimeSnapshotBuilder } from './distributed-runtime/ZavorthDistributedRuntimeSnapshotBuilder.js';
import { logger } from '../logger.js';
import type {
AsyncSnapshotLike,
  ZavorthDistributedRuntimeSnapshot,
  DistributedRuntimeDeps,
  RuntimeAccessManifestLike,
} from './distributed-runtime/ZavorthDistributedRuntimeTypes.js';

export type {
  AsyncSnapshotLike,
  ZavorthDistributedRuntimeActionSeverity,
  ZavorthDistributedRuntimeCapabilityCoverage,
  ZavorthDistributedRuntimeCard,
  ZavorthDistributedRuntimeFocus,
  ZavorthDistributedRuntimePosture,
  ZavorthDistributedRuntimeSnapshot,
  ZavorthDistributedRuntimeSurfaceEntry,
  DistributedRuntimeDeps,
  RuntimeAccessManifestLike,
} from './distributed-runtime/ZavorthDistributedRuntimeTypes.js';

export class ZavorthDistributedRuntimeControlPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly channels: Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
  private readonly nodes: Pick<ZavorthNodeMeshService, 'buildSnapshot'>;
  private readonly transports: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
  private readonly accessManifest: RuntimeAccessManifestLike;
  private readonly snapshotBuilder: ZavorthDistributedRuntimeSnapshotBuilder;

  constructor(runtime: DistributedRuntimeDeps = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = this.text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.channels = runtime.channelMeshService || new ZavorthChannelMeshService();
    this.nodes = runtime.nodeMeshService || new ZavorthNodeMeshService();
    this.transports =
      runtime.remoteTransportService
      || new ZavorthRemoteTransportService({
        nodeMeshService: this.nodes,
      });
    this.accessManifest =
      runtime.runtimeAccessManifestService
      || new RuntimeAccessManifestService();
    this.snapshotBuilder = new ZavorthDistributedRuntimeSnapshotBuilder({
      now: this.now,
      workspaceRoot: this.workspaceRoot,
    });
  }

  public async buildSnapshot(input: {
    selectedId?: string | null;
    query?: string | null;
  } = {}): Promise<ZavorthDistributedRuntimeSnapshot> {
    const selectedId = this.nullableText(input.selectedId);
    const query = this.nullableText(input.query);
    const focusId = selectedId || query;
    const [channels, nodes, transports, manifest] = await Promise.all([
      this.safeAsync(() => this.channels.buildSnapshot({
        selectedId: focusId,
      }), { entries: [], summary: {} }) as Promise<any>,
      this.safeAsync(() => this.nodes.buildSnapshot({
        selectedNodeId: focusId,
      }), { entries: [], summary: {}, capabilityCatalog: [] }) as Promise<any>,
      this.safeAsync(() => this.transports.buildSnapshot({
        selectedId: focusId,
      }), { entries: [], summary: {}, suggestedActions: [] }) as Promise<any>,
      this.safeAsync(() => this.accessManifest.buildManifest(), this.snapshotBuilder.buildFallbackManifest()),
    ]);

    return this.snapshotBuilder.composeSnapshot({
      selectedId,
      query,
      channels,
      nodes,
      transports,
      manifest,
    });
  }

  public async renderReport(input: {
    selectedId?: string | null;
    query?: string | null;
  } = {}): Promise<string> {
    const snapshot = await this.buildSnapshot(input);
    return this.snapshotBuilder.renderReport(snapshot);
  }

  private text(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private async safeAsync<T>(factory: () => Promise<T> | T, fallback: any): Promise<T> {
    try {
      return await factory() as T;
    } catch (error: any) { logger.warn('[Zavorth Distributed Runtime Control Plane] string operation failed', error); return fallback as T; }
  }
}

