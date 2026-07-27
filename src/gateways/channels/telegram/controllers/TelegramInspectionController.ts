import { Context } from 'grammy';

import { PermissionRequest } from '@zavorth/contracts/PermissionRequest.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { FileInspectionService } from '@zavorth/services/FileInspectionService.js';
import { LogRepository } from '@zavorth/storage/LogRepository.js';
import { SmartOutputService } from '@zavorth/services/SmartOutputService.js';
import { PermissionService } from '@zavorth/services/PermissionService.js';
import { InlineKeyboard } from 'grammy';
import { TelegramInspectionPermissionService } from '../../../../gateways/channels/telegram/controllers/TelegramInspectionPermissionService.js';
import { safeParseInt } from '../../../../ai-gateway/shared/utils/safeParseInt.js';
import { TelegramInspectionTaskViewService } from '../../../../gateways/channels/telegram/controllers/TelegramInspectionTaskViewService.js';
import { t } from '../../../../gateways/channels/telegram/i18n.js';

export class TelegramInspectionController {
  private readonly fileInspectionService: FileInspectionService;
  private readonly inspectionPermissionService: TelegramInspectionPermissionService;
  private readonly taskViewService: TelegramInspectionTaskViewService;

  constructor(
    private taskManager: TaskManager,
    private logRepo: LogRepository,
    private deps: {
      permissionService?: PermissionService;
      buildPermissionKeyboard?: (permission: PermissionRequest) => InlineKeyboard;
      formatPermissionCreatedMessage?: (permission: PermissionRequest) => string;
    } = {},
    fileInspectionService: FileInspectionService = new FileInspectionService(),
  ) {
    this.fileInspectionService = fileInspectionService;
    this.taskViewService = new TelegramInspectionTaskViewService(this.taskManager);
    this.inspectionPermissionService = new TelegramInspectionPermissionService({
      fileInspectionService: this.fileInspectionService,
      permissionService: this.deps.permissionService,
      buildPermissionKeyboard: this.deps.buildPermissionKeyboard,
      formatPermissionCreatedMessage: this.deps.formatPermissionCreatedMessage,
    });
  }

  public async handleTasks(ctx: Context, args: string, userId: string): Promise<void> {
    return this.taskViewService.handleTasks(ctx, args, userId);
  }

  public async handleLogs(ctx: Context, args: string): Promise<void> {
    const limit = Math.max(1, Math.min(safeParseInt(args, 12), 30));
    const logs = this.logRepo.getRecentLogs(limit);

    if (logs.length === 0) {
      await ctx.reply(t('inspection.no_logs'));
      return;
    }

    const lines = logs.map((entry) => {
      const timestamp = (entry.timestamp || '').replace('T', ' ').slice(0, 19) || 'without-data';
      return `- [${entry.level.toUpperCase()}] ${timestamp} | ${entry.category}\n  ${this.truncateForTelegram(entry.message, 160)}`;
    });

    await SmartOutputService.reply(ctx, `Logs recentes (${logs.length})\n\n${lines.join('\n\n')}`);
  }

  public async handleTaskFiles(ctx: Context, args: string, userId: string): Promise<void> {
    const trimmedArgs = String(args || '').trim();
    const resolvedTask = this.taskViewService.resolveTaskReference(trimmedArgs, userId);
    if (this.inspectionPermissionService.shouldHandleNaturalInspection(trimmedArgs, resolvedTask)) {
      await this.inspectionPermissionService.handleNaturalInspection(ctx, trimmedArgs);
      return;
    }
    if (!resolvedTask) {
      await ctx.reply('Could not locate that task. Use /tasks to find the correct short ID or describe the inspection better.');
      return;
    }
    await this.taskViewService.renderTaskFiles(ctx, resolvedTask);
  }

  public shouldHandleNaturalInspection(args: string): boolean {
    return this.inspectionPermissionService.shouldHandleNaturalInspection(args);
  }

  public async handleApprovedPermission(ctx: Context, permission: PermissionRequest): Promise<boolean> {
    return this.inspectionPermissionService.handleApprovedPermission(ctx, permission);
  }

  public async handleTaskDiff(ctx: Context, args: string, userId: string): Promise<void> {
    return this.taskViewService.handleTaskDiff(ctx, args, userId);
  }

  private truncateForTelegram(content: string, maxLength: number): string {
    const text = String(content || '').trim();
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength)}\n[...]`;
  }
}
