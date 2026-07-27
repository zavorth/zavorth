import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import type { ArtifactPipelinePort, ArtifactsMemoryPlanePort } from './domain/ArtifactsDomainTypes.js';

type ArtifactsFacadeRuntime = {
  now?: () => Date;
  memoryPlaneService?: ArtifactsMemoryPlanePort;
  artifactPipelineService?: ArtifactPipelinePort;
  defaultUserId?: string | null;
  defaultPlatform?: string | null;
  defaultSessionId?: string | null;
  defaultChatId?: string | null;
};

export type ArtifactsDomainSnapshot = DomainSnapshot & {
  metrics: {
    total: number;
    reusable: number;
    localPaths: number;
    remoteUrls: number;
    missingLocalFiles: number;
  };
};

export class ArtifactsFacade extends DomainFacadeBase<ArtifactsDomainSnapshot> {
  private readonly memoryPlane: ArtifactsMemoryPlanePort | null;
  private readonly artifactPipeline: ArtifactPipelinePort | null;
  private readonly defaultUserId: string;
  private readonly defaultPlatform: string | null;
  private readonly defaultSessionId: string | null;
  private readonly defaultChatId: string | null;

  constructor(runtime: ArtifactsFacadeRuntime = {}) {
    super('artifacts', 'Artifacts', runtime.now);
    this.memoryPlane = runtime.memoryPlaneService || null;
    this.artifactPipeline = runtime.artifactPipelineService || null;
    this.defaultUserId = String(runtime.defaultUserId || 'gateway-core').trim() || 'gateway-core';
    this.defaultPlatform = String(runtime.defaultPlatform || 'web').trim() || 'web';
    this.defaultSessionId = String(runtime.defaultSessionId || 'gateway-core').trim() || null;
    this.defaultChatId = String(runtime.defaultChatId || 'web:gateway-core').trim() || null;
  }

  public buildSnapshot(): ArtifactsDomainSnapshot {
    if (!this.memoryPlane || !this.artifactPipeline) {
      return this.composeSnapshot({
        summary: 'Artifacts facade registrada, waiting for injection do memory plane e artifact pipeline.',
        details: [
          'Without injected memory plane/artifact pipeline, the domain remains lightweight.',
        ],
        metrics: {
          total: 0,
          reusable: 0,
          localPaths: 0,
          remoteUrls: 0,
          missingLocalFiles: 0,
        },
      }) as ArtifactsDomainSnapshot;
    }

    const snapshot = this.memoryPlane.buildSnapshotFast({
      userId: this.defaultUserId,
      platform: this.defaultPlatform,
      sessionId: this.defaultSessionId,
      chatId: this.defaultChatId,
    });
    const artifacts = this.artifactPipeline.normalizeArtifacts(snapshot.artifacts.recent || [], 'memory-plane');
    const manifest = this.artifactPipeline.buildManifest(artifacts, {
      traceId: this.defaultSessionId || this.defaultChatId || 'artifacts-domain',
      runId: this.defaultSessionId || this.defaultChatId || 'artifacts-domain',
      sessionId: this.defaultSessionId || this.defaultChatId,
      surface: this.defaultPlatform,
      source: 'artifacts-domain',
    });

    return this.composeSnapshot({
      summary: manifest.total > 0
        ? `${manifest.total} recent artifact(s), ${manifest.photos} visual preview(s) e ${manifest.documents} document(s).`
        : 'No recent artifact has been consolidated in this context yet.',
      details: [
        `Package mode: ${manifest.package_mode}.`,
        `Primary artifact: ${manifest.primary_artifact_name || 'n/d'}.`,
        `Kinds: ${snapshot.artifacts.kinds.join(', ') || 'none'}.`,
      ],
      metrics: {
        total: manifest.total,
        reusable: snapshot.artifacts.reusableCount,
        localPaths: manifest.local_paths.length,
        remoteUrls: manifest.remote_urls.length,
        missingLocalFiles: manifest.missing_local_files,
      },
    }) as ArtifactsDomainSnapshot;
  }
}
