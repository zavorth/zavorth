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
  phase: '43';
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
  nextRecommendedPhase: {
    phase: '44';
    title: string;
    reason: string;
  };
};

export const ARTIFACT_REPLAY_WORKBENCH_PACKAGE_SCRIPTS = [
  'ops:replay-learning',
  'ops:replay-learning:json',
  'artifact:workbench',
  'qa:artifact-workbench',
  'qa:phase:43',
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
  'A bancada indexa artifacts por workspace/run/task sem iniciar runtime persistente.',
  'Comparacao entre runs deve existir como plano mesmo em cold start.',
  'Replay learning permanece preview-first, redigido e revogavel.',
  'Marcacao de sessoes boas para aprendizado vira learning mark, nao auto-aplicacao.',
  'Export de evidencia usa referencias/resumos; payload bruto e secrets nao entram no bundle.',
  'A Dashboard deve expor indice, comparacao, redaction, learning e export controlado.',
];
