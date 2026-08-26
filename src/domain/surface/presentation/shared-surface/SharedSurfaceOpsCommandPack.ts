import type { Context } from 'grammy';
import type { ParsedCommand } from '../../../../channels/commands/ChannelCommandParser.js';
import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';

export type SurfaceOpsIO = {
  reply(text: string): Promise<unknown>;
  userId?: string;
  chatId?: string;
};

export type SharedSurfaceOpsPort = {
  handleStatus: (ctx: Context) => Promise<void>;
  handleModels: (ctx: Context) => Promise<void>;
  handleAudit: (ctx: Context, args: string) => Promise<void>;
  handleChanges: (ctx: Context) => Promise<void>;
  handleReadiness: (ctx: Context) => Promise<void>;
  handleZavorthControl: (ctx: Context) => Promise<void>;
  handleDashboard: (ctx: Context) => Promise<void>;
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

    const sharedIo: SurfaceOpsIO = {
      reply: (text: string) => input.context.reply(text),
      userId: input.context.userId,
      chatId: input.context.chatId,
    };
    const grammyContextSeam = sharedIo as unknown as Context;

    switch (commandType) {
      case '/status':
        await this.deps.opsController.handleStatus(grammyContextSeam);
        return true;
      case '/models':
        await this.deps.opsController.handleModels(grammyContextSeam);
        return true;
      case '/audit':
        await this.deps.opsController.handleAudit(grammyContextSeam, String(input.parsedCommand.command_args || ''));
        return true;
      case '/changes':
        await this.deps.opsController.handleChanges(grammyContextSeam);
        return true;
      case '/readiness':
        await this.deps.opsController.handleReadiness(grammyContextSeam);
        return true;
      case '/zavorthControl':
        await this.deps.opsController.handleZavorthControl(grammyContextSeam);
        return true;
      case '/dashboard':
        await this.deps.opsController.handleDashboard(grammyContextSeam);
        return true;
      default:
        return false;
    }
  }
}
