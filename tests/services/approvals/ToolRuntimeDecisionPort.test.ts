import type { Context } from 'grammy';
import { TelegramEchoApprovalController } from '../../../src/gateways/channels/telegram/controllers/TelegramToolRuntimeApprovalController.js';
import type { TelegramEchoPermission } from '../../../src/gateways/channels/telegram/TelegramEchoSurfaceClient.js';
import { ToolRuntimeDecisionPort } from '../../../src/services/approvals/ports/ToolRuntimeDecisionPort.js';
import { createCaptureReplyIO } from '../../../src/services/approvals/SurfaceDecisionPort.js';
import type { SurfaceDecisionPortDecideInput } from '../../../src/services/approvals/SurfaceDecisionPort.js';
import { ApprovalCoordinator } from '../../../src/services/approvals/ApprovalCoordinator.js';
import type { ApprovalCoordinatorGatewayPort } from '../../../src/services/approvals/ApprovalCoordinator.js';
import { SurfaceDecisionSpine } from '../../../src/services/approvals/SurfaceDecisionSpine.js';
import {
  registerPendingSurfaceApproval,
  resetPendingSurfaceApprovalIndexForTests,
  resolvePendingSurfaceApproval,
} from '../../../src/domain/surface/application/surface-projection/index.js';
import * as pendingSurfaceApprovalIndex from '../../../src/domain/surface/application/surface-projection/PendingSurfaceApprovalIndex.js';

const FULL_ID = 'approval-echo-1234567890';
const SHORT_REF = FULL_ID.slice(0, 16);
const CHAT_ID = 4242;
const USER_ID = 777;

function createPermission(id = FULL_ID): TelegramEchoPermission {
  return {
    id,
    action: 'os_screenshot',
    resource: '{"mode":"fullscreen"}',
    reason: 'Drive the real Echo engine through the tool-runtime decision port.',
    status: 'pending',
    requestedAt: '2026-04-18T12:00:00.000Z',
    approvalId: id,
    correlation: {
      traceId: 'trace-tool-runtime-port',
      runId: 'run-tool-runtime-port',
      sessionId: 'agent-session',
      approvalId: id,
      artifactId: null,
    },
    runContext: {
      traceId: 'trace-tool-runtime-port',
      runId: 'run-tool-runtime-port',
      sessionId: 'agent-session',
      surface: 'agent',
      requestedBy: 'zavorth-agent',
      profile: 'OS',
    },
    metadata: {},
  };
}

type EngineHarness = {
  engine: TelegramEchoApprovalController;
  factory: jest.Mock;
  readPendingPermissions: jest.Mock;
  resolvePermission: jest.Mock;
  getSurfaceContext: jest.Mock;
  permission: TelegramEchoPermission;
};

function createEngineHarness(
  options: {
    permissions?: TelegramEchoPermission[];
    permission?: TelegramEchoPermission;
    resolveUnknownAsUnresolved?: boolean;
  } = {},
): EngineHarness {
  const permission = options.permission ?? createPermission();
  const permissions = options.permissions ?? [permission];
  const resolvePermission = jest.fn(async (id: string, approved: boolean) => {
    const known = permissions.some((entry) => entry.id === id);
    if (!known && options.resolveUnknownAsUnresolved) {
      return { ok: false, id, status: 'unknown_approval' };
    }
    return { ok: true, id, status: approved ? 'approved' : 'denied' };
  });
  const readPendingPermissions = jest.fn(async () => [...permissions]);
  const getSurfaceContext = jest.fn(() => ({
    channel: 'telegram' as const,
    chatId: String(CHAT_ID),
    threadId: null,
    userId: String(USER_ID),
    sessionId: `telegram-${CHAT_ID}`,
    surface: 'telegram' as const,
    requestedBy: `telegram:${USER_ID}`,
  }));
  const factory = jest.fn(() => ({
    getSurfaceContext,
    readPendingPermissions,
    resolvePermission,
  }));

  return {
    engine: new TelegramEchoApprovalController({ clientFactory: factory }),
    factory,
    readPendingPermissions,
    resolvePermission,
    getSurfaceContext,
    permission,
  };
}

