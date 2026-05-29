export type ExecutionEngineId = 'lite' | 'velocity' | 'shield';

export type ExecutionEngineAudience = 'personal' | 'developer' | 'business';

export type ExecutionEngineLatencyTarget = 'instant' | 'fast' | 'governed';

export type ExecutionEngineSandboxPolicy =
  | 'none'
  | 'trusted-workspace-only'
  | 'sandbox-required';

export type ExecutionEngineApprovalPolicy =
  | 'none'
  | 'risk-based'
  | 'always-for-impact';

export type ExecutionEngineToolExposure =
  | 'chat-documents-apis'
  | 'trusted-local-tools'
  | 'governed-full-tools';

export type ExecutionEngineDiffPolicy =
  | 'not-applicable'
  | 'interactive-direct-if-trusted'
  | 'interactive-approval-required';

export type ExecutionEngineTraceVisibility =
  | 'hidden'
  | 'compact-operational'
  | 'full-operational';

export type ExecutionEngineAdminLockPolicy =
  | 'user-selectable'
  | 'admin-can-disable'
  | 'admin-required';

export type ExecutionEnginePolicy = {
  id: ExecutionEngineId;
  label: string;
  audience: ExecutionEngineAudience;
  latencyTarget: ExecutionEngineLatencyTarget;
  sandboxPolicy: ExecutionEngineSandboxPolicy;
  approvalPolicy: ExecutionEngineApprovalPolicy;
  toolExposure: ExecutionEngineToolExposure;
  diffPolicy: ExecutionEngineDiffPolicy;
  traceVisibility: ExecutionEngineTraceVisibility;
  adminLockPolicy: ExecutionEngineAdminLockPolicy;
  summary: string;
  allowedActions: string[];
  blockedActions: string[];
};

export type ExecutionEngineAvailability = {
  engineId: ExecutionEngineId;
  available: boolean;
  reason: string | null;
  nextSafeAction: string | null;
};

export type ExecutionEngineDecisionMode =
  | 'express'
  | 'trusted-workspace'
  | 'sandbox'
  | 'approval'
  | 'blocked';

export type ExecutionEngineDecision = {
  engineId: ExecutionEngineId;
  mode: ExecutionEngineDecisionMode;
  status: 'ready' | 'needs-approval' | 'blocked';
  express: boolean;
  reason: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  workspaceTrust: TrustedWorkspaceState;
  targetPath: string | null;
  nextSafeAction: string;
  events: GlassBoxTraceEvent[];
};

export type TrustedWorkspaceState = 'untrusted' | 'trusted' | 'sensitive';

export type TrustedWorkspacePolicy = {
  id: string;
  path: string;
  label: string;
  state: TrustedWorkspaceState;
  createdAt: string;
  updatedAt: string;
};

export type GlassBoxTraceEventKind =
  | 'engine-decision'
  | 'express-route'
  | 'sandbox'
  | 'command'
  | 'diff'
  | 'approval'
  | 'receipt'
  | 'canvas'
  | 'egress-blocked';

export type GlassBoxTraceEvent = {
  id: string;
  kind: GlassBoxTraceEventKind;
  title: string;
  detail: string;
  engineId: ExecutionEngineId;
  status: 'info' | 'success' | 'warning' | 'blocked';
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type InteractiveDiffAction =
  | 'accept-file'
  | 'reject-file'
  | 'accept-hunk'
  | 'reject-hunk';

export type InteractiveDiffReview = {
  id: string;
  action: InteractiveDiffAction;
  targetId: string;
  engineId: ExecutionEngineId;
  targetPath: string | null;
  status: 'recorded' | 'host-direct-ready' | 'approval-required' | 'sandbox-recompose-required' | 'blocked';
  summary: string;
  requiresApproval: boolean;
  requiresSandbox: boolean;
  events: GlassBoxTraceEvent[];
};

export type InteractiveDiffApplyResult = {
  review: InteractiveDiffReview;
  applied: boolean;
  status: 'applied' | 'dry-run-ready' | 'approval-required' | 'sandbox-required' | 'blocked' | 'failed';
  summary: string;
  targetPath: string | null;
  beforeHash: string | null;
  afterHash: string | null;
  events: GlassBoxTraceEvent[];
};

export type CanvasFileSnapshot = {
  path: string;
  content: string;
  mimeType: string;
};

export type CanvasAttemptSnapshot = {
  id: string;
  round: number;
  status: 'ready' | 'approved' | 'needs-correction' | 'blocked' | 'failed';
  summary: string;
  sandboxWorkspace: string | null;
  files: CanvasFileSnapshot[];
  diffs: string[];
  logs: string[];
  previewUrl: string | null;
  createdAt: string;
};

export type CanvasEgressEvent = {
  id: string;
  url: string;
  reason: string;
  blockedAt: string;
};

export type CanvasSessionSnapshot = {
  sessionId: string;
  engineId: ExecutionEngineId;
  sandboxRunId: string | null;
  attempts: CanvasAttemptSnapshot[];
  activeAttemptId: string | null;
  files: CanvasFileSnapshot[];
  diffs: string[];
  logs: string[];
  previewUrl: string | null;
  egressEvents: CanvasEgressEvent[];
  createdAt: string;
  updatedAt: string;
};

export type CanvasPreviewDiagnostics = {
  running: boolean;
  baseUrl: string | null;
  sessionCount: number;
  ttlMs: number;
  maxSessions: number;
};
