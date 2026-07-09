import type {
  SurfaceReceipt,
  SurfaceReceiptStatus,
  SurfaceResponse,
  SurfaceResponseAction,
  SurfaceResponseIntent,
  SurfaceResponseTone,
} from './SurfaceResponseContract.js';
import { createSurfaceResponse } from './SurfaceResponseContract.js';

import { compactSurfaceLine } from './SurfaceResponseUtils.js';

export type OperationalSurfaceReceiptInput = {
  id: string;
  title: string;
  status: SurfaceReceiptStatus;
  reason: string;
  policyProfile?: string | null;
  redacted?: boolean;
  riskBlocked?: boolean;
  createdAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type OperationalSurfaceInput = {
  id: string;
  intent?: SurfaceResponseIntent;
  title: string;
  summary?: string | null;
  tone?: SurfaceResponseTone;
  text?: string | null;
  receipt?: OperationalSurfaceReceiptInput | null;
  receipts?: OperationalSurfaceReceiptInput[];
  actions?: SurfaceResponseAction[];
};

export function buildOperationalSurfaceResponse(input: OperationalSurfaceInput): SurfaceResponse {
  const text = String(input.text || '').trim();
  const receipts = [
    ...(input.receipt ? [input.receipt] : []),
    ...(input.receipts || []),
  ].map(normalizeOperationalReceipt);

  return createSurfaceResponse({
    id: input.id,
    intent: input.intent || 'generic',
    title: input.title,
    summary: input.summary || null,
    tone: input.tone || 'info',
    blocks: text
      ? [
          {
            kind: 'text',
            text,
          },
        ]
      : [],
    receipts,
    actions: input.actions || [],
  });
}

export function buildTaskEventSurfaceResponse(input: {
  taskId: string;
  event: string;
  title: string;
  summary: string;
  text: string;
  status: SurfaceReceiptStatus;
  tone?: SurfaceResponseTone;
  reason?: string | null;
  policyProfile?: string | null;
  riskBlocked?: boolean;
  metadata?: Record<string, unknown>;
  actions?: SurfaceResponseAction[];
}): SurfaceResponse {
  return buildOperationalSurfaceResponse({
    id: `task-${compactSurfaceLine(input.taskId)}-${compactSurfaceLine(input.event)}`,
    intent: input.status === 'require_user_confirmation' ? 'approval' : 'receipt',
    title: input.title,
    summary: input.summary,
    tone: input.tone || mapReceiptTone(input.status),
    text: input.text,
    receipt: {
      id: input.taskId,
      title: input.event,
      status: input.status,
      reason: input.reason || input.summary,
      policyProfile: input.policyProfile || 'task-runtime',
      redacted: true,
      riskBlocked: input.riskBlocked || input.status === 'blocked' || input.status === 'denied',
      metadata: input.metadata,
    },
    actions: input.actions,
  });
}

export function buildWorkflowStageSurfaceResponse(input: {
  workflowRunId: string;
  workflowName: string;
  stageId: string;
  stageLabel: string;
  title: string;
  summary: string;
  text: string;
  status: SurfaceReceiptStatus;
  tone?: SurfaceResponseTone;
  reason?: string | null;
  taskId?: string | null;
  metadata?: Record<string, unknown>;
  actions?: SurfaceResponseAction[];
}): SurfaceResponse {
  return buildOperationalSurfaceResponse({
    id: [
      'workflow',
      input.workflowRunId,
      input.stageId,
      compactSurfaceLine(input.status),
    ].map(compactSurfaceLine).filter(Boolean).join('-'),
    intent: input.status === 'require_user_confirmation' ? 'approval' : 'receipt',
    title: input.title,
    summary: input.summary,
    tone: input.tone || mapReceiptTone(input.status),
    text: input.text,
    receipt: {
      id: input.taskId || `${input.workflowRunId}:${input.stageId}`,
      title: `${input.workflowName}/${input.stageLabel}`,
      status: input.status,
      reason: input.reason || input.summary,
      policyProfile: 'workflow-runtime',
      redacted: true,
      riskBlocked: input.status === 'blocked' || input.status === 'denied',
      metadata: {
        workflowRunId: input.workflowRunId,
        workflowName: input.workflowName,
        stageId: input.stageId,
        ...(input.metadata || {}),
      },
    },
    actions: input.actions,
  });
}

export function buildRuntimeSurfaceResponse(input: {
  id: string;
  title: string;
  summary: string;
  text: string;
  status?: SurfaceReceiptStatus;
  tone?: SurfaceResponseTone;
  reason?: string | null;
  policyProfile?: string | null;
  metadata?: Record<string, unknown>;
  actions?: SurfaceResponseAction[];
}): SurfaceResponse {
  const status = input.status || 'done';
  return buildOperationalSurfaceResponse({
    id: input.id,
    intent: 'receipt',
    title: input.title,
    summary: input.summary,
    tone: input.tone || mapReceiptTone(status),
    text: input.text,
    receipt: {
      id: input.id,
      title: input.title,
      status,
      reason: input.reason || input.summary,
      policyProfile: input.policyProfile || 'runtime-maintenance',
      redacted: true,
      riskBlocked: status === 'blocked' || status === 'denied' || status === 'failed',
      metadata: input.metadata,
    },
    actions: input.actions,
  });
}

export function buildReportSurfaceResponse(input: {
  id: string;
  title: string;
  summary?: string | null;
  text: string;
  status?: SurfaceReceiptStatus;
  tone?: SurfaceResponseTone;
  policyProfile?: string | null;
  metadata?: Record<string, unknown>;
  actions?: SurfaceResponseAction[];
}): SurfaceResponse {
  const status = input.status || 'done';
  const summary = input.summary || null;
  const receiptReason = summary || firstOperationalLine(input.text) || input.title;
  return buildOperationalSurfaceResponse({
    id: input.id,
    intent: 'receipt',
    title: input.title,
    summary,
    tone: input.tone || mapReceiptTone(status),
    text: input.text,
    receipt: {
      id: input.id,
      title: input.title,
      status,
      reason: receiptReason,
      policyProfile: input.policyProfile || 'operational-report',
      redacted: true,
      riskBlocked: status === 'blocked' || status === 'denied' || status === 'failed',
      metadata: input.metadata,
    },
    actions: input.actions,
  });
}

export function mapBooleanReceiptStatus(success: boolean | undefined): SurfaceReceiptStatus {
  return success === false ? 'failed' : 'done';
}

function normalizeOperationalReceipt(input: OperationalSurfaceReceiptInput): SurfaceReceipt {
  return {
    id: compactSurfaceLine(input.id) || 'receipt',
    title: compactSurfaceLine(input.title) || 'Operational receipt',
    status: input.status,
    reason: compactSurfaceLine(input.reason) || 'Sem detalhe registrado.',
    policyProfile: input.policyProfile || null,
    redacted: input.redacted,
    riskBlocked: input.riskBlocked,
    createdAt: input.createdAt || null,
    metadata: input.metadata,
  };
}

function mapReceiptTone(status: SurfaceReceiptStatus): SurfaceResponseTone {
  switch (status) {
    case 'allowed':
    case 'allowed_with_redaction':
    case 'done':
      return 'success';
    case 'require_user_confirmation':
    case 'require_admin_policy':
      return 'warning';
    case 'denied':
    case 'blocked':
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
}

function firstOperationalLine(value: string): string {
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}
