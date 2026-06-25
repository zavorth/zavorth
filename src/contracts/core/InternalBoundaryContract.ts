import {
  createExecutionCorrelation,
  type ZavorthExecutionCorrelation,
  type CanonicalRunContext,
  type ExecutionLifecycleRecord,
} from './ExecutionLifecycleContract.js';

export const ZAVORTH_OPERATIONAL_ERROR_CODES = [
  'validation_error',
  'policy_blocked',
  'approval_required',
  'capability_unavailable',
  'runtime_unhealthy',
  'execution_failed',
] as const;

export type ZavorthOperationalErrorCode = (typeof ZAVORTH_OPERATIONAL_ERROR_CODES)[number];

export type ZavorthBoundaryStatus = 'ok' | 'not_handled' | 'blocked' | 'error';

export type ZavorthBoundaryCorrelation = ZavorthExecutionCorrelation;

export type ZavorthBoundaryError = {
  code: ZavorthOperationalErrorCode;
  message: string;
  details: string[];
  retryable: boolean;
};

export type CommandRequest = {
  commandText: string;
  surface: string;
  requestedBy: string;
  chatId?: string | null;
  threadId?: string | null;
  profile?: string | null;
  dryRun?: boolean;
  approved?: boolean;
  metadata?: Record<string, unknown>;
  correlation?: Partial<ZavorthBoundaryCorrelation> | null;
};

export type CommandResult = {
  ok: boolean;
  handled: boolean;
  status: ZavorthBoundaryStatus;
  summary: string;
  messages: string[];
  correlation: ZavorthBoundaryCorrelation;
  error: ZavorthBoundaryError | null;
  metadata: Record<string, unknown>;
};

export type SnapshotRequest = {
  planeId: string;
  surface: string;
  requestedBy: string;
  profile?: string | null;
  query?: Record<string, unknown>;
  correlation?: Partial<ZavorthBoundaryCorrelation> | null;
};

export type SnapshotResult<TData = unknown> = {
  ok: boolean;
  planeId: string;
  status: Extract<ZavorthBoundaryStatus, 'ok' | 'error'>;
  summary: string;
  data: TData | null;
  correlation: ZavorthBoundaryCorrelation;
  error: ZavorthBoundaryError | null;
  metadata: Record<string, unknown>;
};

export type ActionRequest = {
  planeId: string;
  actionId: string;
  requestedBy: string;
  surface: string;
  profile?: string | null;
  dryRun?: boolean;
  approved?: boolean;
  payload?: Record<string, unknown>;
  correlation?: Partial<ZavorthBoundaryCorrelation> | null;
};

export type ActionResult<TData = unknown> = {
  ok: boolean;
  planeId: string;
  actionId: string;
  status: Extract<ZavorthBoundaryStatus, 'ok' | 'blocked' | 'error'>;
  summary: string;
  data: TData | null;
  correlation: ZavorthBoundaryCorrelation;
  error: ZavorthBoundaryError | null;
  metadata: Record<string, unknown>;
};

export type ApprovalLink = {
  approvalId: string | null;
  required: boolean;
  summary: string | null;
};

export type RunContext = CanonicalRunContext;

export type ExecutionIntent = {
  objective: string;
  surface: string;
  requestedBy: string;
  sessionId?: string | null;
  profile?: string | null;
  dryRun?: boolean;
  approved?: boolean;
  metadata?: Record<string, unknown>;
  correlation?: Partial<ZavorthBoundaryCorrelation> | null;
};

export type ExecutionDecision = {
  ok: boolean;
  decision: 'approved' | 'approval_required' | 'blocked';
  summary: string;
  correlation: ZavorthBoundaryCorrelation;
  runContext: RunContext;
  approval: ApprovalLink;
  lifecycle: ExecutionLifecycleRecord[];
  error: ZavorthBoundaryError | null;
  metadata: Record<string, unknown>;
};

export type ExecutionOutcome = {
  ok: boolean;
  status: 'completed' | 'blocked' | 'failed' | 'noop';
  summary: string;
  correlation: ZavorthBoundaryCorrelation;
  runContext: RunContext;
  artifacts: string[];
  lifecycle: ExecutionLifecycleRecord[];
  error: ZavorthBoundaryError | null;
  metadata: Record<string, unknown>;
};

export function createBoundaryCorrelation(
  input: Partial<ZavorthBoundaryCorrelation> | null | undefined = {},
): ZavorthBoundaryCorrelation {
  return createExecutionCorrelation(input);
}

export function createBoundaryError(
  code: ZavorthOperationalErrorCode,
  message: string,
  details: string[] = [],
  retryable = false,
): ZavorthBoundaryError {
  return {
    code,
    message: normalizeMessage(message),
    details: details
      .map((entry) => normalizeMessage(entry))
      .filter((entry) => entry.length > 0),
    retryable,
  };
}

function normalizeMessage(value: unknown): string {
  return String(value || '').trim();
}
