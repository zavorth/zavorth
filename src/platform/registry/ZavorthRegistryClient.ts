import {
  ZavorthPlatformCatalogSourceService,
  type ZavorthPlatformCatalogEntry,
} from '../../services/ZavorthPlatformCatalogSourceService.js';
import {
  ZavorthPlatformActionService,
  type ZavorthPlatformActionExecution,
} from '../../services/ZavorthPlatformActionService.js';
import {
  DefaultTrustPolicy,
  type ZavorthTrustPolicy,
} from '../trust/ZavorthTrustPolicy.js';

export interface RegistryPackageMetadata {
  id: string;
  name: string;
  kind: 'plugin' | 'skill' | 'mcp';
  version: string;
  signature: string;
  tarballUrl: string;
  publisherId: string;
  sourceTrusted: boolean;
  summary: string;
  provenance: {
    sourceUrl: string;
    commitHash?: string;
    verifiedAt: string;
  };
}

type ZavorthRegistryClientRuntime = {
  trustPolicy?: ZavorthTrustPolicy;
  catalogSourceService?: Pick<ZavorthPlatformCatalogSourceService, 'listEntries' | 'readSyncStatus'>;
  platformActionService?: Pick<ZavorthPlatformActionService, 'execute'>;
};

export class ZavorthRegistryClient {
  private readonly trustPolicy: ZavorthTrustPolicy;
  private readonly catalogSource: Pick<ZavorthPlatformCatalogSourceService, 'listEntries' | 'readSyncStatus'>;
  private readonly platformActions: Pick<ZavorthPlatformActionService, 'execute'>;

  constructor(runtime: ZavorthTrustPolicy | ZavorthRegistryClientRuntime = {}) {
    if (this.looksLikeTrustPolicy(runtime)) {
      this.trustPolicy = runtime;
      this.catalogSource = new ZavorthPlatformCatalogSourceService();
      this.platformActions = new ZavorthPlatformActionService();
      return;
    }

    this.trustPolicy = runtime.trustPolicy || new DefaultTrustPolicy();
    this.catalogSource = runtime.catalogSourceService || new ZavorthPlatformCatalogSourceService();
    this.platformActions = runtime.platformActionService || new ZavorthPlatformActionService();
  }

  public async fetchPackageInfo(packageId: string): Promise<RegistryPackageMetadata> {
    const entry = this.resolveEntry(packageId);
    if (!entry) {
      throw new Error(`Pacote nao encontrado no registry Zavorth: ${packageId}.`);
    }

    const sync = this.catalogSource.readSyncStatus();
    const version = entry.source.includes('remote-catalog') && sync.contentSha256
      ? `registry-${sync.contentSha256.slice(0, 12)}`
      : 'catalog-local';
    const signature = this.trustPolicy.buildExpectedSignature?.(entry.id, version)
      || `sha256:${this.normalizeValue(entry.id)}:${version}`;
    const provenance = await this.trustPolicy.getProvenance(entry.id);
    const remoteTarballUrl = sync.remoteUrl
      ? `${String(sync.remoteUrl).replace(/\/+$/, '')}/packages/${encodeURIComponent(entry.id)}.tgz`
      : null;

    return {
      id: entry.id,
      name: this.readHumanName(entry.id),
      kind: entry.kind,
      version,
      signature,
      tarballUrl: remoteTarballUrl || `zavorth://catalog/${encodeURIComponent(entry.id)}`,
      publisherId: entry.source.includes('remote-catalog') ? 'registry:zavorth' : '@zavorth-official',
      sourceTrusted: entry.source.includes('remote-catalog')
        ? sync.status === 'ready' && sync.sourceTrusted === true && !sync.stale && !sync.error
        : true,
      summary: entry.summary,
      provenance,
    };
  }

  public async install(packageId: string): Promise<boolean> {
    const info = await this.fetchPackageInfo(packageId);
    const publisherTrusted = await this.trustPolicy.isPublisherTrusted(info.publisherId);
    const signatureTrusted = await this.trustPolicy.validateSignature(info.id, info.version, info.signature);
    if (!publisherTrusted || !signatureTrusted || !info.sourceTrusted) {
      throw new Error(`Pacote bloqueado pela trust policy: ${info.id}.`);
    }

    const result = await this.platformActions.execute({
      entryId: info.id,
      actionId: 'install',
      requestedBy: 'registry-client',
    });
    return result.ok;
  }

  public async installDetailed(packageId: string): Promise<ZavorthPlatformActionExecution> {
    const info = await this.fetchPackageInfo(packageId);
    const publisherTrusted = await this.trustPolicy.isPublisherTrusted(info.publisherId);
    const signatureTrusted = await this.trustPolicy.validateSignature(info.id, info.version, info.signature);
    if (!publisherTrusted || !signatureTrusted || !info.sourceTrusted) {
      throw new Error(`Pacote bloqueado pela trust policy: ${info.id}.`);
    }

    return this.platformActions.execute({
      entryId: info.id,
      actionId: 'install',
      requestedBy: 'registry-client',
    });
  }

  private resolveEntry(packageId: string): ZavorthPlatformCatalogEntry | null {
    const normalized = this.normalizeValue(packageId);
    const candidates = [
      normalized,
      `plugin:${normalized}`,
      `skill:${normalized}`,
      `mcp:${normalized}`,
    ];
    return this.catalogSource
      .listEntries()
      .find((entry) => candidates.includes(this.normalizeValue(entry.id)))
      || null;
  }

  private readHumanName(packageId: string): string {
    const normalized = String(packageId || '').split(':').pop() || packageId;
    return normalized.replace(/^@/, '').split('/').pop() || normalized;
  }

  private looksLikeTrustPolicy(value: unknown): value is ZavorthTrustPolicy {
    return Boolean(
      value
      && typeof value === 'object'
      && typeof (value as ZavorthTrustPolicy).validateSignature === 'function'
      && typeof (value as ZavorthTrustPolicy).isPublisherTrusted === 'function',
    );
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }
}
