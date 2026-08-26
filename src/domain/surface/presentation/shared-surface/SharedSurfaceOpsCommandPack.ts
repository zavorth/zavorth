import type { ParsedCommand } from '../../../../channels/commands/ChannelCommandParser.js';
import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';

export type SharedOpsContext = {
  reply(text: string, options?: unknown): Promise<unknown>;
  from?: { id?: number | string };
  chat?: { id?: number | string };
};

export type SharedSurfaceOpsPort = {
  handleStatus(ctx: SharedOpsContext): Promise<void>;
  handleModels(ctx: SharedOpsContext): Promise<void>;
  handleAudit(ctx: SharedOpsContext, args: string): Promise<void>;
  handleChanges(ctx: SharedOpsContext): Promise<void>;
  handleReadiness(ctx: SharedOpsContext): Promise<void>;
  handleZavorthControl(ctx: SharedOpsContext): Promise<void>;
  handleDashboard(ctx: SharedOpsContext): Promise<void>;
};

export type SharedSurfaceOpsCommandPackDeps = {
  opsController?: SharedSurfaceOpsPort | null;
};

export class SharedSurfaceOpsCommandPack {
  public readonly commandNames: readonly string[] = [
    '/status',
    '/models',
    '/audit',
    '/changes',
    '/readiness',
    '/zavorthControl',
    '/dashboard',
  ];

  public constructor(private readonly deps: SharedSurfaceOpsCommandPackDeps) {}

  public async handle(input: { context: IMessageContext; parsedCommand: ParsedCommand }): Promise<boolean> {
    const commandType = String(input.parsedCommand?.command_type || '').trim();
    if (!this.deps.opsController || !this.commandNames.includes(commandType)) {
      return false;
    }

    const sharedCtx: SharedOpsContext = {
      reply: (text: string, options?: unknown) => input.context.reply(text, options),
      from: input.context.userId ? { id: input.context.userId } : undefined,
      chat: input.context.chatId ? { id: input.context.chatId } : undefined,
    };

    switch (commandType) {
      case '/status':
        await this.deps.opsController.handleStatus(sharedCtx);
        return true;
      case '/models':
        await this.deps.opsController.handleModels(sharedCtx);
        return true;
      case '/audit':
        await this.deps.opsController.handleAudit(sharedCtx, String(input.parsedCommand.command_args || ''));
        return true;
      case '/changes':
        await this.deps.opsController.handleChanges(sharedCtx);
        return true;
      case '/readiness':
        await this.deps.opsController.handleReadiness(sharedCtx);
        return true;
      case '/zavorthControl':
        await this.deps.opsController.handleZavorthControl(sharedCtx);
        return true;
      case '/dashboard':
        await this.deps.opsController.handleDashboard(sharedCtx);
        return true;
      default:
        return false;
    }
  }
}
