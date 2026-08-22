import { ArtifactRecord } from './ArtifactContract.js';
import { TaskSource } from './PlatformContract.js';

export type TaskStatus =
  | 'pending'
  | 'parsed'
  | 'planned'
  | 'waiting_approval'
  | 'approved'
  | 'rejected'
  | 'running'
  | 'validating'
  | 'delivery_pending'
  | 'completed'
  | 'failed'
  | 'rollback_pending'
  | 'reverted'
  | 'cancelled';

export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected' | 'expired';

export interface Task {
  task_id: string;
  created_at: string;
  updated_at: string;
  source: TaskSource;
  chat_id: string;
  user_id: string;
  raw_message: string;
  normalized_message: string;
  command_type: string;
  intent: string;
  target: string | null;
  workspace: string | null;
  risk_level: number;
  status: TaskStatus;
  requires_planning: boolean;
  requires_approval: boolean;
  approval_status: ApprovalStatus;
  planner_used: string | null;
  executor_used: string | null;
  fallback_used: boolean;
  parent_task_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions_planned: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions_executed: any[];
  target_files: string[];
  artifacts: ArtifactRecord[];
  stdout_summary: string | null;
  stderr_summary: string | null;
  diff_summary: string | null;
  result_summary: string | null;
  error_summary: string | null;
  rollback_available: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}
