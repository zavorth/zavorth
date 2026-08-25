import type { Context } from 'grammy';
import type { ParsedCommand } from '../../../../channels/commands/ChannelCommandParser.js';

export type GatewayMemoryCommandRouterDeps = {
  knowledgeController: {
    handleSave: (ctx: Context, args: string, userId: string) => Promise<void>;
    handleSnippet: (ctx: Context, args: string, userId: string) => Promise<void>;
    handleSnippets: (ctx: Context, userId: string) => Promise<void>;
    handleRemember: (ctx: Context, args: string, userId: string) => Promise<void>;
    handleRecall: (ctx: Context, args: string, userId: string) => Promise<void>;
    handleMemory: (ctx: Context, userId: string) => Promise<void>;
    handleForget: (ctx: Context, args: string, userId: string) => Promise<void>;
  };
};

export class GatewayMemoryCommandRouter {
  constructor(private readonly deps: GatewayMemoryCommandRouterDeps) {}

  public async dispatchPrivateCommand(
    ctx: Context,
    parsed: ParsedCommand,
    userId: string,
  ): Promise<boolean> {
    switch (parsed.command_type) {
      case '/save':
        await this.deps.knowledgeController.handleSave(ctx, parsed.command_args, userId);
        return true;
      case '/snippet':
        await this.deps.knowledgeController.handleSnippet(ctx, parsed.command_args, userId);
        return true;
      case '/snippets':
        await this.deps.knowledgeController.handleSnippets(ctx, userId);
        return true;
      case '/remember':
        await this.deps.knowledgeController.handleRemember(ctx, parsed.command_args, userId);
        return true;
      case '/recall':
        await this.deps.knowledgeController.handleRecall(ctx, parsed.command_args, userId);
        return true;
      case '/memory':
        await this.deps.knowledgeController.handleMemory(ctx, userId);
        return true;
      case '/forget':
        await this.deps.knowledgeController.handleForget(ctx, parsed.command_args, userId);
        return true;
      default:
        return false;
    }
  }
}
