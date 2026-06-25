import type {
  ZavorthLargeSkillAbsorptionBatch,
  ZavorthLargeSkillAbsorptionSnapshot,
  ZavorthLargeSkillAbsorptionSourceInput,
} from './ZavorthLargeSkillAbsorptionContract.js';
import type { ZavorthUniversalSkillBridgeSnapshot } from './ZavorthUniversalSkillBridgeRuntimeContract.js';
import type {
  ZavorthUniversalSkillImportDecision,
  ZavorthUniversalSkillImportMaterializedFile,
  ZavorthUniversalSkillImportSnapshot,
} from './ZavorthUniversalSkillImportContract.js';
import type { ZavorthInvocationReceipt } from './ZavorthInvocationReceiptContract.js';

export const ZAVORTH_SKILL_ABSORPTION_MATERIALIZATION_CONTRACT_VERSION =
  '2026-05-10.skill-absorption-materialization-checkpoint-6' as const;

export type ZavorthSkillAbsorptionMaterializationStatus =
  | 'preview-only'
  | 'materialized'
  | 'partial'
  | 'approval-required'
  | 'blocked';

export type ZavorthSkillAbsorptionMaterializationInput = {
  sources: ZavorthLargeSkillAbsorptionSourceInput[];
  projectRoot?: string | null;
  targetRootPath?: string | null;
  apply?: boolean | null;
  overwrite?: boolean | null;
  approvalId?: string | null;
  allowedSourceIds?: string[] | null;
  allowedSkillNames?: string[] | null;
  allowAllSkills?: boolean | null;
  batchIds?: string[] | null;
  includeReviewRequiredBatches?: boolean | null;
  bridgeDryRun?: boolean | null;
  maxSources?: number | null;
  maxCandidates?: number | null;
  maxCandidatesPerBatch?: number | null;
  maxPromptCharsPerChunk?: number | null;
};

export type ZavorthSkillAbsorptionMaterializationBatchDecision = {
  batchId: string;
  status: 'selected' | 'skipped' | 'quarantined' | 'blocked';
  sourceIds: string[];
  skillNames: string[];
  reasons: string[];
  originalBatch: ZavorthLargeSkillAbsorptionBatch;
};

export type ZavorthSkillAbsorptionMaterializationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SKILL_ABSORPTION_MATERIALIZATION_CONTRACT_VERSION;
  source: 'ZavorthSkillAbsorptionMaterializationService';
  status: ZavorthSkillAbsorptionMaterializationStatus;
  apply: boolean;
  approvalId: string | null;
  targetRootPath: string;
  absorption: ZavorthLargeSkillAbsorptionSnapshot;
  selectedBatches: ZavorthSkillAbsorptionMaterializationBatchDecision[];
  importSnapshots: ZavorthUniversalSkillImportSnapshot[];
  importDecisions: ZavorthUniversalSkillImportDecision[];
  materializedFiles: ZavorthUniversalSkillImportMaterializedFile[];
  bridgeHandoffs: ZavorthUniversalSkillBridgeSnapshot[];
  receipts: ZavorthInvocationReceipt[];
  summary: {
    sources: number;
    batchesSelected: number;
    skillsSelected: number;
    importsAttempted: number;
    skillsMaterialized: number;
    filesWritten: number;
    bridgeHandoffs: number;
    quarantinedBatches: number;
    deniedDecisions: number;
    rollbackAvailable: boolean;
    workspaceMutationPerformed: boolean;
    externalIoPerformed: false;
    upstreamRuntimeCodeExecuted: false;
  };
  policy: {
    previewRequiredBeforeApply: true;
    approvalRequiredBeforeMaterialization: true;
    sourceAllowlistRequired: true;
    skillAllowlistRequired: true;
    importedSkillsAreInstructionsOnly: true;
    supportFilesAreNotExecutableTools: true;
    bridgeHandoffIsDryRunByDefault: true;
    rollbackReceiptRequired: true;
  };
  rollback: {
    available: boolean;
    command: string | null;
    affectedPaths: string[];
  };
  commands: {
    preview: 'npm run zavorth:skill-absorption-materialize -- --source <path>';
    apply: 'npm run zavorth:skill-absorption-materialize -- --source <path> --apply --approval-id <approval-id> --allow-source --skills <name>';
    check: 'npm run zavorth:skill-absorption-materialize:check --silent';
    nextStage: 'Surface controls - Natural Cross-Surface Commands';
  };
};

