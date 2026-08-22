import type { MemoryStatusInput } from '../../memory/domain/MemoryDomainTypes.js';

export type ArtifactsMemoryPlanePort = {
  buildSnapshotFast: (input: MemoryStatusInput) => {
    artifacts: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recent?: any[];
      kinds: string[];
      reusableCount: number;
    };
  };
};

export type ArtifactManifestPort = {
  total: number;
  photos: number;
  documents: number;
  package_mode: string;
  primary_artifact_name?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  local_paths: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remote_urls: any[];
  missing_local_files: number;
};

export type ArtifactPipelinePort = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalizeArtifacts: (artifacts: any[], source: string) => any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildManifest: (artifacts: any[], context: {
    traceId: string;
    runId: string;
    sessionId?: string | null;
    surface?: string | null;
    source: string;
  }) => ArtifactManifestPort;
};
