import {
  ApprovalCoordinator,
  type ApprovalCoordinatorGatewayPort,
} from '../../../../../src/services/approvals/ApprovalCoordinator.js';
import { SurfaceDecisionSpine } from '../../../../../src/services/approvals/SurfaceDecisionSpine.js';
import type { AgentPermissionService } from '../../../../../src/services/permission/AgentPermissionService.js';
import { PermissionRegistryPort } from '../../../../../src/services/approvals/ports/PermissionRegistryPort.js';
import { TaskDecisionPort } from '../../../../../src/services/approvals/ports/TaskDecisionPort.js';
import type { ParsedCommand } from '../../../../../src/channels/commands/ChannelCommandParser.js';
import type { IMessageContext } from '../../../../../src/contracts/core/IMessageBroker';
import { SharedSurfaceDecisionCommandPack } from '../../../../../src/domain/surface/presentation/shared-surface/SharedSurfaceDecisionCommandPack';

type EngineHarness = {
  handleApproval: jest.Mock;
  handleRejection: jest.Mock;
};

function buildContext(rawText: string): IMessageContext & { reply: jest.Mock } {
  return {
    platform: 'discord',
    userId: 'operator-1',
    chatId: 'guild-7',
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

function createPassiveGateway(): ApprovalCoordinatorGatewayPort {
  return {
    findPendingApproval: () => null,
    approve: async () => null,
    reject: async () => null,
    listRuns: () => [],
  };
}

function buildScopeMemory(): Pick<AgentPermissionService, 'respond' | 'evaluate'> {
  return {
    respond: jest.fn(),
    evaluate: jest.fn().mockReturnValue({
      contractVersion: 1,
      action: 'ask',
      reason: 'ask',
      matchedRule: null,
      satisfiedBy: null,
    }),
  };
}

type SpineOverrides = {
  engine?: Partial<EngineHarness>;
  taskIsPending?: (ref: string) => boolean;
  pendingTaskRefs?: () => string[];
  permissionDecider?: (input: {
    reference: string;
    action: 'approve' | 'deny';
    scope: string;
    actorId: string | null;
  }) => Promise<{ resolved: boolean; receiptText: string | null }>;
  permissionIsPending?: (ref: string) => boolean;
};

function buildSpine(overrides: SpineOverrides = {}): SurfaceDecisionSpine {
  const spine = new SurfaceDecisionSpine({
    coordinator: new ApprovalCoordinator(createPassiveGateway()),
    scopeMemory: buildScopeMemory(),
  });
  const engine: EngineHarness = {
    handleApproval:
      overrides.engine?.handleApproval ??
      jest.fn(async (ctx: { reply(text: string): Promise<unknown> }, args: string) => {
        await ctx.reply(`APPROVED:${args}`);
      }),
    handleRejection:
      overrides.engine?.handleRejection ??
      jest.fn(async (ctx: { reply(text: string): Promise<unknown> }, taskId: string) => {
        await ctx.reply(`REJECTED:${taskId}`);
      }),
  };
  spine.registerDecisionPort(
    'task',
    new TaskDecisionPort(engine, {
      isPending: overrides.taskIsPending,
      pendingRefs: overrides.pendingTaskRefs
        ? () => overrides.pendingTaskRefs?.() ?? []
        : undefined,
    }),
  );
  if (overrides.permissionDecider) {
    spine.registerDecisionPort(
      'permission',
      new PermissionRegistryPort(overrides.permissionDecider, {
        isPending: overrides.permissionIsPending,
      }),
    );
  }
  return spine;
}

describe('SharedSurfaceDecisionCommandPack', () => {
  it('declares the canonical decision command names', () => {
    expect(new SharedSurfaceDecisionCommandPack({}).commandNames).toEqual([
      '/approvals',
      '/approve',
      '/reject',
    ]);
  });

  it('returns not-handled when no spine is wired, without replying', async () => {
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: null });
    const context = buildContext('/approvals');

    const handled = await pack.handle({ context, parsedCommand: buildParsedCommand('/approvals') });

    expect(handled).toBe(false);
    expect(context.reply).not.toHaveBeenCalled();
  });

  it('returns not-handled for commands outside its contract', async () => {
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: buildSpine() });
    const context = buildContext('/status');

    const handled = await pack.handle({ context, parsedCommand: buildParsedCommand('/status') });

    expect(handled).toBe(false);
    expect(context.reply).not.toHaveBeenCalled();
  });

  it('reports the empty state for /approvals when nothing is pending', async () => {
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: buildSpine() });
    const context = buildContext('/approvals');

    const handled = await pack.handle({ context, parsedCommand: buildParsedCommand('/approvals') });

    expect(handled).toBe(true);
    expect(context.reply).toHaveBeenCalledWith('No pending decisions across registered surfaces.');
  });

  it('lists pending port refs and coordinator menus deterministically', async () => {
    const spine = buildSpine({ pendingTaskRefs: () => ['task-b', 'task-a'] });
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: spine });
    const context = buildContext('/approvals');

    await pack.handle({ context, parsedCommand: buildParsedCommand('/approvals') });

    expect(context.reply).toHaveBeenCalledWith(
      ['Pending decisions (2)', '- [task] task-b', '- [task] task-a'].join('\n'),
    );
  });

  it('routes /approve with a scope word through the claiming port as a parsed choice', async () => {
    const engine = {
      handleApproval: jest.fn(async (ctx: { reply(text: string): Promise<unknown> }, args: string) => {
        await ctx.reply(`APPROVED:${args}`);
      }),
      handleRejection: jest.fn(),
    };
    const spine = buildSpine({
      engine,
      taskIsPending: (ref) => ref === 'task-9',
      pendingTaskRefs: () => ['task-9'],
    });
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: spine });
    const context = buildContext('/approve task-9 session');

    await pack.handle({ context, parsedCommand: buildParsedCommand('/approve', 'task-9 session') });

    expect(engine.handleApproval).toHaveBeenCalledTimes(1);
    expect(context.reply).toHaveBeenCalledWith('APPROVED:task-9 session');
  });

  it('hands /approve ordinal args to the engine untouched as raw args', async () => {
    const engine = {
      handleApproval: jest.fn(async (ctx: { reply(text: string): Promise<unknown> }, args: string) => {
        await ctx.reply(`ORDINAL:${args}`);
      }),
      handleRejection: jest.fn(),
    };
    const spine = buildSpine({ engine, taskIsPending: () => true });
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: spine });
    const context = buildContext('/approve 2');

    await pack.handle({ context, parsedCommand: buildParsedCommand('/approve', '2') });

    expect(engine.handleApproval).toHaveBeenCalledWith(expect.anything(), '2');
    expect(context.reply).toHaveBeenCalledWith('ORDINAL:2');
  });

  it('lets a bare /approve reach the engine guidance path via raw args', async () => {
    const engine = {
      handleApproval: jest.fn(async (ctx: { reply(text: string): Promise<unknown> }, args: string) => {
        await ctx.reply(args.length > 0 ? `ARGS:${args}` : 'GUIDANCE');
      }),
      handleRejection: jest.fn(),
    };
    const spine = buildSpine({ engine });
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: spine });
    const context = buildContext('/approve');

    await pack.handle({ context, parsedCommand: buildParsedCommand('/approve') });

    expect(engine.handleApproval).toHaveBeenCalledWith(expect.anything(), '');
    expect(context.reply).toHaveBeenCalledWith('GUIDANCE');
  });

  it('resolves /reject through the first port claiming the reference with choice deny', async () => {
    const engine = {
      handleApproval: jest.fn(),
      handleRejection: jest.fn(async (ctx: { reply(text: string): Promise<unknown> }, taskId: string) => {
        await ctx.reply(`REJECTED:${taskId}`);
      }),
    };
    const spine = buildSpine({ engine, taskIsPending: (ref) => ref === 'task-3' });
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: spine });
    const context = buildContext('/reject task-3');

    await pack.handle({ context, parsedCommand: buildParsedCommand('/reject', 'task-3') });

    expect(engine.handleRejection).toHaveBeenCalledTimes(1);
    expect(context.reply).toHaveBeenCalledWith('REJECTED:task-3');
  });

  it('lets an optimistic port claim an unknown reference and speak through its own engine', async () => {
    const decider = jest.fn().mockResolvedValue({ resolved: true, receiptText: 'Permission ghost-ref was not found.' });
    const spine = buildSpine({
      taskIsPending: () => false,
      permissionDecider: decider,
    });
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: spine });
    const context = buildContext('/reject ghost-ref');

    await pack.handle({ context, parsedCommand: buildParsedCommand('/reject', 'ghost-ref') });

    expect(decider).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'ghost-ref', action: 'deny' }),
    );
    expect(context.reply).toHaveBeenCalledWith('Permission ghost-ref was not found.');
  });

  it('answers the not-found receipt for references no registered port claims', async () => {
    const decider = jest.fn().mockResolvedValue({ resolved: true, receiptText: 'perm receipt' });
    const engine = { handleApproval: jest.fn(), handleRejection: jest.fn() };
    const spine = buildSpine({
      engine,
      taskIsPending: () => false,
      permissionDecider: decider,
      permissionIsPending: () => false,
    });
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: spine });
    const context = buildContext('/reject ghost-ref');

    await pack.handle({ context, parsedCommand: buildParsedCommand('/reject', 'ghost-ref') });

    expect(decider).not.toHaveBeenCalled();
    expect(engine.handleRejection).not.toHaveBeenCalled();
    expect(context.reply).toHaveBeenCalledWith('No pending decision found for that reference.');
  });

  it('resolves a permission-owned reference through the permission registry port', async () => {
    const decider = jest.fn().mockResolvedValue({ resolved: true, receiptText: 'Permission approved.' });
    const spine = buildSpine({
      taskIsPending: () => false,
      permissionDecider: decider,
    });
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: spine });
    const context = buildContext('/approve perm-headless once');

    await pack.handle({ context, parsedCommand: buildParsedCommand('/approve', 'perm-headless once') });

    expect(decider).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'perm-headless', action: 'approve' }),
    );
    expect(context.reply).toHaveBeenCalledWith('Permission approved.');
  });

  it('converts resolution failures into a single error reply', async () => {
    const engine = {
      handleApproval: jest.fn().mockRejectedValue(new Error('engine offline')),
      handleRejection: jest.fn(),
    };
    const spine = buildSpine({ engine });
    const pack = new SharedSurfaceDecisionCommandPack({ decisionSpine: spine });
    const context = buildContext('/approve boom');

    await pack.handle({ context, parsedCommand: buildParsedCommand('/approve', 'boom') });

    expect(context.reply).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve that approval right now.'),
    );
  });
});
