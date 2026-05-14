import { Context } from 'grammy';
import type { ZavorthBridgeControlAction } from '../services/ZavorthBridgeControlService.js';
import type { RemoteModeCommand as ParsedRemoteModeCommand } from '../services/RemoteModeManager.js';

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
};

export class TelegramPriorityCommandService {
  constructor(private readonly deps: TelegramPriorityCommandServiceDeps) {}

  public async handle(ctx: Context, text: string): Promise<boolean> {
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
      await ctx.reply('\u{1F512} Zavorth trancado. Use /unlock <senha> para destrancar.');
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

    const redirectedModel = this.resolveRawModelSet(text);
    if (redirectedModel) {
      await ctx.reply(
        `Comando direto reconhecido. Redirecionando para o fluxo de troca de modelo (/agmodel ${redirectedModel})...`,
      );
      await this.deps.zavorthBridgeController.handleModelCommand(ctx, redirectedModel);
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
