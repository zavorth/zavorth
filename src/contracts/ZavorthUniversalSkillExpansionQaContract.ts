import type { ZavorthUniversalSkillExpansionSnapshot } from './ZavorthUniversalSkillExpansionContract.js';

export const ZAVORTH_UNIVERSAL_SKILL_EXPANSION_QA_CONTRACT_VERSION =
  '2026-05-10.phase-7' as const;

export type ZavorthUniversalSkillExpansionQaStatus =
  | 'passed'
  | 'attention'
  | 'blocked';

export type ZavorthUniversalSkillExpansionQaSeverity =
  | 'info'
  | 'warning'
  | 'critical';

export type ZavorthUniversalSkillExpansionQaMatrixRow = {
  sourceLabel: string;
  sourcePath: string;
  presetId: string;
  status: string;
  candidates: number;
  allowed: number;
  denied: number;
  blockedCandidates: number;
  materialized: number;
  bridgeReady: number;
  receipts: number;
  severity: ZavorthUniversalSkillExpansionQaSeverity;
};

export type ZavorthUniversalSkillExpansionQaMetric = {
  id: string;
  label: string;
  value: number | string | boolean;
  unit: 'count' | 'ratio' | 'boolean' | 'text';
  severity: ZavorthUniversalSkillExpansionQaSeverity;
  target: string;
};

export type ZavorthUniversalSkillExpansionQaRolloutStage = {
  id: string;
  label: string;
  status: 'passed' | 'attention' | 'blocked' | 'waiting';
  summary: string;
  nextAction: string;
};

export type ZavorthUniversalSkillExpansionQaSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_EXPANSION_QA_CONTRACT_VERSION;
  status: ZavorthUniversalSkillExpansionQaStatus;
  projectRoot: string;
  channel: string;
  expansion: ZavorthUniversalSkillExpansionSnapshot;
  matrix: ZavorthUniversalSkillExpansionQaMatrixRow[];
  metrics: ZavorthUniversalSkillExpansionQaMetric[];
  rollout: {
    readyForOperatorUse: boolean;
    recommendedMode: 'preview-only' | 'limited-apply' | 'dry-run-rollout' | 'hold';
    stages: ZavorthUniversalSkillExpansionQaRolloutStage[];
    nextActions: string[];
  };
  certification: {
    passed: boolean;
    label: string;
    reasons: string[];
    gates: {
      noExecution: boolean;
      noDirectUpstreamRuntimeUse: boolean;
      previewFirst: boolean;
      denyByDefault: boolean;
      hostileBlocked: boolean;
      bridgeRegistryAvailable: boolean;
      reportPersisted: boolean;
    };
  };
  report: {
    persisted: boolean;
    path: string | null;
    rawSecretsSerialized: false;
  };
  policy: {
    qaDoesNotImportOutsideExpansionService: true;
    qaDoesNotExecuteSkills: true;
    qaUsesExpansionSnapshotAsEvidence: true;
    telemetryIsAggregateOnly: true;
    reportContainsNoRawSecrets: true;
    rolloutRequiresDryRunBeforeLive: true;
  };
  commands: {
    run: 'npm run zavorth:universal-skill-expansion-qa -- --source <path>';
    runJson: 'npm run zavorth:universal-skill-expansion-qa:json -- --source <path>';
    check: 'npm run zavorth:universal-skill-expansion-qa:check --silent';
    nextPhase: 'Phase 8 - Real Source Onboarding and Continuous Regression';
  };
};
