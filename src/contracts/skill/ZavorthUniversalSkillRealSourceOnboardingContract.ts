import type { ZavorthUniversalSkillExpansionPresetId } from './ZavorthUniversalSkillExpansionContract.js';
import type {
  ZavorthUniversalSkillExpansionQaSeverity,
  ZavorthUniversalSkillExpansionQaSnapshot,
  ZavorthUniversalSkillExpansionQaStatus,
} from './ZavorthUniversalSkillExpansionQaContract.js';

export const ZAVORTH_UNIVERSAL_SKILL_REAL_SOURCE_ONBOARDING_CONTRACT_VERSION =
  '2026-05-10.gate-8' as const;

export type ZavorthUniversalSkillRealSourceOnboardingStatus =
  ZavorthUniversalSkillExpansionQaStatus;

export type ZavorthUniversalSkillRealSourceOnboardingSourceOrigin =
  | 'explicit'
  | 'environment'
  | 'workspace-discovery';

export type ZavorthUniversalSkillRealSourceCandidate = {
  id: string;
  label: string;
  sourcePath: string;
  sourceKind: 'auto' | 'directory' | 'zip';
  presetId: ZavorthUniversalSkillExpansionPresetId;
  origin: ZavorthUniversalSkillRealSourceOnboardingSourceOrigin;
  exists: boolean;
  selected: boolean;
  includedInQa: boolean;
  reason: string;
};

export type ZavorthUniversalSkillRealSourceHistoryEntry = {
  runId: string;
  generatedAt: string;
  status: ZavorthUniversalSkillRealSourceOnboardingStatus;
  qaStatus: ZavorthUniversalSkillExpansionQaStatus;
  candidateSourceCount: number;
  selectedSourceCount: number;
  includedSourceCount: number;
  candidates: number;
  materialized: number;
  bridgeReady: number;
  blockedCandidates: number;
  denied: number;
  recommendedMode: string;
};

export type ZavorthUniversalSkillRealSourceRegressionFinding = {
  id: string;
  severity: ZavorthUniversalSkillExpansionQaSeverity;
  metric: string;
  previous: number | string | boolean | null;
  current: number | string | boolean | null;
  summary: string;
};

export type ZavorthUniversalSkillRealSourceOnboardingSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_REAL_SOURCE_ONBOARDING_CONTRACT_VERSION;
  status: ZavorthUniversalSkillRealSourceOnboardingStatus;
  runId: string;
  projectRoot: string;
  channel: string;
  mode: 'preview-only' | 'apply-requested';
  sources: {
    discoverWorkspaceSources: boolean;
    environmentVariable: 'ZAVORTH_SKILL_SOURCE_PATHS';
    summary: {
      candidates: number;
      selected: number;
      includedInQa: number;
      missingSelected: number;
    };
    candidates: ZavorthUniversalSkillRealSourceCandidate[];
  };
  qa: ZavorthUniversalSkillExpansionQaSnapshot;
  history: {
    persisted: boolean;
    path: string | null;
    maxEntries: number;
    previousEntry: ZavorthUniversalSkillRealSourceHistoryEntry | null;
    currentEntry: ZavorthUniversalSkillRealSourceHistoryEntry;
    entries: ZavorthUniversalSkillRealSourceHistoryEntry[];
  };
  regression: {
    status: ZavorthUniversalSkillRealSourceOnboardingStatus;
    baselineAvailable: boolean;
    findings: ZavorthUniversalSkillRealSourceRegressionFinding[];
  };
  rollout: {
    readyForContinuousUse: boolean;
    recommendedCadence: 'manual-before-import' | 'daily' | 'per-source-change' | 'hold';
    nextActions: string[];
  };
  policy: {
    defaultPreviewOnly: true;
    realSourcesRequireExplicitApply: true;
    sourceDiscoveryIsWorkspaceBounded: true;
    environmentSourcesAreOperatorDeclared: true;
    regressionDoesNotImportOutsideQa: true;
    historyContainsAggregateOnly: true;
    noExecutionPerformed: true;
    noDirectUpstreamRuntimeUse: true;
    noRawSecretsSerialized: true;
  };
  commands: {
    run: 'npm run zavorth:universal-skill-real-source-onboarding -- --discover';
    runJson: 'npm run zavorth:universal-skill-real-source-onboarding:json -- --discover';
    check: 'npm run zavorth:universal-skill-real-source-onboarding:check --silent';
    nextAction: 'Certification matrix - Real Library Scale Hardening and ZavorthControl Review';
  };
};
