import type { Context } from 'grammy';
import {
  buildOperationalSurfaceResponse,
  buildWorkflowStageSurfaceResponse,
} from '../../../domain/surface/application/surface-response/index.js';
import { replyWithTelegramSurfaceResponse } from '../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';

export type TelegramWorkflowSurfaceReceiptStatus =
  | 'allowed'
  | 'allowed_with_redaction'
  | 'require_user_confirmation'
  | 'require_admin_policy'
  | 'denied'
  | 'blocked'
  | 'done'
  | 'failed';

type WorkflowOperationalSurfaceInput = {
  id: string;
  intent: 'receipt' | 'generic' | 'status' | 'help';
  title: string;
  summary: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  text: string;
  receipt?: {
    id: string;
    title: string;
    status: TelegramWorkflowSurfaceReceiptStatus;
    reason: string;
    policyProfile?: string | null;
    redacted?: boolean;
    riskBlocked?: boolean;
    metadata?: Record<string, unknown>;
  };
};

type WorkflowStageSurfaceInput = {
  workflowRunId: string;
  workflowName: string;
  stageId: string;
  stageLabel: string;
  taskId: string | null | undefined;
  title: string;
  summary: string;
  text: string;
  status: TelegramWorkflowSurfaceReceiptStatus;
  reason: string;
  metadata?: Record<string, unknown>;
};

export async function replyWorkflowOperationalSurfaceResponse(
  ctx: Context,
  input: WorkflowOperationalSurfaceInput,
): Promise<void> {
  await replyWithTelegramSurfaceResponse(
    ctx,
    buildOperationalSurfaceResponse(input),
  );
}

export async function replyWorkflowStageSurfaceResponse(
  ctx: Context,
  input: WorkflowStageSurfaceInput,
): Promise<void> {
  await replyWithTelegramSurfaceResponse(
    ctx,
    buildWorkflowStageSurfaceResponse(input),
  );
}
