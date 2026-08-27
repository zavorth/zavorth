import type { Context } from 'grammy';
import { ChannelCommandParser, type ParsedCommand } from '../../../../../src/channels/commands/ChannelCommandParser';
import type { IMessageContext } from '../../../../../src/contracts/core/IMessageBroker';
import {
  SharedSurfaceOpsCommandPack,
  type SharedSurfaceOpsPort,
  type SharedOpsContext,
} from '../../../../../src/domain/surface/presentation/shared-surface/SharedSurfaceOpsCommandPack';

function buildContext(rawText: string): IMessageContext & { reply: jest.Mock<void, [string]> } {
  return {
    platform: 'telegram',
    userId: 'telegram-user',
    chatId: 'telegram:chat-1',
    isGroup: false,
    rawText,
    reply: jest.fn(async () => undefined),
    editMessage: jest.fn(async () => undefined),
  };
}

function buildParsedCommand(commandType: string, commandArgs = ''): ParsedCommand {
  return {
    command_type: commandType,
    command_args: commandArgs,
    normalized_message: `${commandType} ${commandArgs}`.trim(),
    explicit_executor: null,
    references_last_task: false,
  };
}

function buildOpsPort(): SharedSurfaceOpsPort {
  return {
    handleStatus: jest.fn(async () => undefined),
    handleModels: jest.fn(async () => undefined),
    handleAudit: jest.fn(async () => undefined),
    handleChanges: jest.fn(async () => undefined),
    handleReadiness: jest.fn(async () => undefined),
    handleZavorthControl: jest.fn(async () => undefined),
    handleDashboard: jest.fn(async () => undefined),
  };
}

function buildPack(opsController: SharedSurfaceOpsPort | null): SharedSurfaceOpsCommandPack {
  return new SharedSurfaceOpsCommandPack({ opsController });
}

function parse(rawText: string): ParsedCommand {
  return new ChannelCommandParser().parse(rawText);
}

describe('SharedSurfaceOpsCommandPack', () => {
  it('declares the canonical ops command names', () => {
    expect(buildPack(buildOpsPort()).commandNames).toEqual([
      '/status',
      '/models',
      '/audit',
      '/changes',
      '/readiness',
      '/zavorthControl',
      '/dashboard',
    ]);
  });

  it.each([
    ['/status', 'handleStatus'],
    ['/models', 'handleModels'],
    ['/changes', 'handleChanges'],
    ['/readiness', 'handleReadiness'],
    ['/zavorthControl', 'handleZavorthControl'],
    ['/dashboard', 'handleDashboard'],
  ])('routes %s to %s', async (commandType, methodName) => {
    const opsController = buildOpsPort();
    const pack = buildPack(opsController);
    const context = buildContext(commandType);

    const handled = await pack.handle({ context, parsedCommand: buildParsedCommand(commandType) });

    expect(handled).toBe(true);
    const methodMock = opsController[methodName as keyof SharedSurfaceOpsPort] as jest.Mock;
    expect(methodMock).toHaveBeenCalledTimes(1);
    expect(opsController.handleAudit).not.toHaveBeenCalled();
    expect(context.reply).not.toHaveBeenCalled();
  });

  it('routes /audit with args passthrough', async () => {
    const opsController = buildOpsPort();
    const pack = buildPack(opsController);
    const context = buildContext('/audit 25');

    const handled = await pack.handle({ context, parsedCommand: buildParsedCommand('/audit', '25') });

    expect(handled).toBe(true);
    expect(opsController.handleAudit).toHaveBeenCalledTimes(1);
    expect(opsController.handleAudit).toHaveBeenCalledWith(expect.anything(), '25');
    expect(context.reply).not.toHaveBeenCalled();
  });

  it('builds SurfaceOpsIO from the message context', async () => {
    const opsController = buildOpsPort();
    const pack = buildPack(opsController);
    const context = buildContext('/status');
    const parsedCommand = buildParsedCommand('/status');

    await pack.handle({ context, parsedCommand });

    const io = (opsController.handleStatus as jest.Mock).mock.calls[0][0] as SharedOpsContext;
    expect(io.from?.id).toBe('telegram-user');
    expect(io.chat?.id).toBe('telegram:chat-1');

    await io.reply('surface reply');
    expect(context.reply).toHaveBeenCalledWith('surface reply', undefined);
  });

  it('returns not-handled for unknown commands without touching the port or replying', async () => {
    const opsController = buildOpsPort();
    const pack = buildPack(opsController);
    const context = buildContext('/nope');

    const handled = await pack.handle({ context, parsedCommand: parse('/nope') });

    expect(handled).toBe(false);
    expect(context.reply).not.toHaveBeenCalled();
    for (const methodName of Object.keys(opsController) as Array<keyof SharedSurfaceOpsPort>) {
      expect(opsController[methodName]).not.toHaveBeenCalled();
    }
  });

  it('returns not-handled when no ops controller is wired', async () => {
    const pack = buildPack(null);
    const context = buildContext('/status');

    const handled = await pack.handle({ context, parsedCommand: buildParsedCommand('/status') });

    expect(handled).toBe(false);
    expect(context.reply).not.toHaveBeenCalled();
  });

  it('accepts the grammy-typed controller through the structural port', () => {
    const grammyHandler = async (_ctx: Context): Promise<void> => undefined;
    const controller: SharedSurfaceOpsPort = {
      handleStatus: grammyHandler,
      handleModels: grammyHandler,
      handleAudit: grammyHandler,
      handleChanges: grammyHandler,
      handleReadiness: grammyHandler,
      handleZavorthControl: grammyHandler,
      handleDashboard: grammyHandler,
    };

    expect(new SharedSurfaceOpsCommandPack({ opsController: controller })).toBeInstanceOf(
      SharedSurfaceOpsCommandPack,
    );
  });
});
