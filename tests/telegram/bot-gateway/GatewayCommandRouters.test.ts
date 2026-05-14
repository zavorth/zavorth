import { GatewayMemoryCommandRouter } from '../../../src/telegram/bot-gateway/GatewayMemoryCommandRouter';
import { GatewayPermissionBroker } from '../../../src/telegram/bot-gateway/GatewayPermissionBroker';
import { GatewaySchedulerCommandRouter } from '../../../src/telegram/bot-gateway/GatewaySchedulerCommandRouter';
import type { ParsedCommand } from '../../../src/telegram/CommandParser';

function parsed(commandType: string, commandArgs = ''): ParsedCommand {
  return {
    command_type: commandType,
    command_args: commandArgs,
    normalized_message: `${commandType} ${commandArgs}`.trim(),
    explicit_executor: null,
    references_last_task: false,
    workspace_command_name: null,
  };
}

describe('GatewayPermissionBroker', () => {
  function createDeps() {
    return {
      permissionController: {
        handlePermissionCommand: jest.fn().mockResolvedValue(undefined),
        handlePermissionAllowCommand: jest.fn().mockResolvedValue(undefined),
        handlePermissionRevokeCommand: jest.fn().mockResolvedValue(undefined),
        handleApproval: jest.fn().mockResolvedValue(undefined),
        handleRejection: jest.fn().mockResolvedValue(undefined),
      },
      echoApprovalController: {
        handleEchoCommand: jest.fn().mockResolvedValue(undefined),
      },
    };
  }

  it('routes private approval commands through the permission plane', async () => {
    const deps = createDeps();
    const broker = new GatewayPermissionBroker(deps);
    const ctx = {} as any;

    const handled = await broker.dispatchPrivateCommand(ctx, parsed('/approve', 'perm-123'));

    expect(handled).toBe(true);
    expect(deps.permissionController.handleApproval).toHaveBeenCalledWith(ctx, 'perm-123');
  });

  it('keeps echo approvals optional and explicit', async () => {
    const deps = createDeps();
    const broker = new GatewayPermissionBroker({
      permissionController: deps.permissionController,
    });

    const handled = await broker.dispatchPrivateCommand({} as any, parsed('/echoapprovals', 'list'));

    expect(handled).toBe(false);
    expect(deps.echoApprovalController.handleEchoCommand).not.toHaveBeenCalled();
  });

  it('routes safe group echo approval commands through the same broker', async () => {
    const deps = createDeps();
    const broker = new GatewayPermissionBroker(deps);
    const ctx = {} as any;

    const handled = await broker.dispatchSafeGroupCommand(ctx, '/echoapprovals', 'approve a1');

    expect(handled).toBe(true);
    expect(deps.echoApprovalController.handleEchoCommand).toHaveBeenCalledWith(ctx, 'approve a1');
  });
});

describe('GatewaySchedulerCommandRouter', () => {
  it('routes automation commands with the runtime user id', async () => {
    const schedulerController = {
      handleSchedule: jest.fn().mockResolvedValue(undefined),
      handleReport: jest.fn().mockResolvedValue(undefined),
      handleListSchedules: jest.fn().mockResolvedValue(undefined),
      handleUnschedule: jest.fn().mockResolvedValue(undefined),
      handleAutomations: jest.fn().mockResolvedValue(undefined),
    };
    const router = new GatewaySchedulerCommandRouter({ schedulerController });
    const ctx = {} as any;

    const handled = await router.dispatchPrivateCommand(ctx, parsed('/automations', 'pause all'), '42');

    expect(handled).toBe(true);
    expect(schedulerController.handleAutomations).toHaveBeenCalledWith(ctx, 'pause all', '42');
  });

  it('ignores non-scheduler commands', async () => {
    const schedulerController = {
      handleSchedule: jest.fn(),
      handleReport: jest.fn(),
      handleListSchedules: jest.fn(),
      handleUnschedule: jest.fn(),
      handleAutomations: jest.fn(),
    };
    const router = new GatewaySchedulerCommandRouter({ schedulerController });

    await expect(router.dispatchPrivateCommand({} as any, parsed('/help'), '42')).resolves.toBe(false);
    expect(schedulerController.handleSchedule).not.toHaveBeenCalled();
  });
});

describe('GatewayMemoryCommandRouter', () => {
  it('routes snippet commands through the knowledge controller', async () => {
    const knowledgeController = {
      handleSave: jest.fn().mockResolvedValue(undefined),
      handleSnippet: jest.fn().mockResolvedValue(undefined),
      handleSnippets: jest.fn().mockResolvedValue(undefined),
      handleRemember: jest.fn().mockResolvedValue(undefined),
      handleRecall: jest.fn().mockResolvedValue(undefined),
      handleMemory: jest.fn().mockResolvedValue(undefined),
      handleForget: jest.fn().mockResolvedValue(undefined),
    };
    const router = new GatewayMemoryCommandRouter({ knowledgeController });
    const ctx = {} as any;

    const handled = await router.dispatchPrivateCommand(ctx, parsed('/snippet', 'api key pattern'), '42');

    expect(handled).toBe(true);
    expect(knowledgeController.handleSnippet).toHaveBeenCalledWith(ctx, 'api key pattern', '42');
  });

  it('routes memory list commands without accidental args', async () => {
    const knowledgeController = {
      handleSave: jest.fn().mockResolvedValue(undefined),
      handleSnippet: jest.fn().mockResolvedValue(undefined),
      handleSnippets: jest.fn().mockResolvedValue(undefined),
      handleRemember: jest.fn().mockResolvedValue(undefined),
      handleRecall: jest.fn().mockResolvedValue(undefined),
      handleMemory: jest.fn().mockResolvedValue(undefined),
      handleForget: jest.fn().mockResolvedValue(undefined),
    };
    const router = new GatewayMemoryCommandRouter({ knowledgeController });
    const ctx = {} as any;

    const handled = await router.dispatchPrivateCommand(ctx, parsed('/memory', 'ignored'), '42');

    expect(handled).toBe(true);
    expect(knowledgeController.handleMemory).toHaveBeenCalledWith(ctx, '42');
  });
});
