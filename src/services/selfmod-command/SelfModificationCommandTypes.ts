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
  kind: 'goal';
  previewId: string;
  goal: string;
  summary: string;
  createdAt: string;
  requestedBy: string;
  resourceImpact: SelfmodResourceImpact;
  validationPlan: string[];
  shadowWorkspaceDir: string;
  changes: GoalPreviewChange[];
  validations: SelfmodValidationReport[];
  optimizationAnalysis?: SelfmodOptimizationAnalysis;
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
  mode: 'file' | 'goal';
  previewId?: string;
  relativePath?: string;
  summary: string;
  diffSummary?: string;
  validationOutput?: string;
  changeCount?: number;
  validationPlan?: string[];
  resourceImpact?: string;
  optimizationAnalysis?: SelfmodOptimizationAnalysis;
};

export type SelfModificationApplyResult = {
  success: boolean;
  traceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  approvalId?: string | null;
  artifactId?: string | null;
  execution_lifecycle?: ExecutionLifecycleRecord[];
  mode: 'file' | 'goal';
  previewId: string;
  relativePath?: string;
  summary: string;
  diffSummary?: string;
  changeId?: string;
  changeCount?: number;
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

export const ALLOWED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.ps1',
]);

export const ALLOWED_TOP_LEVEL_DIRS = new Set(['src', 'tests', 'config', 'scripts']);

export const LAUNCHER_TOUCH_PATTERNS = [
  /^scripts\/launch-zavorth/i,
  /^scripts\/install-windows-startup\.ps1$/i,
  /^src\/index\.ts$/i,
  /^src\/services\/(Omni|ZavorthBridge|ZavorthAIGateway)/i,
];
