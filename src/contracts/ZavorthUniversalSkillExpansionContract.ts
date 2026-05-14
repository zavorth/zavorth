import type { ZavorthUniversalSkillImportSnapshot } from './ZavorthUniversalSkillImportContract.js';
import type { ZavorthUniversalSkillBridgeRegistrySnapshot } from './ZavorthUniversalSkillBridgeRegistryContract.js';

export const ZAVORTH_UNIVERSAL_SKILL_EXPANSION_CONTRACT_VERSION =
  '2026-05-10.phase-6' as const;

export type ZavorthUniversalSkillExpansionStatus =
  | 'preview-only'
  | 'passed'
  | 'partial'
  | 'blocked';

export type ZavorthUniversalSkillExpansionPresetId =
  | 'workspace-skill-library'
  | 'downloaded-skill-archive'
  | 'codex-skill-root'
  | 'agent-skill-root'
  | 'generic-skill-folder'
  | 'custom';

export type ZavorthUniversalSkillExpansionSourceInput = {
  sourcePath: string;
  sourceKind?: 'auto' | 'directory' | 'zip';
  sourceLabel?: string | null;
  sourceId?: string | null;
  presetId?: ZavorthUniversalSkillExpansionPresetId | null;
  allowSource?: boolean;
  allowAllCandidates?: boolean;
  allowedSkillNames?: string[];
  allowedSkillIds?: string[];
};

export type ZavorthUniversalSkillExpansionPreset = {
  id: ZavorthUniversalSkillExpansionPresetId;
  label: string;
  description: string;
  defaultSourceKind: 'auto' | 'directory' | 'zip';
  defaultTrust: 'review' | 'trusted-local' | 'blocked';
  recommendedUse: string;
  allowAllCandidatesByDefault: false;
  requiresExplicitApply: true;
  noExecutionPerformed: true;
};

export type ZavorthUniversalSkillExpansionSourceResult = {
  sourcePath: string;
  sourceLabel: string;
  sourceId: string | null;
  preset: ZavorthUniversalSkillExpansionPreset;
  status: ZavorthUniversalSkillExpansionStatus;
  importSnapshot: ZavorthUniversalSkillImportSnapshot;
  importedSkillNames: string[];
  deniedSkillNames: string[];
  blockedCandidateNames: string[];
  readyForBridgeNames: string[];
};

export type ZavorthUniversalSkillExpansionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_EXPANSION_CONTRACT_VERSION;
  status: ZavorthUniversalSkillExpansionStatus;
  apply: boolean;
  overwrite: boolean;
  projectRoot: string;
  targetRootPath: string;
  channel: string;
  presets: ZavorthUniversalSkillExpansionPreset[];
  summary: {
    sources: number;
    candidates: number;
    allowed: number;
    denied: number;
    blockedCandidates: number;
    materialized: number;
    filesWritten: number;
    receipts: number;
    bridgeReady: number;
    bridgeApprovalRequired: number;
    bridgeBlocked: number;
    activationActions: number;
    previewRequired: true;
    importPerformed: boolean;
    executionPerformed: false;
    directUpstreamRuntimeUse: false;
  };
  sourceResults: ZavorthUniversalSkillExpansionSourceResult[];
  bridgeRegistry: ZavorthUniversalSkillBridgeRegistrySnapshot;
  certification: {
    passed: boolean;
    label: string;
    reasons: string[];
    scaleLimits: {
      maxSources: number;
      maxCandidates: number;
    };
  };
  policy: {
    previewFirstForEverySource: true;
    denyByDefault: true;
    explicitSourceAllowlistRequiredForApply: true;
    explicitSkillAllowlistOrAllowAllRequiredForApply: true;
    hostileCandidatesStayBlocked: true;
    provenanceRequiredForMaterializedSkills: true;
    bridgeCertificationUsesRegistryOnly: true;
    activationDoesNotExecuteUpstreamCode: true;
    noExecutionPerformed: true;
    noDirectUpstreamRuntimeUse: true;
  };
  commands: {
    preview: 'npm run zavorth:universal-skill-expansion -- --source <path>';
    apply: 'npm run zavorth:universal-skill-expansion -- --source <path> --apply --allow-source --skills <name>';
    check: 'npm run zavorth:universal-skill-expansion:check --silent';
    nextPhase: 'Phase 7 - Expansion QA, Telemetry and Operator Rollout';
  };
};
