import { Context } from 'grammy';
import { config } from '@zavorth/config/index.js';
import { PermissionRequest } from '@zavorth/contracts/PermissionRequest.js';
import { PermissionService } from '@zavorth/services/PermissionService.js';
import { TelegramPermissionDecisionService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';
import { TelegramPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';
import { TelegramPermissionPresentationService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPresentationService.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';

export type TelegramPermissionMutationServiceDeps = {
  permissionService: PermissionService;
  permissionPolicy: TelegramPermissionPolicyService;
  permissionPresentation: TelegramPermissionPresentationService;
  permissionDecision: TelegramPermissionDecisionService;
  resolvePermissionReference: (ref: string) => Promise<PermissionRequest>;
  assertHostWritable: () => void;
};

export class TelegramPermissionMutationService {
  constructor(private readonly deps: TelegramPermissionMutationServiceDeps) {}

  public async handlePermissionAllowCommand(ctx: Context, args: string): Promise<void> {
    this.deps.assertHostWritable();
    const assignments = this.extractPermissionAssignments(args);
    const executor = String(assignments.executor || '').trim().toLowerCase();
    const rawKind = String(assignments.kind || '').trim().toLowerCase();
    const requestedValue = String(
      assignments.value || assignments.path || assignments.command || '',
    ).trim();
    const kind = this.deps.permissionPolicy.normalizePermissionKind(rawKind);
    const scope = this.deps.permissionPolicy.normalizePermissionScope(assignments.scope || 'persistent');
    const policyMetadata = this.deps.permissionPolicy.extractPermissionPolicyMetadata(
      assignments,
      kind,
    );
    const value =
      requestedValue ||
      (kind === 'ui_permission'
        ? this.deps.permissionDecision.resolveZavorthBridgeApprovalCommand(undefined, scope)
        : '');
    const workspace = String(assignments.workspace || config.defaultWorkspace).trim();
    const externalExecutorAgentRole =
      this.deps.permissionPolicy.resolveExternalExecutorAgentRoleFromInput(assignments);
    const userId = ctx.from?.id.toString() || '';

    if (!executor || !rawKind || !value) {
      await ctx.reply(
        'Use /permallow executor=<nome> kind=<folder|command|ui> value="..." scope=<once|session|workspace|persistent> [workspace="..."] [access=<read_only|read_write>] [match=<exact|prefix>].',
      );
      return;
    }

    const policy = await this.deps.permissionService.grantPolicy({
      executor,
      kind,
      scope,
      workspace: scope === 'workspace' ? workspace : null,
      requested_value: value,
      resolved_value: value,
      reason: `Politica persistente criada manualmente para ${executor}/${kind}.`,
      requested_by: userId,
      metadata: {
        created_via: 'telegram_permallow',
        raw_kind: rawKind,
        ...policyMetadata,
        ...(executor === 'external_executor' && kind === 'agent_binding'
          ? { agent_role: externalExecutorAgentRole }
          : {}),
      },
    });

    await replyWithTelegramSurfaceResponse(
      ctx,
      this.deps.permissionPresentation.buildPermissionDecisionSurfaceResponse(policy, 'approve'),
    );
  }

  public async handlePermissionRevokeCommand(ctx: Context, args: string): Promise<void> {
    this.deps.assertHostWritable();
    const userId = ctx.from?.id.toString() || '';
    const [reference, ...noteParts] = String(args || '').trim().split(/\s+/).filter(Boolean);
    const permission = await this.deps.resolvePermissionReference(reference || '');
    const note = noteParts.join(' ').trim() || 'Politica revogada pelo operador.';
    const revoked = await this.deps.permissionService.rejectRequest(permission.permission_id, userId, note);
    await replyWithTelegramSurfaceResponse(
      ctx,
      this.deps.permissionPresentation.buildPermissionDecisionSurfaceResponse(revoked, 'reject'),
    );
  }

  public async handleEditCommand(
    ctx: Context,
    reference: string,
    rawPatch: string,
  ): Promise<void> {
    const permission = await this.deps.resolvePermissionReference(reference || '');
    const patch = this.deps.permissionPolicy.applyPermissionPolicyHints(
      permission,
      this.parsePermissionPatch(rawPatch),
    );
    const updated = await this.deps.permissionService.updateRequest(permission.permission_id, patch as any);
    await replyWithTelegramSurfaceResponse(
      ctx,
      this.deps.permissionPresentation.buildPermissionDecisionSurfaceResponse(updated, 'edit'),
    );
  }

  public async handleApproveCommand(
    ctx: Context,
    reference: string,
    rawPatch: string,
    userId: string,
  ): Promise<void> {
    this.deps.assertHostWritable();
    const permission = await this.deps.resolvePermissionReference(reference || '');
    const patch = this.deps.permissionPolicy.applyPermissionPolicyHints(
      permission,
      this.parsePermissionPatch(rawPatch),
    );
    if (!patch.resolved_value && permission.executor === 'external_executor') {
      patch.resolved_value =
        permission.resolved_value ||
        String(permission.metadata?.suggested_agent_id || config.externalExecutorAgentId || 'main');
    }

    await this.deps.permissionDecision.applyPermissionApproval(ctx, permission, patch, userId);
  }

  public async handleRejectCommand(
    ctx: Context,
    reference: string,
    reason: string,
    userId: string,
  ): Promise<void> {
    this.deps.assertHostWritable();
    const permission = await this.deps.resolvePermissionReference(reference || '');
    await this.deps.permissionDecision.applyPermissionRejection(
      ctx,
      permission,
      userId,
      reason || 'Rejected by explicit command',
    );
  }

  public parsePermissionPatch(input: string): Record<string, any> {
    const assignments: Record<string, any> = {};
    if (!input) {
      return assignments;
    }

    const regex = /([a-zA-Z_]+)=("[^"]+"|'[^']+'|\S+)/g;
    const source = String(input || '');

    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(source)) !== null) {
      const key = match[1].toLowerCase();
      const value = match[2].replace(/^['"]|['"]$/g, '');
      assignments[key] = value;
    }

    const policyMetadata = this.deps.permissionPolicy.extractPermissionPolicyMetadata(
      assignments,
      String(assignments.kind || '').trim().toLowerCase() || null,
    );
    if (Object.keys(policyMetadata).length > 0) {
      assignments.metadata = {
        ...(assignments.metadata || {}),
        ...policyMetadata,
      };
    }

    return assignments;
  }

  private extractPermissionAssignments(input: string): Record<string, string> {
    const assignments: Record<string, string> = {};
    const regex = /([a-zA-Z_]+)=("[^"]+"|'[^']+'|\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(String(input || ''))) !== null) {
      assignments[match[1].toLowerCase()] = match[2].replace(/^['"]|['"]$/g, '');
    }
    return assignments;
  }
}
