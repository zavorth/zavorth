import { createHash, randomUUID } from 'crypto';
import type {
  ApprovalRequestEventData,
  PublicRuntimeEvent,
  ReceiptReadyEventData,
  RuntimeStatusEventData,
} from '../contracts/public/events/sse.js';
import type { WebRealtimeEvent, WebSessionSnapshot } from './WebRealtimeService.js';

interface SerializedPermissionPayload {
  permission_id: string;
  task_id: string | null;
  kind: string | null;
  status: string | null;
  reason: string | null;
  requested_value: string | null;
  resolved_value: string | null;
  metadata: Record<string, unknown>;
}


interface SerializedWorkflowPayload {
  workflow_run_id: string;
  workflow_name: string;
  objective: string;
  status: string;
  phases: Array<{ status: string }>;
  resume_stage: { label: string | null; objective: string | null } | null;
  artifacts: unknown[];
}

interface AgentStreamProgressPayload extends Record<string, unknown> {
  eventType: string;
  sessionId: string;
  totalChunks?: number;
  chunkIndex?: number;
  [key: string]: unknown;
}

interface SnapshotPermission {
  status: string | null;
}

interface SnapshotTask {
  status: string | null;
}

export class PublicRuntimeEventService {
  public mapWebRealtimeEvent(event: WebRealtimeEvent): PublicRuntimeEvent[] {
    switch (event.type) {
      case 'snapshot':
        return [
          this.wrap('runtime.status', event, {
            status: this.resolveRuntimeStatus(event.payload),
            summary: this.summarizeSnapshot(event.payload),
          }),
          this.wrap('snapshot.updated', event, {
            snapshotKind: 'web-session',
            summary: this.summarizeSnapshot(event.payload),
          }),
        ];
      case 'message':
        return [
          this.wrap('message.created', event, {
            messageId: event.payload.id,
            role: event.payload.role,
            kind: event.payload.kind || null,
            content: sanitizeText(event.payload.content),
            taskId: event.payload.taskId || null,
          }),
        ];
      case 'task':
        return [
          this.wrap('mission.updated', event, {
            missionId: String(event.payload.task_id || ''),
            title: sanitizeText(event.payload.command_type || 'Task runtime'),
            status: String(event.payload.status || 'unknown'),
            risk: normalizeRisk(event.payload.risk_level),
            currentStep: sanitizeNullableText(event.payload.raw_message),
            progress: null,
            artifacts: safeArray(event.payload.artifacts),
          }),
        ];
      case 'workflow':
        return [
          this.wrap('mission.updated', event, {
            missionId: String(event.payload.workflow_run_id || ''),
            title: sanitizeText(event.payload.workflow_name || event.payload.objective || 'Workflow'),
            status: String(event.payload.status || 'unknown'),
            risk: 'unknown',
            currentStep: sanitizeNullableText(event.payload.resume_stage?.label || event.payload.resume_stage?.objective),
            progress: this.resolveWorkflowProgress(event.payload),
            artifacts: safeArray(event.payload.artifacts),
          }),
        ];
      case 'permission':
        return [
          this.wrap('approval.request', event, this.buildApprovalRequest(event.payload)),
        ];
      case 'agent-stream':
        return [
          this.wrap('mission.updated', event, {
            missionId: sanitizeText(event.payload.runId || event.payload.streamId || event.id),
            title: sanitizeText(event.payload.title || event.payload.eventType || 'Agent stream'),
            status: sanitizeText(event.payload.done === true ? 'completed' : event.payload.phase || event.payload.streamStatus || 'running'),
            risk: 'unknown',
            currentStep: sanitizeNullableText(event.payload.summary || event.payload.accumulated || event.payload.delta),
            progress: this.resolveAgentStreamProgress(event.payload),
            artifacts: [],
          }),
        ];
      case 'tool': {
        const toolEvent = this.wrap('tool.updated', event, {
          runId: String(event.payload.runId || ''),
          taskId: sanitizeNullableText(event.payload.taskId),
          toolName: sanitizeText(event.payload.toolName || 'Tool run'),
          status: String(event.payload.status || 'unknown'),
          filesTouched: safeStringArray(event.payload.filesTouched),
          artifacts: safeArray(event.payload.artifacts),
        });
        const receipt = this.maybeBuildReceiptReady(event);
        return receipt ? [toolEvent, receipt] : [toolEvent];
      }
      case 'ping':
        return [
          this.wrap('heartbeat', event, {
            sessionId: event.payload.sessionId,
          }),
        ];
      default:
        return [
          this.wrap('error', event as WebRealtimeEvent, {
            code: 'unsupported_event',
            message: `Unsupported realtime event type: ${(event as { type: string }).type}`,
          }),
        ];
    }
  }

  public buildRuntimeStatusSnapshot(input: {
    sessionId: string;
    snapshot: WebSessionSnapshot;
  }): PublicRuntimeEvent {
    const event = {
      id: randomUUID(),
      type: 'snapshot' as const,
      createdAt: new Date().toISOString(),
      payload: input.snapshot,
    };
    return this.wrap('runtime.status', event, {
      status: this.resolveRuntimeStatus(input.snapshot),
      summary: this.summarizeSnapshot(input.snapshot),
    });
  }

