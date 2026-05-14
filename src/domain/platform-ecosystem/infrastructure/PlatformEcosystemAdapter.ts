import type {
  EcosystemControlPlanePort,
  PlatformEcosystemDomainPort,
  PlatformEcosystemDomainReadModel,
  PlatformEcosystemReadinessInput,
  PlatformRegistrySnapshotPort,
} from '../domain/PlatformEcosystemDomainTypes.js';

type PlatformEcosystemAdapterRuntime = {
  now?: () => Date;
  platformRegistryService?: PlatformRegistrySnapshotPort | null;
  ecosystemControlPlaneService?: EcosystemControlPlanePort | null;
  registryReady?: boolean | null;
  sdkSurfaces?: number | null;
  vendorBundles?: number | null;
};

export class PlatformEcosystemAdapter implements PlatformEcosystemDomainPort {
  private readonly now: () => Date;
  private readonly platformRegistryService: PlatformRegistrySnapshotPort | null;
  private readonly ecosystemControlPlaneService: EcosystemControlPlanePort | null;
  private readonly registryReadyHint: boolean | null;
  private readonly sdkSurfacesHint: number | null;
  private readonly vendorBundlesHint: number | null;

  constructor(runtime: PlatformEcosystemAdapterRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.platformRegistryService = runtime.platformRegistryService || null;
    this.ecosystemControlPlaneService = runtime.ecosystemControlPlaneService || null;
    this.registryReadyHint = runtime.registryReady === true ? true : null;
    this.sdkSurfacesHint = Number.isFinite(runtime.sdkSurfaces) ? Number(runtime.sdkSurfaces) : null;
    this.vendorBundlesHint = Number.isFinite(runtime.vendorBundles) ? Number(runtime.vendorBundles) : null;
  }

  public readPlatformState(input: PlatformEcosystemReadinessInput = {}): PlatformEcosystemDomainReadModel {
    const platformSnapshot = this.platformRegistryService?.buildSnapshot({
      selectedId: input.selectedId || null,
      query: input.query || null,
    }) || null;
    const ecosystemSnapshot = this.ecosystemControlPlaneService?.buildSnapshot({
      selectedId: input.selectedId || null,
      query: input.query || null,
    }) || null;
    const registryReady = this.registryReadyHint ?? Boolean(platformSnapshot || ecosystemSnapshot);
    const sdkSurfaces = (
      this.sdkSurfacesHint
      ?? Number(ecosystemSnapshot?.summary?.sdkFilesReady ?? platformSnapshot?.summary?.ready ?? 0)
    ) || 0;
    const vendorBundles = (
      this.vendorBundlesHint
      ?? Number(
        (platformSnapshot?.summary?.collections || 0)
        + (platformSnapshot?.summary?.recipes || 0),
      )
    ) || 0;
    const hasSignals = registryReady || sdkSurfaces > 0 || vendorBundles > 0;

    return {
      generatedAt: this.now().toISOString(),
      registryReady,
      sdkSurfaces,
      vendorBundles,
      headline: hasSignals
        ? 'Platform ecosystem domain ja agrega registry, SDKs e readiness do ecossistema.'
        : 'Platform ecosystem domain aguardando registry e control plane canonicos.',
      operatorSummary:
        ecosystemSnapshot?.narrative?.operatorSummary
        || platformSnapshot?.narrative?.operatorSummary
        || (hasSignals
          ? `Platform ecosystem domain pronto com ${sdkSurfaces} surface(s) de SDK e ${vendorBundles} bundle(s) catalogado(s).`
          : 'Platform ecosystem domain seeded para concentrar registry, SDKs e vendors.'),
      details: [
        ecosystemSnapshot?.narrative?.headline || 'Ecosystem control plane ainda nao publicou headline neste contexto.',
        platformSnapshot?.narrative?.headline || 'Platform registry ainda nao publicou headline neste contexto.',
        `Registry ready: ${registryReady ? 'yes' : 'no'}.`,
        `SDK surfaces: ${sdkSurfaces}.`,
        `Vendor bundles: ${vendorBundles}.`,
      ],
      source: hasSignals ? 'ecosystem' : 'seed',
    };
  }
}
