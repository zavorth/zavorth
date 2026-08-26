import {
  ApprovalCoordinator,
  type ApprovalCoordinatorGatewayPort,
} from '../../../src/services/approvals/ApprovalCoordinator.js';
import { SurfaceDecisionSpine } from '../../../src/services/approvals/SurfaceDecisionSpine.js';
import { TaskDecisionPort } from '../../../src/services/approvals/ports/TaskDecisionPort.js';
import type { AgentPermissionService } from '../../../src/services/permission/AgentPermissionService.js';
import {
  ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
  type AgentPermissionRespondInput,
  type AgentPermissionRespondResult,
  type AgentPermissionEvaluateResult,
} from '../../../src/contracts/permission/AgentPermissionContract.js';

type EngineCall = { ctx: unknown; args: string };

type FakeTaskEngine = {
  handleApproval: (ctx: unknown, args: string) => Promise<void>;
  handleRejection: (ctx: unknown, taskIdOrArgs: string) => Promise<void>;
  approvals: EngineCall[];
  rejections: EngineCall[];
};

function createFakeTaskEngine(replyFor: (args: string) => string): FakeTaskEngine {
  const engine: FakeTaskEngine = {
    approvals: [],
    rejections: [],
    async handleApproval(ctx: unknown, args: string) {
      engine.approvals.push({ ctx, args });
      await extractReply(ctx)(replyFor(args));
    },
    async handleRejection(ctx: unknown, taskIdOrArgs: string) {
      engine.rejections.push({ ctx, args: taskIdOrArgs });
      await extractReply(ctx)(`Done. Task ${taskIdOrArgs} was rejected.`);
    },
  };
  return engine;
}

function extractReply(ctx: unknown): (text: string) => Promise<unknown> {
  return (ctx as { reply(text: string): Promise<unknown> }).reply.bind(ctx);
}

function createFakeGateway(): ApprovalCoordinatorGatewayPort {
  const resolvedRefs = new Set<string>();
  return {
    findPendingApproval(ref) {
      return ref && !resolvedRefs.has(ref) ? { run: { id: 'run-1' }, approval: { id: ref } } : null;
    },
    async approve(ref) {
      resolvedRefs.add(ref);
      return { ok: true };
    },
    async reject(ref) {
      resolvedRefs.add(ref);
      return { ok: true };
    },
    listRuns() {
      return [];
    },
  };
}

function createScopeMemoryStub(
  respondImplementation: (input: AgentPermissionRespondInput) => AgentPermissionRespondResult = () =>
    rememberedSessionResult(),
): Pick<AgentPermissionService, 'respond' | 'evaluate'> {
  return {
    respond: jest.fn(respondImplementation),
    evaluate: jest.fn((): AgentPermissionEvaluateResult => ({
      contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
      action: 'ask',
      reason: 'Sensitive action — operator approval required',
      matchedRule: null,
      satisfiedBy: null,
    })),
  };
}

function rememberedSessionResult(): AgentPermissionRespondResult {
  return {
    contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
    choice: 'session',
    allowed: true,
    remembered: true,
    scope: 'session',
    expiresAt: '2030-01-01T00:00:00.000Z',
    message: 'Allowed for this session.',
  };
}

function buildSpine(options: {
  coordinator: ApprovalCoordinator;
  scopeMemory: Pick<AgentPermissionService, 'respond' | 'evaluate'>;
  engine: FakeTaskEngine;
  accessGate?: ConstructorParameters<typeof SurfaceDecisionSpine>[0]['accessGate'];
}): SurfaceDecisionSpine {
  const spine = new SurfaceDecisionSpine({
    coordinator: options.coordinator,
    scopeMemory: options.scopeMemory,
    accessGate: options.accessGate,
  });
  spine.registerDecisionPort('task', new TaskDecisionPort(options.engine));
  return spine;
}

