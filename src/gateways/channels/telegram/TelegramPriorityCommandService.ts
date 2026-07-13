import { Context } from 'grammy';
import type { ZavorthBridgeControlAction } from '@zavorth/services/ZavorthBridgeControlService.js';
import type { RemoteModeCommand as ParsedRemoteModeCommand } from '@zavorth/services/RemoteModeManager.js';
import { t } from '../../../gateways/channels/telegram/i18n.js';

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

/**
 * Hermes-style priority path: only explicit slash (or slash-equivalent) commands.
 * Free-text natural language never steals the agent turn.
 */
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
};

export class TelegramPriorityCommandService {
  constructor(private readonly deps: TelegramPriorityCommandServiceDeps) {}

  public async handle(ctx: Context, text: string): Promise<boolean> {
    const trimmed = String(text || '').trim();
    // Free text always belongs to the agent (Hermes-style).
    if (!trimmed.startsWith('/')) {
      return false;
    }

    const remoteModeCommand = this.deps.opsController.parseRemoteModeCommand(trimmed);
    const runtimeMaintenanceCommand =
      this.deps.opsController.parseRuntimeMaintenanceCommand(trimmed);
    const zavorthBridgePromptCommand = this.deps.zavorthBridgeController.parsePromptCommand(trimmed);
    const zavorthBridgeControlCommand = this.deps.zavorthBridgeController.parseControlCommand(trimmed);

    if (
      this.deps.securityLock.isLocked()
      && (
        remoteModeCommand
        || runtimeMaintenanceCommand
        || zavorthBridgePromptCommand
        || zavorthBridgeControlCommand
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

    return false;
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
}
