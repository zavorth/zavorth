import type {
  SkillImportAuditReference,
  SkillLicensePolicyDecision,
  SkillRiskAssessment,
} from '../skills/SkillCatalogContract.js';
import type {
  ZavorthUniversalSkillCandidate,
  ZavorthUniversalSkillIntakePreview,
} from './ZavorthUniversalSkillIntakeContract.js';

export const ZAVORTH_UNIVERSAL_SKILL_IMPORT_CONTRACT_VERSION = '2026-05-10.checkpoint-2' as const;

export type ZavorthUniversalSkillImportStatus = 'passed' | 'blocked' | 'preview-only' | 'partial';

export type ZavorthUniversalSkillImportDecisionMode =
  | 'allow'
  | 'deny'
  | 'skip-existing'
  | 'preview-only';

export type ZavorthUniversalSkillImportTrustPolicy = {
  sourceId: string;
  sourceLabel: string;
  allowedSourceIds: string[];
  allowedSkillIds: string[];
  allowedSkillNames: string[];
  allowAllCandidates: boolean;
  denyByDefault: true;
};

export type ZavorthUniversalSkillImportDecision = {
  candidateId: string;
  skillName: string;
  mode: ZavorthUniversalSkillImportDecisionMode;
  allowed: boolean;
  materialized: boolean;
  targetSkillDirPath: string;
  reason: string;
  sourceAllowed: boolean;
  skillAllowed: boolean;
  candidateBlocked: boolean;
  risk: SkillRiskAssessment;
  licensePolicy: SkillLicensePolicyDecision;
  audit: SkillImportAuditReference;
};

export type ZavorthUniversalSkillImportReceipt = {
  id: string;
  kind: 'preview' | 'import' | 'deny' | 'skip';
  candidateId: string;
  skillName: string;
  status: 'pass' | 'deny' | 'skip';
  targetSkillDirPath: string;
  sourceId: string;
  sourceLabel: string;
  contentHash: string;
  previewRequired: true;
  allowedBySource: boolean;
  allowedBySkill: boolean;
  noExecutionPerformed: true;
  noDirectUpstreamRuntimeUse: true;
  reason: string;
};

export type ZavorthUniversalSkillImportMaterializedFile = {
  candidateId: string;
  relativePath: string;
  targetPath: string;
  sha256: string;
  generated: boolean;
};

export type ZavorthUniversalSkillImportSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_IMPORT_CONTRACT_VERSION;
  status: ZavorthUniversalSkillImportStatus;
  apply: boolean;
  overwrite: boolean;
  targetRootPath: string;
  preview: ZavorthUniversalSkillIntakePreview;
  trustPolicy: ZavorthUniversalSkillImportTrustPolicy;
  summary: {
    candidates: number;
    allowed: number;
    denied: number;
    skippedExisting: number;
    materialized: number;
    receipts: number;
    filesWritten: number;
    previewRequired: true;
    importPerformed: boolean;
    executionPerformed: false;
    directUpstreamRuntimeUse: false;
  };
  decisions: ZavorthUniversalSkillImportDecision[];
  receipts: ZavorthUniversalSkillImportReceipt[];
  materializedFiles: ZavorthUniversalSkillImportMaterializedFile[];
  policy: {
    previewRequired: true;
    denyByDefault: true;
    sourceAllowlistRequired: true;
    skillAllowlistRequired: true;
    provenanceRequired: true;
    contentHashRequired: true;
    receiptsRequired: true;
    targetIsImportedLibrary: true;
    noExecutionPerformed: true;
    noDirectUpstreamRuntimeUse: true;
  };
  commands: {
    plan: 'npm run zavorth:universal-skill-import -- --source <path>';
    apply: 'npm run zavorth:universal-skill-import -- --source <path> --allow-source --skills <name> --apply';
    check: 'npm run zavorth:universal-skill-import:check --silent';
    nextStage: 'Approval gate - Skill Bridge Runtime';
  };
};

export type ZavorthUniversalSkillImportCandidateSource = ZavorthUniversalSkillCandidate;
