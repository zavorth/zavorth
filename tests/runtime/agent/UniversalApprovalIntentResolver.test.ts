import {
  UniversalApprovalIntentResolver,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

const now = '2026-05-12T12:00:00.000Z';

describe('UniversalApprovalIntentResolver', () => {
  it('resolves a bare approval when there is exactly one pending approval in the session', () => {
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

    expect(result.status).toBe('resolved');
    expect(result.decision).toBe('approved');
    expect(result.target?.approval.id).toBe('approval-1');
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

  it('rejects ambiguity instead of guessing between multiple pending approvals', () => {
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

    expect(result.status).toBe('ambiguous');
    expect(result.candidates.map((candidate) => candidate.approvalId)).toEqual(['approval-1', 'approval-2']);
  });

  it('requires stronger confirmation for bare danger approvals', () => {
    const resolver = new UniversalApprovalIntentResolver();

    const result = resolver.resolve({
      text: 'Aprovo',
      source: 'text',
      channel: 'whatsapp',
      userId: 'grey',
      sessionId: 'whatsapp:1',
      runs: [
        makeRun({
          id: 'run-danger',
          approvalId: 'approval-danger',
          sessionId: 'whatsapp:1',
          channel: 'api',
          risk: 'danger',
        }),
      ],
    });

    expect(result.status).toBe('confirmation_required');
    expect(result.commandHint).toBe('/approve approval-danger');
  });

  it('parses rejection language with an explicit reference', () => {
    const resolver = new UniversalApprovalIntentResolver();

    const result = resolver.resolve({
      text: 'rejeite approval-9',
      source: 'text',
      channel: 'discord',
      userId: 'grey',
      runs: [
        makeRun({ id: 'run-9', approvalId: 'approval-9', sessionId: 'discord:1' }),
      ],
    });

    expect(result.status).toBe('resolved');
    expect(result.decision).toBe('rejected');
    expect(result.target?.approval.id).toBe('approval-9');
  });
});

function makeRun(input: {
  id: string;
  approvalId: string;
  userId?: string;
  sessionId?: string;
  channel?: UniversalAgentRun['channel'];
  risk?: UniversalAgentRun['approvals'][number]['risk'];
}): UniversalAgentRun {
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
    createdAt: now,
    updatedAt: now,
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
        createdAt: now,
      },
    ],
    artifacts: [],
    memorySignals: [],
    metadata: {},
  };
}