function buildDecideInput(
  overrides: Partial<SurfaceDecisionPortDecideInput> = {},
): SurfaceDecisionPortDecideInput {
  return {
    ref: SHORT_REF,
    choice: 'session',
    actorId: String(USER_ID),
    surface: 'telegram',
    io: createCaptureReplyIO(),
    chatId: String(CHAT_ID),
    ...overrides,
  };
}

function buildTransportContext(): Context & { reply: jest.Mock } {
  return {
    chat: { id: CHAT_ID },
    from: { id: USER_ID },
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as Context & { reply: jest.Mock };
}

describe('ToolRuntimeDecisionPort against the real Echo engine', () => {
  beforeEach(() => {
    resetPendingSurfaceApprovalIndexForTests();
  });

  afterEach(() => {
    resetPendingSurfaceApprovalIndexForTests();
    jest.restoreAllMocks();
  });

  it('approves headlessly: short ref resolves through the real engine to the full id', async () => {
    const harness = createEngineHarness();
    const port = new ToolRuntimeDecisionPort(harness.engine);

    const receipt = await port.decide(buildDecideInput({ choice: 'session' }));

    expect(harness.factory).toHaveBeenCalledWith(expect.objectContaining({ chatId: String(CHAT_ID) }));
    expect(harness.resolvePermission).toHaveBeenCalledWith(FULL_ID, true);
    expect(receipt.resolved).toBe(true);
    expect(receipt.decidedBy).toBe('operator');
    expect(receipt.receiptText).toContain('Approval Echo approved.');
    expect(receipt.receiptText).toContain(`id: ${FULL_ID}`);
  });

  it('maps deny to the engine reject path and resolves with denied status', async () => {
    const harness = createEngineHarness();
    const port = new ToolRuntimeDecisionPort(harness.engine);

    const receipt = await port.decide(buildDecideInput({ choice: 'deny' }));

    expect(harness.resolvePermission).toHaveBeenCalledWith(FULL_ID, false);
    expect(receipt.resolved).toBe(true);
    expect(receipt.receiptText).toContain('Approval Echo denied.');
  });

  it('retires rendered presenters through the real pending-surface index on decision', async () => {
    const harness = createEngineHarness();
    const port = new ToolRuntimeDecisionPort(harness.engine);
    registerPendingSurfaceApproval({
      approvalId: FULL_ID,
      surface: 'telegram',
      chatId: CHAT_ID,
      messageId: 55,
    });
    const clearSpy = jest.spyOn(
      pendingSurfaceApprovalIndex,
      'clearPendingSurfaceApprovalsByApprovalId',
    );

    expect(resolvePendingSurfaceApproval({ surface: 'telegram', chatId: CHAT_ID })).not.toBeNull();
    await port.decide(buildDecideInput({ choice: 'deny' }));

    expect(clearSpy).toHaveBeenCalledWith(FULL_ID);
    expect(clearSpy).toHaveReturnedWith(1);
    expect(resolvePendingSurfaceApproval({ surface: 'telegram', chatId: CHAT_ID, messageId: 55 })).toBeNull();
  });

  it('passes a live transport context verbatim so the engine replies natively and stays textless', async () => {
    const harness = createEngineHarness();
    const port = new ToolRuntimeDecisionPort(harness.engine);
    const ctx = buildTransportContext();

    const receipt = await port.decide(
      buildDecideInput({ choice: 'once', transportContext: ctx }),
    );

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(String(ctx.reply.mock.calls[0][0])).toContain('Approval Echo approved.');
    expect(receipt.receiptText).toBeNull();
    expect(receipt.resolved).toBe(true);
  });

  it('hands raw args to the engine untouched so the real listing path answers headlessly', async () => {
    const harness = createEngineHarness();
    const port = new ToolRuntimeDecisionPort(harness.engine);

    const receipt = await port.decideRaw({
      rawArgs: 'list',
      actorId: String(USER_ID),
      chatId: String(CHAT_ID),
    });

    expect(harness.readPendingPermissions).toHaveBeenCalled();
    expect(receipt.receiptText).toContain('Pending Echo approvals (1)');
    expect(receipt.receiptText).toContain('run-tool-runtime-port');
  });

  it('propagates the engine output for an unresolved reference instead of faking success', async () => {
    const harness = createEngineHarness({ resolveUnknownAsUnresolved: true });
    const port = new ToolRuntimeDecisionPort(harness.engine);

    const receipt = await port.decide(buildDecideInput({ ref: 'no-such-echo-approval' }));

    expect(harness.resolvePermission).toHaveBeenCalledWith('no-such-echo-approval', true);
    expect(receipt.resolved).toBe(true);
    expect(receipt.receiptText).toContain('Approval Echo unknown_approval.');
  });

  it('surfaces the real ambiguous-reference failure from the engine', async () => {
    const first = createPermission('approval-echo-aaaaaaaa-1');
    const second = createPermission('approval-echo-aaaaaaaa-2');
    const sharedPrefix = 'approval-echo-aa';
    const harness = createEngineHarness({ permissions: [first, second] });
    const port = new ToolRuntimeDecisionPort(harness.engine);

    await expect(port.decide(buildDecideInput({ ref: sharedPrefix }))).rejects.toThrow(
      `Echo reference "${sharedPrefix}" is ambiguous.`,
    );
    expect(harness.resolvePermission).not.toHaveBeenCalled();
  });

  it('stays optimistic on findPending by default and honors an injected check', () => {
    const harness = createEngineHarness();
    const optimistic = new ToolRuntimeDecisionPort(harness.engine);
    const accurate = new ToolRuntimeDecisionPort(harness.engine, {
      isPending: (ref) => ref === FULL_ID,
    });

    expect(optimistic.findPending('anything')).toBe(true);
    expect(accurate.findPending(FULL_ID)).toBe(true);
    expect(accurate.findPending('gone')).toBe(false);
  });

  it('cannot enumerate pendings without an injected provider because the Echo store is remote', () => {
    const harness = createEngineHarness();
    const port = new ToolRuntimeDecisionPort(harness.engine);

    expect(port.listPending()).toEqual([]);
    expect(new ToolRuntimeDecisionPort(harness.engine, { pendingRefs: () => [FULL_ID] }).listPending()).toEqual([
      FULL_ID,
    ]);
  });
});

describe('tool-runtime registration on a fresh decision spine', () => {
  beforeEach(() => {
    resetPendingSurfaceApprovalIndexForTests();
  });

  afterEach(() => {
    resetPendingSurfaceApprovalIndexForTests();
    jest.restoreAllMocks();
  });

  function createFreshSpine(): SurfaceDecisionSpine {
    return new SurfaceDecisionSpine({
      coordinator: new ApprovalCoordinator(createPassiveGateway()),
      scopeMemory: { respond: jest.fn(), evaluate: jest.fn() },
    });
  }

  it('pins tool-runtime in registrations, cross-surface listing, and claiming', async () => {
    const harness = createEngineHarness();
    const spine = createFreshSpine();
    spine.registerDecisionPort(
      'tool-runtime',
      new ToolRuntimeDecisionPort(harness.engine, { pendingRefs: () => [FULL_ID] }),
    );

    expect(spine.listRegisteredTypes()).toContain('tool-runtime');
    expect(spine.listPending()).toContainEqual({ decisionType: 'tool-runtime', ref: FULL_ID });
    expect(spine.findClaimingType(SHORT_REF)).toBe('tool-runtime');
  });

  it('resolves a deny through the spine into the real engine decision', async () => {
    const harness = createEngineHarness();
    const spine = createFreshSpine();
    spine.registerDecisionPort('tool-runtime', new ToolRuntimeDecisionPort(harness.engine));

    const receipt = await spine.resolve({
      decisionType: 'tool-runtime',
      decisionRef: SHORT_REF,
      surface: 'telegram',
      chatId: String(CHAT_ID),
      userId: String(USER_ID),
      choice: 'deny',
    });

    expect(receipt.resolved).toBe(true);
    expect(receipt.decidedBy).toBe('operator');
    expect(receipt.receiptText).toContain('Approval Echo denied.');
    expect(harness.resolvePermission).toHaveBeenCalledWith(FULL_ID, false);
  });
});

function createPassiveGateway(): ApprovalCoordinatorGatewayPort {
  return {
    findPendingApproval: () => null,
    approve: async () => null,
    reject: async () => null,
    listRuns: () => [],
  };
}
