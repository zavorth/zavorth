import type { ArtifactPipelineService } from '../../services/ArtifactPipelineService.js';
import type { ZavorthMemoryPlaneService } from '../../services/ZavorthMemoryPlaneService.js';
import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';

type ArtifactsFacadeRuntime = {
  now?: () => Date;
  memoryPlaneService?: Pick<ZavorthMemoryPlaneService, 'buildSnapshotFast'>;
  artifactPipelineService?: Pick<ArtifactPipelineService, 'normalizeArtifacts' | 'buildManifest'>;
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
  private readonly memoryPlane: Pick<ZavorthMemoryPlaneService, 'buildSnapshotFast'> | null;
  private readonly artifactPipeline: Pick<ArtifactPipelineService, 'normalizeArtifacts' | 'buildManifest'> | null;
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
        summary: 'Artifacts facade registrada, aguardando injecao do memory plane e artifact pipeline.',
        details: [
          'Sem memory plane/artifact pipeline injetados, o dominio permanece leve.',
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
        ? `${manifest.total} artefato(s) recente(s), ${manifest.photos} preview(s) visual(is) e ${manifest.documents} documento(s).`
        : 'Nenhum artefato recente foi consolidado neste contexto ainda.',
      details: [
        `Package mode: ${manifest.package_mode}.`,
        `Primary artifact: ${manifest.primary_artifact_name || 'n/d'}.`,
        `Kinds: ${snapshot.artifacts.kinds.join(', ') || 'nenhum'}.`,
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
