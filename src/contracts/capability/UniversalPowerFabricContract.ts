/**
 * Universal Power Fabric
 *
 * Elastic execution, trusted single-user operator posture, governed learning
 * promotion, external harness adapters, and context/cost discipline.
 * Brand-agnostic. Receipts remain mandatory for mutations.
 */

export const UNIVERSAL_POWER_FABRIC_CONTRACT_VERSION =
  'zavorth-universal-power-fabric/v1' as const;

export type PowerBackendId =
  | 'local'
  | 'docker'
  | 'ssh'
  | 'wsl'
  | 'vercel-sandbox'
  | 'modal'
  | 'daytona'
  | 'singularity';

export type PowerBackendPosture =
  | 'ready'
  | 'available-on-demand'
  | 'needs-configuration'
  | 'planned'
  | 'blocked';

export type PowerElasticProfileId =
  | 'local-supervised'
  | 'safe-8gb'
  | 'vps-24-7'
  | 'serverless-idle'
  | 'lab-full';

export type PowerBackendEntry = {
  id: PowerBackendId;
  label: string;
  posture: PowerBackendPosture;
  isolation: string;
  elastic: boolean;
  hibernateWhenIdle: boolean;
  liveCapable: boolean;
  liveReady: boolean;
  configured: boolean;
  requiresConfiguration: string[];
  defaultCommand: string;
  nextSafeAction: string;
  limitations: string[];
};

export type TrustedOperatorModeState = {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  note: string | null;
  /** Green/read-only and trusted-folder Velocity can auto-run with receipts */
  reduceGreenApprovals: true;
  /** Red lane / policy / security never auto */
  redLaneIntact: true;
  /** Receipts always required for mutations */
  receiptsAlways: true;
  autoApproveRiskCeiling: 'low' | 'medium';
  trustedFolderOnly: true;
};

export type LearningLaneId = 'green' | 'yellow' | 'red';

export type LearningPromoteKind = 'shadow-skill' | 'procedure' | 'preference';

export type LearningPromoteCandidate = {
  id: string;
  kind: LearningPromoteKind;
  lane: LearningLaneId;
  title: string;
  summary: string;
  evidenceRefs: string[];
  status: 'staged' | 'promoted' | 'denied' | 'expired';
  createdAt: string;
  promotedAt: string | null;
};

export type LearningPromoteReceipt = {
  id: string;
  kind: 'preview' | 'promote' | 'deny' | 'observe';
  candidateId: string | null;
  status: 'pass' | 'deny' | 'preview' | 'hold';
  summary: string;
  createdAt: string;
  rawSecretsSerialized: false;
};

export type ExternalHarnessKind =
  | 'cli-process'
  | 'acp-compatible'
  | 'http-session'
  | 'stdio-rpc'
  | 'unknown';

export type ExternalHarnessAdapter = {
  id: string;
  label: string;
  kind: ExternalHarnessKind;
  status: 'registered' | 'ready' | 'needs-configuration' | 'disabled';
  commandOrEndpoint: string | null;
  readOnlyDefault: true;
  mutationRequiresApproval: true;
  notes: string[];
};

export type ContextDisciplineSnapshot = {
  maxVisibleTools: number;
  maxSkillBytesInPrompt: number;
  progressiveSkillDisclosure: true;
  cacheStableSystemPrefix: true;
  estimatedToolSchemaBudgetTokens: number;
  estimatedSkillBudgetTokens: number;
  recommendations: string[];
};

export type PowerFabricReceipt = {
  id: string;
  kind:
    | 'inventory'
    | 'backend-plan'
    | 'trusted-mode'
    | 'learning-observe'
    | 'learning-promote'
    | 'harness-register'
    | 'context-discipline'
    | 'deny';
  status: 'pass' | 'deny' | 'preview' | 'hold';
  summary: string;
  subjectId: string | null;
  createdAt: string;
  rawSecretsSerialized: false;
};

export type PowerFabricPolicy = {
  liveMutationOffByDefault: true;
  elasticBackendsNeedConfigAndApproval: true;
  trustedModeDoesNotBypassRedLane: true;
  learningPromotionNeedsConsent: true;
  externalHarnessReadOnlyDefault: true;
  brandAgnostic: true;
  rawSecretsSerialized: false;
};

export type PowerFabricSnapshot = {
  contractVersion: typeof UNIVERSAL_POWER_FABRIC_CONTRACT_VERSION;
  generatedAt: string;
  status: 'ok' | 'attention' | 'blocked';
  backends: PowerBackendEntry[];
  elasticProfile: PowerElasticProfileId;
  trustedOperator: TrustedOperatorModeState;
  learning: {
    greenAutoPrefs: true;
    yellowCandidates: LearningPromoteCandidate[];
    redBlocked: true;
  };
  harnesses: ExternalHarnessAdapter[];
  context: ContextDisciplineSnapshot;
  receipts: PowerFabricReceipt[];
  summary: {
    backendsTotal: number;
    backendsReady: number;
    backendsElastic: number;
    yellowCandidates: number;
    harnessesReady: number;
    trustedOperatorEnabled: boolean;
  };
  policy: PowerFabricPolicy;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextSafeAction: string;
  };
};
