import { Context } from 'grammy';
import { config } from '../../config/index.js';
import { Task } from '../../contracts/TaskContract.js';
import { TaskManager } from '../../orchestrator/TaskManager.js';
import { ExecutionGateway } from '../../execution/ExecutionGateway.js';
import { AuditLogger } from '../../monitoring/AuditLogger.js';
import {
  SelfModificationCommandService,
} from '../../services/SelfModificationCommandService.js';
import { TelegramSelfModificationExecutionService } from './TelegramSelfModificationExecutionService.js';

type PersistTaskFn = (task: Task) => void;

type SelfModParsedCommand =
  | { mode: 'preview'; filePath: string; instruction: string }
  | { mode: 'goal'; goal: string }
  | { mode: 'apply'; previewId: string }
  | { mode: 'rollback'; changeId: string };

type TelegramSelfModificationControllerDeps = {
  taskManager: TaskManager;
  executionGateway: ExecutionGateway;
  auditLogger: AuditLogger;
  persistTask: PersistTaskFn;
  selfModificationService: SelfModificationCommandService;
};

export class TelegramSelfModificationController {
  private readonly executionService: TelegramSelfModificationExecutionService;

  constructor(private deps: TelegramSelfModificationControllerDeps) {
    this.executionService = new TelegramSelfModificationExecutionService({
      taskManager: this.deps.taskManager,
      executionGateway: this.deps.executionGateway,
      auditLogger: this.deps.auditLogger,
      persistTask: this.deps.persistTask,
      selfModificationService: this.deps.selfModificationService,
    });
  }

  public async handleCommand(ctx: Context, rawArgs: string): Promise<void> {
    const parsed = this.parseArgs(rawArgs);
    if (!parsed) {
      await ctx.reply(this.getUsageText());
      return;
    }

    if (ctx.chat?.type !== 'private') {
      await ctx.reply('O /selfmod so pode ser usado em chat privado com o Zavorth.');
      return;
    }

    const modeManager = this.deps.executionGateway.getModeManager();
    if (!modeManager.isSufficientFor('exec')) {
      await ctx.reply(
        `Modo operacional insuficiente. /selfmod exige modo BUILD.\nModo atual: ${modeManager.getMode()}\n\nUse /mode BUILD para habilitar.`,
      );
      return;
    }

    const chatId = ctx.chat?.id?.toString() || '';
    const userId = ctx.from?.id?.toString() || '';
    const canApplyChanges = this.canApplySelfModification(userId);
    if ((parsed.mode === 'apply' || parsed.mode === 'rollback') && !canApplyChanges) {
      await ctx.reply(
        'Voce pode gerar propostas com /selfmod, mas aplicar ou reverter mudancas reais exige papel owner/trusted.',
      );
      return;
    }
    const rawMessage = `/selfmod ${rawArgs}`.trim();
    const task = this.deps.taskManager.createPendingTask(
      chatId,
      userId,
      rawMessage,
      rawMessage.toLowerCase(),
      '/selfmod',
    );

    task.intent = 'self_modification';
    task.workspace = config.defaultWorkspace;
    task.executor_used = 'selfmod';
    task.requires_planning = false;
    task.requires_approval = false;
    task.risk_level = parsed.mode === 'preview' ? 1 : 2;
    task.metadata = {
      ...(task.metadata || {}),
      selfmod_mode: parsed.mode,
      ...(parsed.mode === 'preview'
        ? { target_file: parsed.filePath }
        : parsed.mode === 'goal'
          ? { selfmod_goal: parsed.goal }
          : parsed.mode === 'rollback'
            ? { change_id: parsed.changeId }
            : { preview_id: parsed.previewId }),
    };
    this.deps.persistTask(task);
    this.deps.taskManager.advanceState(task, 'parsed');

    if (parsed.mode === 'preview') {
      await this.executionService.runPreview(ctx, task, parsed.filePath, parsed.instruction, userId);
      return;
    }

    if (parsed.mode === 'goal') {
      await this.executionService.runGoalPreview(ctx, task, parsed.goal, userId);
      return;
    }

    if (parsed.mode === 'rollback') {
      await this.executionService.runRollback(ctx, task, parsed.changeId, userId);
      return;
    }

    await this.executionService.runApply(ctx, task, parsed.previewId, userId);
  }

  public parseArgs(rawArgs: string): SelfModParsedCommand | null {
    const trimmed = String(rawArgs || '').trim();
    if (!trimmed) {
      return null;
    }

    const applyMatch = trimmed.match(/^apply\s+([a-z0-9_-]{6,})$/i);
    if (applyMatch) {
      return {
        mode: 'apply',
        previewId: applyMatch[1].trim(),
      };
    }

    const rollbackMatch = trimmed.match(/^rollback\s+([a-z0-9_-]{6,})$/i);
    if (rollbackMatch) {
      return {
        mode: 'rollback',
        changeId: rollbackMatch[1].trim(),
      };
    }

    const goalMatch = trimmed.match(/^goal\s+--\s+([\s\S]+)$/i);
    if (goalMatch) {
      return {
        mode: 'goal',
        goal: goalMatch[1].trim(),
      };
    }

    const previewInput = trimmed.replace(/^preview\s+/i, '').trim();
    const separatorIndex = previewInput.indexOf('--');
    if (separatorIndex === -1) {
      return null;
    }

    const filePath = previewInput.slice(0, separatorIndex).trim();
    const instruction = previewInput.slice(separatorIndex + 2).trim();

    if (!filePath || !instruction) {
      return null;
    }

    return {
      mode: 'preview',
      filePath,
      instruction,
    };
  }

  public getUsageText(): string {
    return [
      'Uso:',
      '/selfmod <arquivo_relativo> -- <instrucao>',
      '/selfmod preview <arquivo_relativo> -- <instrucao>',
      '/selfmod goal -- <objetivo>',
      '/selfmod apply <preview_id>',
      '/selfmod rollback <change_id>',
      '',
      'Exemplos:',
      '/selfmod src/telegram/AuthGuard.ts -- bloquear tambem /selfmod para vice-owner',
      '/selfmod goal -- criar uma capability nova para media sob demanda',
      '/selfmod apply 123e4567-e89b-12d3-a456-426614174000',
    ].join('\n');
  }

  private canApplySelfModification(userId: string): boolean {
    const roles = (config.telegramUserRoles[userId] || [])
      .map((role) => String(role || '').trim().toLowerCase())
      .filter(Boolean);
    return roles.some((role) => ['owner', 'trusted'].includes(role));
  }
}
