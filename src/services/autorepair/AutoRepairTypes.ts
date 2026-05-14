import type { RuntimeBootstrapRepairReport } from '../../runtime/access/RuntimeBootstrapRepairService.js';
import type { SupervisedReloadRequestResult } from '../SupervisedRuntimeService.js';

export type AutoRepairGoal = 'auto' | 'repair' | 'improve';
export type AutoRepairStatus = 'noop' | 'busy' | 'dry_run' | 'repaired' | 'reloaded' | 'failed';

export type AutoRepairPlan = {
  needsCodeChange: boolean;
  targetFile: string | null;
  instruction: string;
  summary: string;
  confidence: number;
  warnings: string[];
  validationHints: string[];
};

export type AutoRepairValidationStep = {
  label: string;
  command: string;
  status: 'passed' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  output?: string;
};

export type AutoRepairAttempt = {
  attemptNumber: number;
  plannedAt: string;
  targetFile: string | null;
  instruction: string;
  plannerSummary: string;
  plannerConfidence: number;
  previewSummary?: string;
  previewWarnings?: string[];
  validation: AutoRepairValidationStep[];
  applyReason?: string;
  rollbackStatus?: 'restored' | 'deleted-new-file' | 'failed';
  rollbackReason?: string;
  status: 'planned' | 'applied' | 'validated' | 'rolled_back' | 'failed';
  error?: string;
};

export type AutoRepairReport = {
  startedAt: string;
  finishedAt: string;
  requestedBy: string;
  reason: string;
  goal: AutoRepairGoal;
  dryRun: boolean;
  force: boolean;
  status: AutoRepairStatus;
  projectRoot: string;
  bootstrapRepair: RuntimeBootstrapRepairReport;
  planner?: AutoRepairPlan | null;
  attempts: AutoRepairAttempt[];
  reloadRequest?: SupervisedReloadRequestResult | null;
  warnings: string[];
  summary: string;
};

export type AutoRepairRunInput = {
  reason: string;
  requestedBy: string;
  notifyChatId?: string | null;
  dryRun?: boolean;
  force?: boolean;
  goal?: AutoRepairGoal;
};

export type AutoRepairRunResult = {
  success: boolean;
  status: AutoRepairStatus;
  summary: string;
  report: AutoRepairReport;
};
