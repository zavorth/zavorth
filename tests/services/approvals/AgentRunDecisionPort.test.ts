import { AgentRunDecisionPort } from '../../../src/services/approvals/ports/AgentRunDecisionPort.js';
import { createCaptureReplyIO } from '../../../src/services/approvals/SurfaceDecisionPort.js';

type RecordedApproval = {
  ref: string;
  options?: { choice?: string | null; surface?: string | null; sessionId?: string | null };
};

function createFakeGateway(overrides: {
  approveResult?: unknown;
  rejectResult?: unknown;
  pendingRefs?: Set<string>;
} = {}) {
  const approvals: RecordedApproval[] = [];
  const rejections: Array<{ ref: string }> = [];
  const pending = overrides.pendingRefs ?? new Set<string>();
  return {
    approvals,
    rejections,
    findPendingApproval(ref: string): { run: { id: string }; approval: { id: string } } | null {
      return pending.has(ref) ? { run: { id: 'run-1' }, approval: { id: ref } } : null;
    },
    async approve(ref: string, options?: RecordedApproval['options']) {
      approvals.push({ ref, options });
      return overrides.approveResult === undefined ? { ok: true } : overrides.approveResult;
    },
    async reject(ref: string) {
      rejections.push({ ref });
      return overrides.rejectResult ?? { ok: true };
    },
  };
}

function buildDecideInput(overrides: Record<string, unknown> = {}) {
  return {
    ref: 'approval-1',
    choice: 'session' as const,
    actorId: '42',
    surface: 'discord',
    io: createCaptureReplyIO(),
    ...overrides,
  };
}

describe('AgentRunDecisionPort', () => {
  it('delegates approve with the choice and session context attached', async () => {
    const gateway = createFakeGateway();
    const port = new AgentRunDecisionPort(gateway);

    const receipt = await port.decide(
      buildDecideInput({ sessionId: 'sess-1' }),
    );

    expect(gateway.approvals).toEqual([
      {
        ref: 'approval-1',
        options: { choice: 'session', surface: 'discord', sessionId: 'sess-1' },
      },
    ]);
    expect(receipt.resolved).toBe(true);
    expect(receipt.receiptText).toBe('Agent run approval-1 allowed (session).');
  });

  it('maps deny to the gateway reject path', async () => {
    const gateway = createFakeGateway();
    const port = new AgentRunDecisionPort(gateway);

    const receipt = await port.decide(buildDecideInput({ choice: 'deny' }));

    expect(gateway.approvals).toHaveLength(0);
    expect(gateway.rejections.map((entry) => entry.ref)).toEqual(['approval-1']);
    expect(receipt.resolved).toBe(true);
    expect(receipt.receiptText).toBe('Agent run approval-1 denied.');
  });

  it('reports unresolved when the gateway finds no pending approval', async () => {
    const gateway = createFakeGateway({ approveResult: null });
    const port = new AgentRunDecisionPort(gateway);

    const receipt = await port.decide(buildDecideInput());

    expect(receipt).toMatchObject({ resolved: false, receiptText: null });
  });

  it('mirrors gateway liveness for findPending', () => {
    const gateway = createFakeGateway({ pendingRefs: new Set(['approval-1']) });
    const port = new AgentRunDecisionPort(gateway);

    expect(port.findPending('approval-1')).toBe(true);
    expect(port.findPending('approval-gone')).toBe(false);
  });
});
