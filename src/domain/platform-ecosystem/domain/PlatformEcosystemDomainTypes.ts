export type PlatformRegistrySnapshotPort = {
  buildSnapshot: (input?: { selectedId?: string | null; query?: string | null }) => {
    generatedAt: string;
    summary: {
      total: number;
      ready: number;
      collections: number;
      recipes: number;
      reviewPending: number;
    };
    narrative: {
      headline: string;
      operatorSummary: string;
    };
  };
};

export type EcosystemControlPlanePort = {
  buildSnapshot: (input?: { selectedId?: string | null; query?: string | null }) => {
    generatedAt: string;
    summary: {
      registryEntries: number;
      readyEntries: number;
      sdkFilesReady: number;
      sdkFilesExpected: number;
      publishArtifacts: number;
      recipeCoverageMissing: number;
    };
    narrative: {
      headline: string;
      operatorSummary: string;
    };
  };
};

export type PlatformEcosystemReadinessInput = {
  selectedId?: string | null;
  query?: string | null;
};

export type PlatformEcosystemDomainPort = {
  readPlatformState(input?: PlatformEcosystemReadinessInput): PlatformEcosystemDomainReadModel;
};

export type PlatformEcosystemDomainReadModel = {
  generatedAt: string;
  registryReady: boolean;
  sdkSurfaces: number;
  vendorBundles: number;
  headline: string;
  operatorSummary: string;
  details: string[];
  source: 'ecosystem' | 'seed';
};
