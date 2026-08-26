import { TaskDecisionPort } from '../../../src/services/approvals/ports/TaskDecisionPort.js';
import { createCaptureReplyIO } from '../../../src/services/approvals/SurfaceDecisionPort.js';

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

function buildDecideInput(overrides: Record<string, unknown> = {}) {
  return {
    ref: 'task-1',
    choice: 'session' as const,
    actorId: '42' as string | null,
    surface: 'telegram',
    io: createCaptureReplyIO(),
    chatId: '100',
    ...overrides,
  };
}

describe('TaskDecisionPort', () => {
  it('returns the engine reply text as the receipt instead of sending it', async () => {
    const engine = createFakeTaskEngine(() => 'Allowed (session).');
    const port = new TaskDecisionPort(engine);

    const receipt = await port.decide(buildDecideInput());

    expect(receipt.resolved).toBe(true);
    expect(receipt.receiptText).toBe('Allowed (session).');
    expect(engine.approvals).toHaveLength(1);
  });

  it('forwards ref plus scope args and keeps bare-ref semantics for once', async () => {
    const engine = createFakeTaskEngine((args) => `Allowed (${args}).`);
    const port = new TaskDecisionPort(engine);

    await port.decide(buildDecideInput({ choice: 'session' }));
    await port.decide(buildDecideInput({ choice: 'always' }));
    const onceReceipt = await port.decide(buildDecideInput({ choice: 'once' }));

    expect(engine.approvals.map((call) => call.args)).toEqual([
      'task-1 session',
      'task-1 always',
      'task-1',
    ]);
    expect(onceReceipt.receiptText).toBe('Allowed (task-1).');
  });

  it('maps deny to handleRejection with the raw ref', async () => {
    const engine = createFakeTaskEngine(() => 'Allowed (session).');
    const port = new TaskDecisionPort(engine);

    const receipt = await port.decide(buildDecideInput({ choice: 'deny' }));

    expect(engine.approvals).toHaveLength(0);
    expect(engine.rejections.map((call) => call.args)).toEqual(['task-1']);
    expect(receipt.receiptText).toBe('Done. Task task-1 was rejected.');
  });

  it('synthesizes actor and chat hints for the legacy context', async () => {
    const engine = createFakeTaskEngine(() => 'Allowed (session).');
    const port = new TaskDecisionPort(engine);

    await port.decide(buildDecideInput());
    const ctx = engine.approvals[0].ctx as { from?: { id: unknown }; chat?: { id: unknown } };
    await port.decide(buildDecideInput({ actorId: null }));
    const anonymousCtx = engine.approvals[1].ctx as { from?: { id: unknown }; chat?: { id: unknown } };

    expect(ctx.from?.id).toBe('42');
    expect(ctx.chat?.id).toBe('100');
    expect(anonymousCtx.from).toBeUndefined();
    expect(anonymousCtx.chat).toBeDefined();
  });

  it('surfaces the engine error-path guidance text as the receipt', async () => {
    const engine = createFakeTaskEngine(
      () => 'I could not process this approval.\n\nReason: No pending task matched that reference.',
    );
    const port = new TaskDecisionPort(engine);

    const receipt = await port.decide(buildDecideInput({ ref: 'missing-task' }));

    expect(receipt.resolved).toBe(true);
    expect(receipt.receiptText).toContain('I could not process this approval.');
  });

  it('stays optimistic on findPending by default and honors an injected check', () => {
    const engine = createFakeTaskEngine(() => 'Allowed (session).');
    const optimistic = new TaskDecisionPort(engine);
    const accurate = new TaskDecisionPort(engine, { isPending: (ref) => ref === 'task-1' });

    expect(optimistic.findPending('anything')).toBe(true);
    expect(accurate.findPending('task-1')).toBe(true);
    expect(accurate.findPending('gone')).toBe(false);
  });
});
