import { Context, InlineKeyboard } from 'grammy';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { Task } from '../../../../contracts/TaskContract.js';
import { FileInspectionPlan, FileInspectionService } from '../../../../services/FileInspectionService.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { SmartOutputService } from '../../../../services/SmartOutputService.js';
import { config } from '../../../../config/index.js';

type TelegramInspectionPermissionServiceDeps = {
  fileInspectionService: FileInspectionService;
  permissionService?: PermissionService;
  buildPermissionKeyboard?: (permission: PermissionRequest) => InlineKeyboard;
  formatPermissionCreatedMessage?: (permission: PermissionRequest) => string;
};

export class TelegramInspectionPermissionService {
  constructor(private readonly deps: TelegramInspectionPermissionServiceDeps) {}

  public shouldHandleNaturalInspection(args: string, resolvedTask?: Task): boolean {
    const normalized = String(args || '').trim();
    if (!normalized || resolvedTask) {
      return false;
    }

    return this.deps.fileInspectionService.shouldHandleNaturalQuery(normalized);
  }

  public async handleNaturalInspection(ctx: Context, rawRequest: string): Promise<void> {
    const allowedPaths = await this.getApprovedInspectionPaths();
    await this.prepareAndDeliver(ctx, rawRequest, allowedPaths);
  }

  public async handleApprovedPermission(ctx: Context, permission: PermissionRequest): Promise<boolean> {
    if (
      permission.executor !== 'file_delivery' ||
      permission.kind !== 'workspace_access' ||
      permission.metadata?.permission_source !== 'file_inspection'
    ) {
      return false;
    }

    const originalRequest = String(permission.metadata?.original_request || '').trim();
    const allowedPath = String(permission.resolved_value || permission.requested_value || '').trim();
    if (!originalRequest || !allowedPath) {
      await ctx.reply('A permissao foi aprovada, mas eu perdi a consulta original de inspecao.');
      return true;
    }

    await this.prepareAndDeliver(ctx, originalRequest, [allowedPath]);
    return true;
  }

  private async prepareAndDeliver(
    ctx: Context,
    rawRequest: string,
    extraAllowedPaths: string[],
  ): Promise<void> {
    const plan = await this.deps.fileInspectionService.prepare(rawRequest, {
      extraAllowedPaths,
    });
    await this.deliverInspectionPlan(ctx, plan, rawRequest);
  }

  private async deliverInspectionPlan(
    ctx: Context,
    plan: FileInspectionPlan,
    originalRequest: string,
  ): Promise<void> {
    if (plan.kind === 'message' || plan.kind === 'result') {
      await SmartOutputService.reply(ctx, plan.text);
      return;
    }

    if (!this.deps.permissionService) {
      await ctx.reply(`Preciso de permissao para inspecionar este caminho especifico:\n${plan.previewPath}`);
      return;
    }

    const permission = await this.deps.permissionService.createRequest({
      executor: 'file_delivery',
      kind: 'workspace_access',
      scope: 'once',
      workspace: config.defaultWorkspace,
      requested_value: plan.requestedPath,
      resolved_value: plan.requestedPath,
      reason: plan.reason,
      requested_by: ctx.from?.id?.toString() || '',
      metadata: {
        original_request: originalRequest,
        requested_by: ctx.from?.id?.toString() || '',
        permission_source: 'file_inspection',
        access_level: 'read_only',
      },
    });
    const text =
      this.deps.formatPermissionCreatedMessage?.(permission) ||
      `O Zavorth precisa da sua decisao para inspecionar ${plan.previewPath}.`;
    const keyboard = this.deps.buildPermissionKeyboard?.(permission);
    await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined);
  }

  private async getApprovedInspectionPaths(): Promise<string[]> {
    if (!this.deps.permissionService) {
      return [];
    }

    const policies = await this.deps.permissionService.listApprovedRequests(
      'file_delivery',
      'workspace_access',
      config.defaultWorkspace,
    );

    return policies
      .filter((policy) => policy.scope !== 'once')
      .map((policy) => String(policy.resolved_value || policy.requested_value || '').trim())
      .filter(Boolean);
  }
}
