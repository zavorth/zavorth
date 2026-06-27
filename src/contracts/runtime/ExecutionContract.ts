import { ArtifactInput } from '../ArtifactContract.js';

export interface ExecutionRequest {
  execution_id: string;
  task_id: string;
  executor: string;
  workspace: string;
  objective: string;
  instructions: string[];
  allowed_paths: string[];
  blocked_paths: string[];
  allowed_commands: string[];
  blocked_commands: string[];
  timeout_seconds: number;
  dry_run: boolean;
  requires_backup: boolean;
  metadata: Record<string, any>;
}

export interface ExecutionTiming {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface ExecutionResult {
  execution_id: string;
  task_id: string;
  executor: string;
  success: boolean;
  started_at: string;
  finished_at: string;
  timing?: ExecutionTiming;
  actions_executed: string[];
  files_read: string[];
  files_written: string[];
  files_deleted: string[];
  commands_executed: string[];
  stdout: string | null;
  stderr: string | null;
  diff_summary: string | null;
  artifacts: ArtifactInput[];
  rollback_available: boolean;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
}
