export type SseEventType =
  | 'conversation_chunk'
  | 'workflow_status'
  | 'node_status'
  | 'approval_required'
  | 'error';

export type PublicRuntimeEventType =
  | 'runtime.status'
  | 'message.created'
  | 'mission.updated'
  | 'approval.request'
  | 'tool.updated'
  | 'receipt.ready'
  | 'snapshot.updated'
  | 'heartbeat'
  | 'error';

export interface BaseSseEvent<TType extends SseEventType, TData> {
  id: string;      // Unique event ID
  type: TType;     // Event type string for SSE
  timestamp: string; // ISO-8601
  data: TData;
}

export interface ConversationChunkData {
  sessionId: string;
  chunk: string;
  isComplete: boolean;
  messageId?: string; // If correlating to a specific message stream
}
export type SseConversationChunkEvent = BaseSseEvent<'conversation_chunk', ConversationChunkData>;

export interface WorkflowStatusData {
  workflowId: string;
  sessionId?: string;
  status: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed';
  currentStep?: string;
  progress?: number;
}
export type SseWorkflowStatusEvent = BaseSseEvent<'workflow_status', WorkflowStatusData>;

export interface ApprovalRequiredData {
  approvalId: string;
  workflowId: string;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  expiresAt?: string;
}
export type SseApprovalRequiredEvent = BaseSseEvent<'approval_required', ApprovalRequiredData>;

// Any event payload down the SSE tube
export type PublicSseEvent =
  | SseConversationChunkEvent
  | SseWorkflowStatusEvent
  | SseApprovalRequiredEvent;

export interface PublicRuntimeEventEnvelope<TType extends PublicRuntimeEventType, TData> {
  schemaVersion: 1;
  id: string;
  type: TType;
  timestamp: string;
  traceId: string;
  sessionId: string | null;
  data: TData;
  safety: {
    zavorthControlCanExecute: false;
    policyBrokerRequiredForMutableActions: true;
    rawSecretsSerialized: false;
  };
}

export interface RuntimeStatusEventData {
  status: 'ready' | 'running' | 'waiting_approval' | 'blocked' | 'error';
  summary: {
    messages: number;
    tasks: number;
    approvals: number;
    workflows: number;
    toolRuns: number;
  };
}

export interface MessageCreatedEventData {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  kind: string | null;
  content: string;
  taskId: string | null;
}

export interface MissionUpdatedEventData {
  missionId: string;
  title: string;
  status: string;
  risk: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  currentStep: string | null;
  progress: number | null;
  artifacts: unknown[];
}

export interface ApprovalRequestEventData {
  approvalId: string;
  taskId: string | null;
  workflowId: string | null;
  risk: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  action: string;
  summary: string;
  preview: {
    files: string[];
    diff: unknown | null;
    requestedValue: string | null;
    resolvedValue: string | null;
  };
  policy: string;
  expiresAt: string | null;
  options: Array<'allow_once' | 'deny' | 'view_preview' | 'view_rollback'>;
}

export interface ToolUpdatedEventData {
  runId: string;
  taskId: string | null;
  toolName: string;
  status: string;
  filesTouched: string[];
  artifacts: unknown[];
}

export interface ReceiptReadyEventData {
  receiptId: string;
  missionId: string | null;
  taskId: string | null;
  title: string;
  outcome: string;
  filesTouched: string[];
  artifacts: unknown[];
  rollbackAvailable: boolean;
}

export interface SnapshotUpdatedEventData {
  snapshotKind: 'web-session';
  summary: RuntimeStatusEventData['summary'];
}

export interface HeartbeatEventData {
  sessionId: string;
}

export interface RuntimeErrorEventData {
  code: string;
  message: string;
  details?: unknown;
}

export type PublicRuntimeEvent =
  | PublicRuntimeEventEnvelope<'runtime.status', RuntimeStatusEventData>
  | PublicRuntimeEventEnvelope<'message.created', MessageCreatedEventData>
  | PublicRuntimeEventEnvelope<'mission.updated', MissionUpdatedEventData>
  | PublicRuntimeEventEnvelope<'approval.request', ApprovalRequestEventData>
  | PublicRuntimeEventEnvelope<'tool.updated', ToolUpdatedEventData>
  | PublicRuntimeEventEnvelope<'receipt.ready', ReceiptReadyEventData>
  | PublicRuntimeEventEnvelope<'snapshot.updated', SnapshotUpdatedEventData>
  | PublicRuntimeEventEnvelope<'heartbeat', HeartbeatEventData>
  | PublicRuntimeEventEnvelope<'error', RuntimeErrorEventData>;
