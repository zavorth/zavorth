import { Context } from 'grammy';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { CodexRemoteActionService } from '../../../../services/CodexRemoteActionService.js';
import {
  createSurfaceResponse,
  type SurfaceReceiptStatus,
} from '../../../../domain/surface/application/surface-response/index.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';

type CodexRemoteActionExecutor = Pick<CodexRemoteActionService, 'execute'>;

export type TelegramCodexRemotePermissionApprovalServiceDeps = {
  codexRemoteActionService?: CodexRemoteActionExecutor;
};

export class TelegramCodexRemotePermissionApprovalService {
  private readonly codexRemoteActions: CodexRemoteActionExecutor;

  constructor(deps: TelegramCodexRemotePermissionApprovalServiceDeps = {}) {
    this.codexRemoteActions = deps.codexRemoteActionService || new CodexRemoteActionService();
  }

  public async finalizeApproval(
    ctx: Context,
    approved: PermissionRequest,
    userId: string,
  ): Promise<boolean> {
    if (approved.executor !== 'codex_remote') {
      return false;
    }

    const result = await this.codexRemoteActions.execute({
      actionId: 'approve-permission',
      permissionId: approved.permission_id,
      runtimeUserId: userId,
      skipApproval: true,
    });

    const lines = [
      result.action.note,
      result.permission?.permission_id
        ? `Permission: ${result.permission.permission_id} (${result.permission.status}).`
        : null,
      result.session
        ? `${result.session.record.title} (${result.session.record.sessionId})`
        : null,
      result.session?.operatorSummary || null,
      result.session?.record.handoffCommand
        ? `Handoff web: ${result.session.record.handoffCommand}`
        : null,
    ].filter(Boolean);

    await replyWithTelegramSurfaceResponse(
      ctx,
      createSurfaceResponse({
        id: `codex-remote-permission-${approved.permission_id}`,
        intent: 'receipt',
        title: 'Codex Remote action receipt',
        summary: result.action.note,
        tone: result.action.status === 'rejected' ? 'danger' : 'success',
        blocks: [
          {
            kind: 'text',
            text: lines.join('\n'),
          },
        ],
        receipts: [
          {
            id: result.permission?.permission_id || approved.permission_id,
            title: result.action.label || 'Codex Remote',
            status: mapCodexRemoteReceiptStatus(result.action.status, result.permission?.status),
            reason: result.action.note,
            policyProfile: 'codex_remote',
            redacted: true,
            riskBlocked: result.action.status === 'rejected' || result.permission?.status === 'rejected',
            metadata: {
              actionId: result.action.actionId,
              sessionId: result.session?.record.sessionId || null,
              profileId: result.profile?.id || null,
            },
          },
        ],
      }),
    );
    return true;
  }
}

function mapCodexRemoteReceiptStatus(
  actionStatus: string | undefined,
  permissionStatus: string | undefined,
): SurfaceReceiptStatus {
  if (permissionStatus === 'approved') {
    return 'allowed';
  }
  if (permissionStatus === 'rejected' || actionStatus === 'rejected') {
    return 'denied';
  }
  if (actionStatus === 'pending-approval') {
    return 'require_user_confirmation';
  }
  return actionStatus === 'completed' ? 'done' : 'failed';
}
