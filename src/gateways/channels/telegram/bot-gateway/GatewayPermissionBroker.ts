import type { Context } from 'grammy';
import type { ParsedCommand } from '../../../../channels/commands/ChannelCommandParser.js';

export type GatewayPermissionBrokerDeps = {
  permissionController: {
    handlePermissionCommand: (ctx: Context, args: string) => Promise<void>;
    handlePermissionAllowCommand: (ctx: Context, args: string) => Promise<void>;
    handlePermissionRevokeCommand: (ctx: Context, args: string) => Promise<void>;
    handleApproval: (ctx: Context, args: string) => Promise<void>;
    handleRejection: (ctx: Context, args: string) => Promise<void>;
  };
  echoApprovalController?: {
    handleEchoCommand: (ctx: Context, args: string) => Promise<void>;
  };
};

export class GatewayPermissionBroker {
  constructor(private readonly deps: GatewayPermissionBrokerDeps) {}

  public async dispatchPrivateCommand(ctx: Context, parsed: ParsedCommand): Promise<boolean> {
    switch (parsed.command_type) {
      case '/perm':
        await this.deps.permissionController.handlePermissionCommand(ctx, parsed.command_args);
        return true;
      case '/echoapprovals':
        if (!this.deps.echoApprovalController) {
          return false;
        }
        await this.deps.echoApprovalController.handleEchoCommand(ctx, parsed.command_args);
        return true;
      case '/permallow':
        await this.deps.permissionController.handlePermissionAllowCommand(ctx, parsed.command_args);
        return true;
      case '/permrevoke':
        await this.deps.permissionController.handlePermissionRevokeCommand(ctx, parsed.command_args);
        return true;
      case '/approve':
        await this.deps.permissionController.handleApproval(ctx, parsed.command_args);
        return true;
      case '/reject':
        await this.deps.permissionController.handleRejection(ctx, parsed.command_args);
        return true;
      default:
        return false;
    }
  }

  public async dispatchSafeGroupCommand(
    ctx: Context,
    command: string,
    args: string,
  ): Promise<boolean> {
    if (command !== '/echoapprovals' || !this.deps.echoApprovalController) {
      return false;
    }

    await this.deps.echoApprovalController.handleEchoCommand(ctx, args);
    return true;
  }
}
