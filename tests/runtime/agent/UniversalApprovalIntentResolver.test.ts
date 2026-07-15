import { UniversalApprovalIntentResolver, type UniversalAgentRun } from '../../../src/runtime/agent/index.js';

const now = '2026-05-12T12:00:00.000Z';

describe('UniversalApprovalIntentResolver', () => {
  it('does not keyword-route free-text approve phrases (agent-first)', () => {
    const resolver = new UniversalApprovalIntentResolver();
    const run = makeRun({
      id: 'run-1',
      sessionId: 'telegram:123',
      channel: 'telegram',
      approvalId: 'approval-1',
      risk: 'attention',
    });

    const result = resolver.resolve({
      text: 'Aprovo',
      source: 'text',
      channel: 'telegram',
      userId: 'grey',
      sessionId: 'telegram:123',
      runs: [run],
    });

    expect(result.status).toBe('not_approval_intent');
    expect(result.decision).toBeNull();
  });

  it('resolves a dashboard button using the explicit approval reference', () => {
    const resolver = new UniversalApprovalIntentResolver();
    const run = makeRun({
      id: 'run-danger',
      sessionId: 'web:abc',
      channel: 'web',
      approvalId: 'approval-danger',
      risk: 'danger',
    });

    const result = resolver.resolve({
      decision: 'approved',
      ref: 'approval-danger',
      source: 'button',
      channel: 'dashboard',
      userId: 'grey',
      runs: [run],
    });

    expect(result.status).toBe('resolved');
    expect(result.decision).toBe('approved');
    expect(result.ref).toBe('approval-danger');
  });

  it('does not treat free-text "pode continuar" as approval intent', () => {
    const resolver = new UniversalApprovalIntentResolver();

    const result = resolver.resolve({
      text: 'Pode continuar',
      source: 'text',
      channel: 'telegram',
      userId: 'grey',
      runs: [
        makeRun({ id: 'run-1', approvalId: 'approval-1', sessionId: 's1' }),
        makeRun({ id: 'run-2', approvalId: 'approval-2', sessionId: 's2' }),
      ],
    });

    expect(result.status).toBe('not_approval_intent');
    expect(result.decision).toBeNull();
  });

  it('resolves explicit slash approve with session-scoped pending approval', () => {
    const resolver = new UniversalApprovalIntentResolver();

    const result = resolver.resolve({
      text: '/approve',
      source: 'slash-command',
      channel: 'telegram',
      userId: 'grey',
      sessionId: 'telegram:1',
      runs: [
        makeRun({
          id: 'run-ok',
          approvalId: 'approval-ok',
          sessionId: 'telegram:1',
          channel: 'telegram',
          risk: 'attention',
        }),
      ],
    });

    expect(result.status).toBe('resolved');
    expect(result.decision).toBe('approved');
    expect(result.target?.approval.id).toBe('approval-ok');
  });

  it('parses rejection slash with an explicit reference', () => {
    const resolver = new UniversalApprovalIntentResolver();

    const result = resolver.resolve({
      text: '/reject approval-9',
      source: 'slash-command',
      channel: 'discord',
      userId: 'grey',
      runs: [makeRun({ id: 'run-9', approvalId: 'approval-9', sessionId: 'discord:1' })],
    });

    expect(result.status).toBe('resolved');
    expect(result.decision).toBe('rejected');
    expect(result.target?.approval.id).toBe('approval-9');
  });

  it('resolves multi-pending with short ordinal /approve 2 (no long id)', () => {
    const resolver = new UniversalApprovalIntentResolver();
    const older = makeRun({
      id: 'run-a',
      approvalId: 'approval-old',
      sessionId: 'telegram:99',
      channel: 'telegram',
      createdAt: '2026-05-12T10:00:00.000Z',
    });
    const newer = makeRun({
      id: 'run-b',
      approvalId: 'approval-new',
      sessionId: 'telegram:99',
      channel: 'telegram',
      createdAt: '2026-05-12T11:00:00.000Z',
    });

    const listed = resolver.resolve({
      text: '/approve',
      source: 'slash-command',
      channel: 'telegram',
      userId: 'grey',
      sessionId: 'telegram:99',
      runs: [older, newer],
    });
    expect(listed.status).toBe('ambiguous');
    expect(listed.candidates.length).toBe(2);
    expect(listed.commandHint).toMatch(/\/approve 1/);

    const pickSecond = resolver.resolve({
      text: '/approve 2',
      source: 'slash-command',
      channel: 'telegram',
      userId: 'grey',
      sessionId: 'telegram:99',
      runs: [older, newer],
    });
    // Newest-first: 1 = newer, 2 = older
    expect(pickSecond.status).toBe('resolved');
    expect(pickSecond.target?.approval.id).toBe('approval-old');
  });
});

function makeRun(input: {
  id: string;
  approvalId: string;
  userId?: string;
  sessionId?: string;
  channel?: UniversalAgentRun['channel'];
  risk?: UniversalAgentRun['approvals'][number]['risk'];
  createdAt?: string;
}): UniversalAgentRun {
  const created = input.createdAt ?? now;
  return {
    id: input.id,
    traceId: `${input.id}-trace`,
    requestId: `${input.id}-request`,
    sessionId: input.sessionId ?? 'session',
    userId: input.userId ?? 'grey',
    channel: input.channel ?? 'telegram',
    title: 'Pending approval',
    input: 'rode comando sensivel',
    status: 'waiting_approval',
    createdAt: created,
    updatedAt: created,
    summary: 'Aguardando aprovacao.',
    events: [],
    toolExposure: {
      mode: 'confirm',
      summary: 'Approval required.',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'test',
      modelLabel: 'test',
      routingPolicy: 'direct',
    },
    approvals: [
      {
        id: input.approvalId,
        runId: input.id,
        title: 'Aprovar ferramenta',
        reason: 'Ferramenta sensivel.',
        risk: input.risk ?? 'attention',
        status: 'pending',
        createdAt: created,
      },
    ],
    artifacts: [],
    memorySignals: [],
    metadata: {},
  };
}
