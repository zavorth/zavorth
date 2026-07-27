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
      headline: hasSignals ? 'Platform ecosystem domain already aggregates registry, SDKs and ecosystem readiness.'
        : 'Platform ecosystem domain waiting for canonical registry and control plane.',
      operatorSummary:
        ecosystemSnapshot?.narrative?.operatorSummary
        || platformSnapshot?.narrative?.operatorSummary
        || (hasSignals ? `Platform ecosystem domain ready with ${sdkSurfaces} SDK surface(s) and ${vendorBundles} cataloged bundle(s).`
          : 'Platform ecosystem domain seeded to centralize registry, SDKs and vendors.'),
      details: [
        ecosystemSnapshot?.narrative?.headline || 'Ecosystem control plane has not yet published a headline in this context.',
        platformSnapshot?.narrative?.headline || 'Platform registry has not yet published a headline in this context.',
        `Registry ready: ${registryReady ? 'yes' : 'no'}.`,
        `SDK surfaces: ${sdkSurfaces}.`,
        `Vendor bundles: ${vendorBundles}.`,
      ],
      source: hasSignals ? 'ecosystem' : 'seed',
    };
  }
}
