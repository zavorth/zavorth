export const ARTIFACT_DIFF_CONTRACT_VERSION = 'artifact-diff-v1' as const;
export const ARTIFACT_DIFF_CAPABILITY_ID = 'artifact.diff' as const;

export type ArtifactDiffSourceKind = 'workspace-path' | 'artifact-ref' | 'inline-text';

export type ArtifactDiffSource = {
  kind: ArtifactDiffSourceKind;
  ref: string;
  label?: string | null;
  contentType?: string | null;
  text?: string | null;
};

export type ArtifactDiffPolicyDecision = {
  allowed: boolean;
  reason: string;
  workspaceReadAllowed: boolean;
  artifactWriteAllowed: boolean;
  redacted: boolean;
};

export type ArtifactDiffRequest = {
  left: ArtifactDiffSource;
  right: ArtifactDiffSource;
  outputDir?: string | null;
  allowedRoots?: string[];
  sessionId?: string | null;
  correlationId?: string | null;
};

export type ArtifactDiffArtifact = {
  artifactId: string;
  contentType: 'text/x-diff';
  storageRef: string;
  bytes: number;
  hunks: number;
};

export type ArtifactDiffResult = {
  ok: boolean;
  contractVersion: typeof ARTIFACT_DIFF_CONTRACT_VERSION;
  artifact: ArtifactDiffArtifact | null;
  summary: {
    leftLabel: string;
    rightLabel: string;
    changedLines: number;
    hunks: number;
    emptyDiff: boolean;
  } | null;
  policyDecision: ArtifactDiffPolicyDecision;
  receiptId: string;
  processedAt: string;
  error: string | null;
};
