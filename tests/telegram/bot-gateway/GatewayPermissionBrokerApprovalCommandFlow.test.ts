import type { Context } from 'grammy';
import {
  ChannelCommandParser,
  normalizeChannelCommandToken,
  type ParsedCommand,
} from '../../../src/channels/commands/ChannelCommandParser';
import { GatewayPermissionBroker } from '../../../src/gateways/channels/telegram/bot-gateway/GatewayPermissionBroker';

const USER_ID = 42;

function buildContext(): Context {
  return { from: { id: USER_ID } } as unknown as Context;
}

function buildPermissionControllerFake() {
  return {
    handlePermissionCommand: jest.fn().mockResolvedValue(undefined),
    handlePermissionAllowCommand: jest.fn().mockResolvedValue(undefined),
    handlePermissionRevokeCommand: jest.fn().mockResolvedValue(undefined),
    handleApproval: jest.fn().mockResolvedValue(undefined),
    handleRejection: jest.fn().mockResolvedValue(undefined),
  };
}

type PermissionControllerFake = ReturnType<typeof buildPermissionControllerFake>;

function buildBroker(permissionController: PermissionControllerFake): GatewayPermissionBroker {
  return new GatewayPermissionBroker({ permissionController });
}

describe('GatewayPermissionBroker approval command flow', () => {
  const parser = new ChannelCommandParser();

  describe('command parsing', () => {
    it('parses bare /approve with the approval_manager executor binding', () => {
      const parsed: ParsedCommand = parser.parse('/approve');

      expect(parsed.command_type).toBe('/approve');
      expect(parsed.command_args).toBe('');
      expect(parsed.explicit_executor).toBe('approval_manager');
    });

    it('normalizes bot-mention tokens to the slashed command token', () => {
      expect(normalizeChannelCommandToken('/Approve@SomeBot')).toBe('/approve');
    });

    it('parses /Approve@SomeBot into /approve while keeping the args', () => {
      const parsed = parser.parse('/Approve@SomeBot 2 once');

      expect(parsed.command_type).toBe('/approve');
      expect(parsed.command_args).toBe('2 once');
      expect(parsed.explicit_executor).toBe('approval_manager');
    });

    it('parses /reject with the same executor binding', () => {
      const parsed = parser.parse('/reject abc12345');

      expect(parsed.command_type).toBe('/reject');
      expect(parsed.command_args).toBe('abc12345');
      expect(parsed.explicit_executor).toBe('approval_manager');
    });

    it('keeps /permallow and /permrevoke as unbound top-level commands', () => {
      expect(parser.parse('/permallow executor=codex kind=command value="npm test"')).toEqual(
        expect.objectContaining({
          command_type: '/permallow',
          command_args: 'executor=codex kind=command value="npm test"',
          explicit_executor: null,
        }),
      );
      expect(parser.parse('/permrevoke perm-1234')).toEqual(
        expect.objectContaining({
          command_type: '/permrevoke',
          command_args: 'perm-1234',
          explicit_executor: null,
        }),
      );
    });

    it('marks unknown commands for the broker to ignore', () => {
      const parsed = parser.parse('/definitelynotacommand 1');

      expect(parsed.command_type).toBe('unknown');
      expect(parsed.explicit_executor).toBeNull();
    });
  });

  describe('private command dispatch', () => {
    it('routes /approve args to handleApproval and reports the command handled', async () => {
      const permissionController = buildPermissionControllerFake();
      const broker = buildBroker(permissionController);
      const ctx = buildContext();

      const handled = await broker.dispatchPrivateCommand(ctx, parser.parse('/approve 2 once'));

      expect(handled).toBe(true);
      expect(permissionController.handleApproval).toHaveBeenCalledTimes(1);
      expect(permissionController.handleApproval).toHaveBeenCalledWith(ctx, '2 once');
      expect(permissionController.handleRejection).not.toHaveBeenCalled();
      expect(permissionController.handlePermissionCommand).not.toHaveBeenCalled();
    });

    it('routes /reject args to handleRejection and reports the command handled', async () => {
      const permissionController = buildPermissionControllerFake();
      const broker = buildBroker(permissionController);
      const ctx = buildContext();

      const handled = await broker.dispatchPrivateCommand(ctx, parser.parse('/reject abc12345'));

      expect(handled).toBe(true);
      expect(permissionController.handleRejection).toHaveBeenCalledTimes(1);
      expect(permissionController.handleRejection).toHaveBeenCalledWith(ctx, 'abc12345');
      expect(permissionController.handleApproval).not.toHaveBeenCalled();
    });

    it('routes /permallow and /permrevoke to their policy handlers', async () => {
      const permissionController = buildPermissionControllerFake();
      const broker = buildBroker(permissionController);
      const ctx = buildContext();

      const allowHandled = await broker.dispatchPrivateCommand(
        ctx,
        parser.parse('/permallow executor=codex kind=command value="npm test"'),
      );
      const revokeHandled = await broker.dispatchPrivateCommand(
        ctx,
        parser.parse('/permrevoke perm-1234'),
      );

      expect(allowHandled).toBe(true);
      expect(revokeHandled).toBe(true);
      expect(permissionController.handlePermissionAllowCommand).toHaveBeenCalledWith(
        ctx,
        'executor=codex kind=command value="npm test"',
      );
      expect(permissionController.handlePermissionRevokeCommand).toHaveBeenCalledWith(
        ctx,
        'perm-1234',
      );
    });

    it('routes /perm subcommands to the generic permission handler', async () => {
      const permissionController = buildPermissionControllerFake();
      const broker = buildBroker(permissionController);
      const ctx = buildContext();

      const handled = await broker.dispatchPrivateCommand(ctx, parser.parse('/perm show perm-1'));

      expect(handled).toBe(true);
      expect(permissionController.handlePermissionCommand).toHaveBeenCalledWith(ctx, 'show perm-1');
    });

    it('returns false for unknown commands without touching any handler', async () => {
      const permissionController = buildPermissionControllerFake();
      const broker = buildBroker(permissionController);
      const ctx = buildContext();

      const handled = await broker.dispatchPrivateCommand(
        ctx,
        parser.parse('/definitelynotacommand 1'),
      );

      expect(handled).toBe(false);
      expect(permissionController.handleApproval).not.toHaveBeenCalled();
      expect(permissionController.handleRejection).not.toHaveBeenCalled();
      expect(permissionController.handlePermissionCommand).not.toHaveBeenCalled();
      expect(permissionController.handlePermissionAllowCommand).not.toHaveBeenCalled();
      expect(permissionController.handlePermissionRevokeCommand).not.toHaveBeenCalled();
    });
  });
});