describe('SurfaceDecisionSpine', () => {
  it('rejects unregistered decision types with an unresolved null-text receipt', async () => {
    const engine = createFakeTaskEngine(() => 'Allowed (session).');
    const scopeMemory = createScopeMemoryStub();
    const spine = buildSpine({
      coordinator: new ApprovalCoordinator(createFakeGateway()),
      scopeMemory,
      engine,
    });

    const receipt = await spine.resolve({
      decisionType: 'tool-runtime',
      decisionRef: 'echo-1',
      surface: 'web',
      chatId: 'web-1',
      choice: 'session',
    });

    expect(receipt).toMatchObject({ resolved: false, receiptText: null });
    expect(spine.listRegisteredTypes()).toEqual(['task']);
    expect(scopeMemory.respond).not.toHaveBeenCalled();
  });

  it('returns the engine receipt text and records scope memory for a session task decision', async () => {
    const engine = createFakeTaskEngine(() => 'Allowed (session).');
    const scopeMemory = createScopeMemoryStub();
    const spine = buildSpine({
      coordinator: new ApprovalCoordinator(createFakeGateway()),
      scopeMemory,
      engine,
    });

    const receipt = await spine.resolve({
      decisionType: 'task',
      decisionRef: 'task-1',
      surface: 'telegram',
      chatId: '100',
      sessionId: 'sess-1',
      userId: '42',
      title: 'Run build',
      risk: 'attention',
      choice: 'session',
    });

    expect(receipt.resolved).toBe(true);
    expect(receipt.receiptText).toBe('Allowed (session).');
    expect(receipt.decidedBy).toBe('operator');
    expect(receipt.scopeMemory).toEqual({
      recorded: true,
      choice: 'session',
      expiresAt: '2030-01-01T00:00:00.000Z',
    });
    expect(scopeMemory.respond).toHaveBeenCalledWith(
      expect.objectContaining({ choice: 'session', toolName: 'task:task-1' }),
    );
  });

  it('skips scope memory recording for once choices', async () => {
    const engine = createFakeTaskEngine(() => 'Allowed (once).');
    const scopeMemory = createScopeMemoryStub();
    const spine = buildSpine({
      coordinator: new ApprovalCoordinator(createFakeGateway()),
      scopeMemory,
      engine,
    });

    const receipt = await spine.resolve({
      decisionType: 'task',
      decisionRef: 'task-1',
      surface: 'telegram',
      chatId: '100',
      choice: 'once',
    });

    expect(receipt.resolved).toBe(true);
    expect(receipt.scopeMemory).toBeUndefined();
    expect(scopeMemory.respond).not.toHaveBeenCalled();
  });

  it('blocks the decision through the access gate before touching any port', async () => {
    const engine = createFakeTaskEngine(() => 'Allowed (session).');
    const scopeMemory = createScopeMemoryStub();
    const spine = buildSpine({
      coordinator: new ApprovalCoordinator(createFakeGateway()),
      scopeMemory,
      engine,
      accessGate: async () => ({ allowed: false, reason: 'Operator role required.' }),
    });

    const receipt = await spine.resolve({
      decisionType: 'task',
      decisionRef: 'task-1',
      surface: 'telegram',
      chatId: '100',
      userId: '42',
      choice: 'session',
    });

    expect(receipt).toMatchObject({ resolved: false, receiptText: 'Operator role required.' });
    expect(engine.approvals).toHaveLength(0);
    expect(scopeMemory.respond).not.toHaveBeenCalled();
  });

  it('marks coalesced duplicates as followers delegating to their leader', async () => {
    const engine = createFakeTaskEngine(() => 'Allowed (always).');
    const coordinator = new ApprovalCoordinator(createFakeGateway());
    coordinator.registerPendingApproval({
      sessionId: 'sess-1',
      ref: 'task-leader',
      title: 'Run build',
      risk: 'attention',
    });
    coordinator.registerPendingApproval({
      sessionId: 'sess-1',
      ref: 'task-follower',
      title: 'Run build',
      risk: 'attention',
    });
    const spine = buildSpine({
      coordinator,
      scopeMemory: createScopeMemoryStub(),
      engine,
    });

    const receipt = await spine.resolve({
      decisionType: 'task',
      decisionRef: 'task-follower',
      surface: 'discord',
      chatId: 'guild-7',
      sessionId: 'sess-1',
      title: 'Run build',
      risk: 'attention',
      choice: 'always',
    });

    expect(receipt.decidedBy).toBe('coalesced-follower');
    expect(receipt.receiptText).toBe('[grouped] Allowed (always).');
    expect(receipt.resolved).toBe(true);
  });

  it('surfaces cross-surface presenter dismissals collected by the coordinator', async () => {
    const engine = createFakeTaskEngine(() => 'Allowed (session).');
    const coordinator = new ApprovalCoordinator(createFakeGateway());
    coordinator.registerPendingMenu('telegram:100', ['task-1']);
    const spine = buildSpine({
      coordinator,
      scopeMemory: createScopeMemoryStub(),
      engine,
    });

    const receipt = await spine.resolve({
      decisionType: 'task',
      decisionRef: 'task-1',
      surface: 'web',
      chatId: 'web-9',
      choice: 'session',
    });

    expect(receipt.dismissals).toEqual([
      { surface: 'telegram', chatId: '100', resolvedRefs: ['task-1'], promptMessageId: null },
    ]);
  });

  it('keeps the decision intact when scope memory recording fails', async () => {
    const engine = createFakeTaskEngine(() => 'Allowed (session).');
    const scopeMemory = createScopeMemoryStub(() => {
      throw new Error('grant cache offline');
    });
    const spine = buildSpine({
      coordinator: new ApprovalCoordinator(createFakeGateway()),
      scopeMemory,
      engine,
    });

    const receipt = await spine.resolve({
      decisionType: 'task',
      decisionRef: 'task-1',
      surface: 'telegram',
      chatId: '100',
      choice: 'session',
    });

    expect(receipt.resolved).toBe(true);
    expect(receipt.receiptText).toBe('Allowed (session).');
    expect(receipt.scopeMemory).toEqual({
      recorded: false,
      choice: 'session',
      expiresAt: null,
    });
  });
});
