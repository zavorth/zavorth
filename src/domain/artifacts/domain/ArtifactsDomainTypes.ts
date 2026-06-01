import type { MemoryStatusInput } from '../../memory/domain/MemoryDomainTypes.js';

export type ArtifactsMemoryPlanePort = {
  buildSnapshotFast: (input: MemoryStatusInput) => {
    artifacts: {
      recent?: unknown[];
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
  local_paths: unknown[];
  remote_urls: unknown[];
  missing_local_files: number;
};

export type ArtifactPipelinePort = {
  normalizeArtifacts: (artifacts: any[], source: string) => any[];
  buildManifest: (artifacts: any[], context: {
    traceId: string;
    runId: string;
    sessionId?: string | null;
    surface?: string | null;
    source: string;
  }) => ArtifactManifestPort;
};
