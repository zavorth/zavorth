import { Context } from 'grammy';
import type { ZavorthBridgeControlAction } from '@zavorth/services/ZavorthBridgeControlService.js';
import type { RemoteModeCommand as ParsedRemoteModeCommand } from '@zavorth/services/RemoteModeManager.js';
import { t } from '../../../gateways/channels/telegram/i18n.js';
import { TelegramIntentClassifier, type ClassifiedIntent } from '../../../gateways/channels/telegram/controllers/TelegramIntentClassifier.js';

type RemoteModeCommand = ParsedRemoteModeCommand | null;
type RuntimeMaintenanceCommand = {
  action: 'changes' | 'autorepair' | 'reload';
  dryRun?: boolean;
  improve?: boolean;
  force?: boolean;
} | null;
type ZavorthBridgePromptCommand = {
  model: string;
  prompt: string;
} | null;
type ZavorthBridgeControlCommand = {
  action: ZavorthBridgeControlAction;
  model?: string;
} | null;

export type TelegramPriorityCommandServiceDeps = {
  opsController: {
    parseRemoteModeCommand: (text: string) => RemoteModeCommand;
    parseRuntimeMaintenanceCommand: (text: string) => RuntimeMaintenanceCommand;
    handleRemoteMode: (ctx: Context, command: ParsedRemoteModeCommand) => Promise<void>;
    handleChanges: (ctx: Context) => Promise<void>;
    handleAutoRepair: (ctx: Context, args: string) => Promise<void>;
    handleSelfUpdate: (ctx: Context, args: string) => Promise<void>;
  };
  zavorthBridgeController: {
    parsePromptCommand: (text: string) => ZavorthBridgePromptCommand;
    parseControlCommand: (text: string) => ZavorthBridgeControlCommand;
    handlePrompt: (ctx: Context, model: string, prompt: string) => Promise<void>;
    handleControl: (ctx: Context, action: ZavorthBridgeControlAction, model?: string) => Promise<void>;
    handleModelCommand: (ctx: Context, model: string) => Promise<void>;
  };
  securityLock: {
    isLocked: () => boolean;
  };
  intentClassifier?: TelegramIntentClassifier;
};

export class TelegramPriorityCommandService {
  constructor(private readonly deps: TelegramPriorityCommandServiceDeps) {}

  public async handle(ctx: Context, text: string): Promise<boolean> {
    // Try regex-based parsing first (fast path for explicit commands)
    const remoteModeCommand = this.deps.opsController.parseRemoteModeCommand(text);
    const runtimeMaintenanceCommand =
      this.deps.opsController.parseRuntimeMaintenanceCommand(text);
    const zavorthBridgePromptCommand = this.deps.zavorthBridgeController.parsePromptCommand(text);
    const zavorthBridgeControlCommand = this.deps.zavorthBridgeController.parseControlCommand(text);

    if (
      this.deps.securityLock.isLocked() &&
      (
        remoteModeCommand ||
        runtimeMaintenanceCommand ||
        zavorthBridgePromptCommand ||
        zavorthBridgeControlCommand
      )
    ) {
      await ctx.reply(t('security.locked'));
      return true;
    }

    if (remoteModeCommand) {
      await this.deps.opsController.handleRemoteMode(ctx, remoteModeCommand);
      return true;
    }

    if (runtimeMaintenanceCommand) {
      if (runtimeMaintenanceCommand.action === 'changes') {
        await this.deps.opsController.handleChanges(ctx);
      } else if (runtimeMaintenanceCommand.action === 'autorepair') {
        await this.deps.opsController.handleAutoRepair(
          ctx,
          this.resolveMaintenanceArgs(runtimeMaintenanceCommand),
        );
      } else {
        await this.deps.opsController.handleSelfUpdate(
          ctx,
          runtimeMaintenanceCommand.force ? 'force' : '',
        );
      }
      return true;
    }

    if (zavorthBridgePromptCommand) {
      await this.deps.zavorthBridgeController.handlePrompt(
        ctx,
        zavorthBridgePromptCommand.model,
        zavorthBridgePromptCommand.prompt,
      );
      return true;
    }

    if (zavorthBridgeControlCommand) {
      await this.deps.zavorthBridgeController.handleControl(
        ctx,
        zavorthBridgeControlCommand.action,
        zavorthBridgeControlCommand.model,
      );
      return true;
    }

    // If no regex match, try LLM-based intent classification (for natural language)
    if (this.deps.intentClassifier) {
      const intent = await this.deps.intentClassifier.classify(text);
      const handled = await this.handleClassifiedIntent(ctx, intent);
      if (handled) return true;
    }

    const redirectedModel = this.resolveRawModelSet(text);
    if (redirectedModel) {
      await ctx.reply(t('task.operator_mode_redirect', { model: redirectedModel }));
      await this.deps.zavorthBridgeController.handleModelCommand(ctx, redirectedModel);
      return true;
    }

    return false;
  }

  private async handleClassifiedIntent(ctx: Context, intent: ClassifiedIntent): Promise<boolean> {
    if (intent.type === 'unknown') return false;

    if (this.deps.securityLock.isLocked()) {
      await ctx.reply(t('security.locked'));
      return true;
    }

    switch (intent.type) {
      case 'remote_mode':
        await this.deps.opsController.handleRemoteMode(ctx, intent.action);
        return true;

      case 'runtime_maintenance':
        if (intent.action === 'changes') {
          await this.deps.opsController.handleChanges(ctx);
        } else if (intent.action === 'autorepair') {
          const args = intent.dryRun ? 'dryrun' : intent.improve ? 'improve' : intent.force ? 'force' : '';
          await this.deps.opsController.handleAutoRepair(ctx, args);
        } else {
          await this.deps.opsController.handleSelfUpdate(ctx, intent.force ? 'force' : '');
        }
        return true;

      case 'zavorth_bridge_prompt':
        await this.deps.zavorthBridgeController.handlePrompt(ctx, intent.model, intent.prompt);
        return true;

      case 'zavorth_bridge_control':
        await this.deps.zavorthBridgeController.handleControl(ctx, intent.action as ZavorthBridgeControlAction, intent.model);
        return true;

      default:
        return false;
    }
  }

  private resolveMaintenanceArgs(command: NonNullable<RuntimeMaintenanceCommand>): string {
    if (command.dryRun) {
      return 'dryrun';
    }
    if (command.improve) {
      return 'improve';
    }
    if (command.force) {
      return 'force';
    }
    return '';
  }

  private resolveRawModelSet(text: string): string | null {
    const lowerTrimmed = text.toLowerCase().trim();
    const isRawModelSet = lowerTrimmed.match(
      /^[+\s]*(use )?(o )?(modelo )?(gemini[- ]?3\.1[- ]?pro[- ]?high|gemini[- ]?3[- ]?flash|gemini[- ]?3\.1[- ]?pro[- ]?low|gemini[- ]?1\.5[- ]?flash)$/i,
    );
    if (!isRawModelSet) {
      return null;
    }

    if (lowerTrimmed.includes('flash')) {
      return 'Gemini 3 Flash';
    }
    if (lowerTrimmed.includes('low')) {
      return 'Gemini 3.1 Pro (Low)';
    }
    return 'Gemini 3.1 Pro (High)';
  }
}
