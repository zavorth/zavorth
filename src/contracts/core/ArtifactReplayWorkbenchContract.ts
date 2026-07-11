export type ArtifactReplayWorkbenchCheckStatus = 'pass' | 'warn' | 'fail';
export type ArtifactReplayWorkbenchSource = 'package' | 'web' | 'control-plane' | 'policy' | 'workbench';

export type ArtifactReplayWorkbenchArtifactIndexEntry = {
  id: string;
  label: string;
  kind: string;
  workspace: string;
  source: string;
  sourceRunId: string | null;
  path: string | null;
  url: string | null;
  reusable: boolean;
  resumePrompt: string;
};

export type ArtifactReplayWorkbenchCompareEntry = {
  id: string;
  leftRunId: string | null;
  rightRunId: string | null;
  label: string;
  reason: string;
  ready: boolean;
};

export type ArtifactReplayWorkbenchLearningMark = {
  id: string;
  label: string;
  status: string;
  score: number;
  actionHint: string;
  evidenceRef: string | null;
};

export type ArtifactReplayWorkbenchEvidenceExport = {
  id: string;
  label: string;
  kind: 'artifact' | 'lifecycle' | 'learning';
  ref: string | null;
  payloadIncluded: false;
  redactionMode: 'references-only' | 'summary-only';
  reason: string;
};

export type ArtifactReplayWorkbenchCheck = {
  id: string;
  title: string;
  status: ArtifactReplayWorkbenchCheckStatus;
  source: ArtifactReplayWorkbenchSource;
  reason: string;
  evidence?: string[];
};

export type ArtifactReplayWorkbenchSnapshot = {
  gate: 'artifact-replay';
  surface: 'artifact-replay-workbench';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
    indexedArtifacts: number;
    reusableArtifacts: number;
    compareCandidates: number;
    learningMarks: number;
    evidenceExports: number;
    heavyRuntimesStarted: false;
  };
  workbench: {
    artifactIndex: ArtifactReplayWorkbenchArtifactIndexEntry[];
    compare: ArtifactReplayWorkbenchCompareEntry[];
    learningMarks: ArtifactReplayWorkbenchLearningMark[];
    evidenceExports: ArtifactReplayWorkbenchEvidenceExport[];
  };
  checks: ArtifactReplayWorkbenchCheck[];
  contracts: string[];
  commands: {
    inspect: string;
    json: string;
    gate: string;
    replayLearning: string;
  };
  nextRecommendedGate: {
    gate: 'release-ux-wizard';
    title: string;
    reason: string;
  };
};

export const ARTIFACT_REPLAY_WORKBENCH_PACKAGE_SCRIPTS = [
  'ops:replay-learning',
  'ops:replay-learning:json',
  'artifact:workbench',
  'qa:artifact-workbench',
  'qa:artifact-replay',
] as const;

export const ARTIFACT_REPLAY_WORKBENCH_WEB_MARKERS = [
  'id="artifact-replay-workbench-card"',
  'id="artifact-workbench-index"',
  'id="artifact-workbench-compare"',
  'id="artifact-workbench-redaction"',
  'id="artifact-workbench-learning"',
  'id="artifact-workbench-export"',
  'data-copy="npm run artifact:workbench"',
  'data-copy="npm run ops:replay-learning -- --export-profile"',
] as const;

export const ARTIFACT_REPLAY_WORKBENCH_REQUIRED_CARDS = [
  'replay',
  'artifacts',
  'lifecycle',
  'learning',
  'memory',
  'workspace',
] as const;

export const ARTIFACT_REPLAY_WORKBENCH_CONTRACTS = [
  'The workbench indexes artifacts by workspace/run/task without starting a persistent runtime.',
  'Run comparison must exist as a plan even in cold start.',
  'Replay learning remains preview-first, redacted, and revocable.',
  'Marking good sessions for learning becomes a learning mark, not auto-application.',
  'Evidence export uses references/summaries; raw payload and secrets do not enter the bundle.',
  'ZavorthControl must expose index, comparison, redaction, learning, and controlled export.',
];
