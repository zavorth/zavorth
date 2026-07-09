import { InlineKeyboard, type Context, Api } from 'grammy';
import { config } from '@zavorth/config/index.js';
import { PermissionRequest } from '@zavorth/contracts/PermissionRequest.js';
import { Task } from '@zavorth/contracts/TaskContract.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import {
  ZavorthBridgePromptCompletionResult,
  ZavorthBridgePromptService,
  type ZavorthBridgePromptStartResult,
} from '@zavorth/services/ZavorthBridgePromptService.js';
import { PermissionService } from '@zavorth/services/PermissionService.js';

import { SmartOutputService } from '@zavorth/services/SmartOutputService.js';
import { TenantContextService } from '@zavorth/services/TenantContextService.js';
import { ZavorthBridgeWindowAutomatorLike } from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeService.js';
import { asErrorLike } from '../../../../utils/errorLike.js';
type BotApiLike = Api;

// Bridge interface that matches SmartOutputService.send's expected botApi shape
type SmartOutputCompatibleBotApi = {
  sendMessage(chatId: string | number, text: string, options?: Record<string, unknown>): Promise<unknown>;
  sendDocument?(chatId: string | number, document: unknown, options?: Record<string, unknown>): Promise<unknown>;
};

type ZavorthBridgePermissionFactory = (
  task: Task,
  startResult: ZavorthBridgePromptStartResult,
  completion: ZavorthBridgePromptCompletionResult,
) => Promise<PermissionRequest>;

type TelegramZavorthBridgePromptWorkflowServiceDeps = {
  taskManager: Pick<TaskManager, 'createPendingTask' | 'advanceState'>;
  zavorthBridgePromptService: ZavorthBridgePromptService;
  permissionService: Pick<PermissionService, 'findApprovedRequest'>;
  botApi: BotApiLike;
  persistTask: (task: Task) => void;
  truncateForTelegram: (content: string, maxLength: number) => string;
  createPermissionRequest: ZavorthBridgePermissionFactory;
  formatPermissionCreatedMessage: (permission: PermissionRequest) => string;
  buildPermissionKeyboard: (permission: PermissionRequest) => InlineKeyboard;
  shortPermissionId: (permission: PermissionRequest) => string;
  createWindowAutomator?: () => Pick<
    ZavorthBridgeWindowAutomatorLike,
    'approveVisibleStep' | 'waitForPermissionPromptToClear'
  >;
};

export class TelegramZavorthBridgePromptWorkflowService {
  constructor(private readonly deps: TelegramZavorthBridgePromptWorkflowServiceDeps) {}

