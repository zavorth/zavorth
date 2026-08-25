import type { Context } from 'grammy';
import type { ParsedCommand } from '../../../../channels/commands/ChannelCommandParser.js';

export type GatewaySchedulerCommandRouterDeps = {
  schedulerController: {
    handleSchedule: (ctx: Context, args: string) => Promise<void>;
    handleReport: (ctx: Context, args: string, userId: string) => Promise<void>;
    handleListSchedules: (ctx: Context) => Promise<void>;
    handleUnschedule: (ctx: Context, args: string) => Promise<void>;
    handleAutomations: (ctx: Context, args: string, userId: string) => Promise<void>;
  };
};

export class GatewaySchedulerCommandRouter {
  constructor(private readonly deps: GatewaySchedulerCommandRouterDeps) {}

  public async dispatchPrivateCommand(
    ctx: Context,
    parsed: ParsedCommand,
    userId: string,
  ): Promise<boolean> {
    switch (parsed.command_type) {
      case '/schedule':
        await this.deps.schedulerController.handleSchedule(ctx, parsed.command_args);
        return true;
      case '/report':
        await this.deps.schedulerController.handleReport(ctx, parsed.command_args, userId);
        return true;
      case '/schedules':
        await this.deps.schedulerController.handleListSchedules(ctx);
        return true;
      case '/unschedule':
        await this.deps.schedulerController.handleUnschedule(ctx, parsed.command_args);
        return true;
      case '/automations':
        await this.deps.schedulerController.handleAutomations(ctx, parsed.command_args, userId);
        return true;
      default:
        return false;
    }
  }
}