  private buildApprovalRequest(payload: SerializedPermissionPayload): ApprovalRequestEventData {
    const taskId = sanitizeNullableText(payload.task_id);
    const files = safeStringArray(payload.metadata?.files || payload.metadata?.target_files);
    return {
      approvalId: String(payload.permission_id || ''),
      taskId,
      workflowId: sanitizeNullableText(payload.metadata?.workflowRunId || payload.metadata?.workflow_run_id),
      risk: normalizeRisk(payload.metadata?.risk || payload.metadata?.risk_level),
      action: sanitizeText(payload.kind || 'approval'),
      summary: sanitizeText(payload.reason || 'Zavorth needs approval for a scoped action.'),
      preview: {
        files,
        diff: payload.metadata?.diff || null,
        requestedValue: sanitizeNullableText(payload.requested_value),
        resolvedValue: sanitizeNullableText(payload.resolved_value),
      },
      policy: sanitizeText(payload.metadata?.policy || `${payload.kind || 'action'}.requires_approval`),
      expiresAt: sanitizeNullableText(payload.metadata?.expiresAt || payload.metadata?.expires_at),
      options: ['allow_once', 'deny', 'view_preview', 'view_rollback'],
    };
  }

  private maybeBuildReceiptReady(event: Extract<WebRealtimeEvent, { type: 'tool' }>): PublicRuntimeEvent | null {
    const status = String(event.payload.status || '').trim().toLowerCase();
    const artifacts = safeArray(event.payload.artifacts);
    const filesTouched = safeStringArray(event.payload.filesTouched);
    if (!['completed', 'failed', 'blocked', 'rejected'].includes(status) && artifacts.length === 0 && filesTouched.length === 0) {
      return null;
    }

    const data: ReceiptReadyEventData = {
      receiptId: `receipt_${stableHash([
        event.payload.runId,
        event.payload.taskId,
        status,
        JSON.stringify(filesTouched),
      ].join(':'))}`,
      missionId: sanitizeNullableText(event.payload.workflowRunId),
      taskId: sanitizeNullableText(event.payload.taskId),
      title: sanitizeText(event.payload.toolName || 'Tool receipt'),
      outcome: status || 'unknown',
      filesTouched,
      artifacts,
      rollbackAvailable: Boolean(event.payload.diff || filesTouched.length > 0),
    };
    return this.wrap('receipt.ready', event, data);
  }

  private resolveRuntimeStatus(snapshot: WebSessionSnapshot): RuntimeStatusEventData['status'] {
    const permissions = Array.isArray(snapshot.permissions) ? snapshot.permissions : [];
    if (permissions.some((permission: SnapshotPermission) => String(permission?.status || '').toLowerCase() === 'pending')) {
      return 'waiting_approval';
    }
    const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
    if (tasks.some((task: SnapshotTask) => ['failed', 'rejected', 'cancelled', 'blocked'].includes(String(task?.status || '').toLowerCase()))) {
      return 'blocked';
    }
    if (tasks.some((task: SnapshotTask) => ['running', 'queued', 'pending'].includes(String(task?.status || '').toLowerCase()))) {
      return 'running';
    }
    return 'ready';
  }

  private summarizeSnapshot(snapshot: WebSessionSnapshot): RuntimeStatusEventData['summary'] {
    return {
      messages: Array.isArray(snapshot.messages) ? snapshot.messages.length : 0,
      tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.length : 0,
      approvals: Array.isArray(snapshot.permissions) ? snapshot.permissions.length : 0,
      workflows: Array.isArray(snapshot.workflowRuns) ? snapshot.workflowRuns.length : 0,
      toolRuns: Array.isArray(snapshot.toolRuns) ? snapshot.toolRuns.length : 0,
    };
  }

  private resolveWorkflowProgress(payload: SerializedWorkflowPayload): number | null {
    const phases = safeArray(payload.phases);
    if (phases.length === 0) {
      return null;
    }
    const completed = phases.filter((phase) => {
      const record = phase && typeof phase === 'object' ? phase as Record<string, unknown> : {};
      return String(record.status || '').toLowerCase() === 'completed';
    }).length;
    return Math.round((completed / phases.length) * 100);
  }

  private resolveAgentStreamProgress(payload: AgentStreamProgressPayload): number | null {
    const total = Number(payload?.totalChunks || 0);
    const index = Number(payload?.chunkIndex || 0);
    if (!Number.isFinite(total) || !Number.isFinite(index) || total <= 0 || index < 0) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round((index / total) * 100)));
  }

  private wrap<TType extends PublicRuntimeEvent['type']>(
    type: TType,
    event: Pick<WebRealtimeEvent, 'id' | 'createdAt'> & { payload?: Record<string, unknown> },
    data: Extract<PublicRuntimeEvent, { type: TType }>['data'],
  ): Extract<PublicRuntimeEvent, { type: TType }> {
    return {
      schemaVersion: 1,
      id: event.id || randomUUID(),
      type,
      timestamp: event.createdAt || new Date().toISOString(),
      traceId: `evt_${stableHash(`${type}:${event.id || ''}:${event.createdAt || ''}`)}`,
      sessionId: this.resolveSessionId(event.payload),
      data,
      safety: {
        zavorthControlCanExecute: false,
        policyBrokerRequiredForMutableActions: true,
        rawSecretsSerialized: false,
      },
    } as Extract<PublicRuntimeEvent, { type: TType }>;
  }

  private resolveSessionId(payload: Record<string, unknown> | null | undefined): string | null {
    return sanitizeNullableText(payload?.sessionId || payload?.session_id);
  }
}

function sanitizeText(value: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, 4000);
}

function sanitizeNullableText(value: unknown): string | null {
  const text = sanitizeText(value);
  return text || null;
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeStringArray(value: unknown): string[] {
  return safeArray(value)
    .map((entry) => sanitizeText(entry))
    .filter(Boolean)
    .slice(0, 50);
}

function normalizeRisk(value: unknown): 'low' | 'medium' | 'high' | 'critical' | 'unknown' {
  const risk = String(value || '').trim().toLowerCase();
  return risk === 'low' || risk === 'medium' || risk === 'high' || risk === 'critical'
    ? risk
    : 'unknown';
}

function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