  public async handlePrompt(ctx: Context, model: string, prompt: string): Promise<void> {
    const normalizedModel = String(model || '').trim();
    const normalizedPrompt = String(prompt || '').trim();

    if (!normalizedModel || !normalizedPrompt) {
      await ctx.reply(
        'Use /ag_prompt <model> | <prompt>.\nExample: /ag_prompt gemini-3.1-flash | answer only with TEST ZAVORTH OK',
      );
      return;
    }

    const chatId = ctx.chat?.id.toString() || '';
    const userId = ctx.from?.id.toString() || '';
    const task = this.deps.taskManager.createPendingTask(
      chatId,
      userId,
      `/ag_prompt ${normalizedModel} | ${normalizedPrompt}`,
      `/ag_prompt ${normalizedModel} | ${normalizedPrompt}`.toLowerCase(),
      '/ag_prompt',
    );

    task.intent = 'zavorthBridge_prompt';
    task.workspace = config.defaultWorkspace;
    task.executor_used = 'zavorthBridge_prompt_service';
    task.metadata = {
      ...(task.metadata || {}),
      zavorthBridgePromptModel: normalizedModel,
      zavorthBridgePromptText: normalizedPrompt,
    };
    this.deps.persistTask(task);
    this.deps.taskManager.advanceState(task, 'parsed');

    await ctx.reply(
      `Perfect. I will prepare ZavorthBridge with model ${normalizedModel} and send your request there.`,
    );

    try {
      const startResult = await this.deps.zavorthBridgePromptService.start(
        task,
        normalizedModel,
        normalizedPrompt,
        task.workspace || config.defaultWorkspace,
      );

      if (!startResult.ok) {
        task.error_summary = startResult.errorMessage || startResult.message || 'Failed to start prompt in ZavorthBridge.';
        this.deps.persistTask(task);
        this.deps.taskManager.advanceState(task, 'failed');
        await ctx.reply(this.formatPromptStartFailure(startResult));
        return;
      }

      this.deps.taskManager.advanceState(task, 'running');
      task.metadata = {
        ...(task.metadata || {}),
        zavorthBridgeStartResult: startResult,
      };
      this.deps.persistTask(task);
      await ctx.reply(
        [
          'Done. Your request has been sent to ZavorthBridge.',
          `Model in use: ${startResult.selectedModel || normalizedModel}`,
          'Now I will follow the real response from the app and bring it back here on Telegram.',
          '',
          `Technical details: task=${task.task_id.substring(0, 8)} | tracking=${startResult.trackingFile}`,
        ].join('\n'),
      );

      void this.finishPrompt(task, startResult);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMsg = error instanceof Error ? err.message : String(error);
      task.error_summary = errorMsg;
      this.deps.persistTask(task);
      this.deps.taskManager.advanceState(task, 'failed');
      await ctx.reply(`Could not start this request in ZavorthBridge right now.\n\nReason: ${errorMsg}`);
    }
  }

