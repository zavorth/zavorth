import type { SelfmodOptimizationAnalysis } from '../../contracts/SelfmodOptimizationContract.js';
import type { ExecutionLifecycleRecord } from '../../contracts/ExecutionLifecycleContract.js';

export type SelfmodResourceImpact = {
 ramIdleMb: number;
 diskMb: number;
 processCount: number;
 notes?: string;
};

export type FilePreviewArtifact = {
 kind: 'file';
 previewId: string;
 absolutePath: string;
 relativePath: string;
 instruction: string;
 summary: string;
 generatedContent: string;
 originalHash: string;
 originalExists: boolean;
 createdAt: string;
 requestedBy: string;
};

export type GoalPreviewChange = {
 relativePath: string;
 absolutePath: string;
 instruction: string;
 summary: string;
 generatedContent: string;
 currentContent: string;
 originalHash: string;
 originalExists: boolean;
 diffSummary?: string;
 validationOutput?: string;
};

export type SelfmodValidationReport = {
 filePath: string;
 passes: boolean;
 output: string;
};

export type ChangeSetManifest = {
 kind: 'goal' | 'multi';
 previewId: string;
 goal: string;
 summary: string;
 createdAt: string;
 requestedBy: string;
 resourceImpact: SelfmodResourceImpact;
 validationPlan: string[];
 /** Optional shell checks required before apply. */
 validationCommands?: string[];
 requireValidationCommandsOnApply?: boolean;
 shadowWorkspaceDir: string;
 changes: GoalPreviewChange[];
 validations: SelfmodValidationReport[];
 optimizationAnalysis?: SelfmodOptimizationAnalysis;
 /** Atomic rollback plan: reverse-order restore of previous contents. */
 rollbackPlan?: Array<{ relativePath: string; originalExists: boolean }>;
};

export type PreviewArtifact = FilePreviewArtifact | ChangeSetManifest;

export type AppliedChangeRecord = {
 relativePath: string;
 absolutePath: string;
 previousContent: string;
 nextContent: string;
 originalHash: string;
 originalExists: boolean;
 diffSummary?: string;
};

export type AppliedChangeSetRecord = {
 changeId: string;
 previewId: string;
 goal: string;
 summary: string;
 requestedBy: string;
 appliedAt: string;
 changes: AppliedChangeRecord[];
 optimizationAnalysis?: SelfmodOptimizationAnalysis;
};

export type StagedValidationChange = {
 absolutePath: string;
 previousContent: string;
 nextContent: string;
 originalExists: boolean;
};

export type GoalPlannerResponse = {
 summary?: string;
 validationPlan?: string[];
 resourceImpact?: {
 ramIdleMb?: number;
 diskMb?: number;
 processCount?: number;
 notes?: string;
 };
 changes?: Array<{
 filePath?: string;
 instruction?: string;
 }>;
};

export type GoalPlannerChange = {
 filePath: string;
 instruction: string;
};

export type GoalPlannerResult = {
 summary: string;
 validationPlan: string[];
 resourceImpact: SelfmodResourceImpact;
 changes: GoalPlannerChange[];
};

export type SelfModificationPreviewResult = {
 success: boolean;
 traceId?: string | null;
 runId?: string | null;
 sessionId?: string | null;
 approvalId?: string | null;
 artifactId?: string | null;
 execution_lifecycle?: ExecutionLifecycleRecord[];
 mode: 'file' | 'goal' | 'multi';
 previewId?: string;
 relativePath?: string;
 summary: string;
 diffSummary?: string;
 validationOutput?: string;
 changeCount?: number;
 validationPlan?: string[];
 resourceImpact?: string;
 optimizationAnalysis?: SelfmodOptimizationAnalysis;
 /** Paths included in multi-file preview. */
 relativePaths?: string[];
 rollbackPlan?: Array<{ relativePath: string; originalExists: boolean }>;
};

export type SelfModificationApplyResult = {
 success: boolean;
 traceId?: string | null;
 runId?: string | null;
 sessionId?: string | null;
 approvalId?: string | null;
 artifactId?: string | null;
 execution_lifecycle?: ExecutionLifecycleRecord[];
 mode: 'file' | 'goal' | 'multi';
 previewId: string;
 relativePath?: string;
 summary: string;
 diffSummary?: string;
 changeId?: string;
 changeCount?: number;
 /** promote offer when applied paths look like skill packs. */
 promoteHint?: string | null;
 receiptPath?: string | null;
 validationReports?: SelfmodValidationReport[];
};

/** Explicit multi-file / multi-hunk preview input. */
export type MultiFilePreviewInput = {
 files: Array<{
 relativePath: string;
 /** Full file content after change (hunk replaced client-side into full file). */
 content: string;
 instruction?: string;
 }>;
 summary?: string;
 requestedBy: string;
 validationCommands?: string[];
 requireValidationCommandsOnApply?: boolean;
 /** Auth context for core path policy. */
 buildMode?: boolean;
 ownerOrTrusted?: boolean;
};

export type SelfModificationRollbackResult = {
 success: boolean;
 traceId?: string | null;
 runId?: string | null;
 sessionId?: string | null;
 approvalId?: string | null;
 artifactId?: string | null;
 execution_lifecycle?: ExecutionLifecycleRecord[];
 changeId: string;
 summary: string;
 restoredFiles: number;
};

export const PREVIEW_TTL_MS = 60 * 60 * 1000;

export const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.ps1']);

/** @deprecated Prefer SelfModificationPathPolicyService — kept for soft compatibility. */
export const ALLOWED_TOP_LEVEL_DIRS = new Set(['src', 'tests', 'config', 'scripts', 'skills', 'plugins', 'docs']);

export const LAUNCHER_TOUCH_PATTERNS = [
 /^scripts\/launch-zavorth/i,
 /^scripts\/install-windows-startup\.ps1$/i,
 /^src\/index\.ts$/i,
 /^src\/services\/(Omni|ZavorthBridge|ZavorthAIGateway)/i,
];