  public async finishPrompt(task: Task, startResult: ZavorthBridgePromptStartResult): Promise<void> {
    try {
      const completion = await this.deps.zavorthBridgePromptService.waitForCompletion(startResult);
      if (completion.ok) {
        task.result_summary = completion.text ? this.deps.truncateForTelegram(completion.text, 800) : null;
        this.deps.persistTask(task);
        this.deps.taskManager.advanceState(task, 'completed');
      } else if (completion.errorCode === 'permission_prompt_visible') {
        const autoApprovalPolicy = await this.deps.permissionService.findApprovedRequest(
          'zavorthBridge',
          'ui_permission',
          task.workspace || config.defaultWorkspace,
          TenantContextService.buildPermissionMetadataMatchFromTask(task) as any,
        );
        const alreadyAutoApproved = Boolean(task.metadata?.zavorthBridgeAutoPermissionApplied);

        if (autoApprovalPolicy && !alreadyAutoApproved) {
          const automator = this.createWindowAutomator();
          const targetProcessId = Number(
            task.metadata?.zavorthBridgeCompanionProcessId ||
              startResult.processId ||
              0,
          );
          const approvalMode = this.resolveAutoApprovalMode(autoApprovalPolicy.scope);
          await automator.approveVisibleStep(0, approvalMode, targetProcessId);
          const cleared = await automator.waitForPermissionPromptToClear(targetProcessId);
          if (!cleared) {
            throw new Error('The ZavorthBridge permission prompt remained visible after the automatic policy.');
          }
          task.metadata = {
            ...(task.metadata || {}),
            zavorthBridgeAutoPermissionApplied: autoApprovalPolicy.permission_id,
            zavorthBridgeAutoPermissionMode: approvalMode,
          };
          this.deps.persistTask(task);
          await this.deps.botApi.sendMessage(
            task.chat_id,
            `Persistent policy automatically applied for ZavorthBridge (${this.deps.shortPermissionId(autoApprovalPolicy)}). I will continue tracking the response.`,
          );
          await this.finishPrompt(task, startResult);
          return;
        }

        const permission = await this.deps.createPermissionRequest(task, startResult, completion);
        task.requires_approval = true;
        task.approval_status = 'pending';
        task.metadata = {
          ...(task.metadata || {}),
          pendingPermissionId: permission.permission_id,
        };
        this.deps.persistTask(task);
        this.deps.taskManager.advanceState(task, 'waiting_approval');
        await this.deps.botApi.sendMessage(
          task.chat_id,
          this.deps.formatPermissionCreatedMessage(permission),
          { reply_markup: this.deps.buildPermissionKeyboard(permission) },
        );
        return;
      } else {
        task.error_summary = completion.errorMessage || 'ZavorthBridge did not return a final response within the time limit.';
        this.deps.persistTask(task);
        this.deps.taskManager.advanceState(task, 'failed');
      }

      await SmartOutputService.send(
        this.deps.botApi as unknown as SmartOutputCompatibleBotApi,
        task.chat_id,
        this.formatPromptCompletion(task, completion),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMsg = error instanceof Error ? err.message : String(error);
      task.error_summary = errorMsg;
      this.deps.persistTask(task);
      this.deps.taskManager.advanceState(task, 'failed');
      await SmartOutputService.send(
        this.deps.botApi as unknown as SmartOutputCompatibleBotApi,
        task.chat_id,
        `I could not track the final ZavorthBridge response for this task.\n\nReason: ${errorMsg}\nTechnical detail: task=${task.task_id.substring(0, 8)}`,
      );
    }
  }

  private createWindowAutomator(): Pick<
    ZavorthBridgeWindowAutomatorLike,
    'approveVisibleStep' | 'waitForPermissionPromptToClear'
  > {
    if (this.deps.createWindowAutomator) {
      return this.deps.createWindowAutomator();
    }

    throw new Error('ZavorthBridge automation is unavailable for visual auto-approval.');
  }

  private formatPromptStartFailure(result: ZavorthBridgePromptStartResult): string {
    const lines = ['I could not start this request in ZavorthBridge.'];
    lines.push(`Stopped at phase: ${result.phase}`);
    if (result.selectedModel) lines.push(`Requested model: ${result.selectedModel}`);
    if (typeof result.remoteModeActive === 'boolean') lines.push(`Remote mode: ${result.remoteModeActive ? 'active' : 'inactive'}`);
    if (typeof result.sessionAccessible === 'boolean') lines.push(`Session accessible: ${result.sessionAccessible ? 'yes' : 'no'}`);
    if (result.desktopName) lines.push(`Current desktop: ${result.desktopName}`);
    if (result.sessionMessage) lines.push(result.sessionMessage);
    if (result.message) lines.push(result.message);
    if (result.errorMessage) lines.push(result.errorMessage);
    if (result.errorCode) lines.push(`Technical detail: ${result.errorCode}`);
    if (result.logFile) lines.push(`Log: ${result.logFile}`);
    return lines.join('\n');
  }

  private formatPromptCompletion(task: Task, completion: ZavorthBridgePromptCompletionResult): string {
    const lines = [
      completion.text
        ? 'Done. Here is the ZavorthBridge response.'
        : 'I could not capture a complete final ZavorthBridge response.',
    ];
    lines.push(`Short reference: ${task.task_id.substring(0, 8)}`);

    if (completion.selectedModel) {
      lines.push(`Model used: ${completion.selectedModel}`);
    }
    if (completion.partial) {
      lines.push('Note: I could capture a partial response, but it is not confirmed as final yet.');
    }
    if (completion.errorMessage) {
      lines.push(completion.errorMessage);
    }
    if (completion.text) {
      lines.push('', this.deps.truncateForTelegram(completion.text, 3200));
    }

    const technicalParts: string[] = [
      `phase=${completion.phase}`,
      `source=${completion.source}`,
      `verified=${completion.verified ? 'yes' : 'no'}`,
    ];
    if (completion.artifactType) technicalParts.push(`artifact=${completion.artifactType}`);
    if (completion.errorCode) technicalParts.push(`error=${completion.errorCode}`);
    if (technicalParts.length > 0) {
      lines.push('', `Technical details: ${technicalParts.join(' | ')}`);
    }

    return lines.join('\n');
  }

  private resolveAutoApprovalMode(scope: string | null | undefined): 'once' | 'conversation' {
    const normalized = String(scope || '').trim().toLowerCase();
    if (normalized === 'session' || normalized === 'workspace' || normalized === 'persistent') {
      return 'conversation';
    }
    return 'once';
  }
}
