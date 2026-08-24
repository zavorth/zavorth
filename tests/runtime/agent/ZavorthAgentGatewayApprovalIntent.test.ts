import { ZavorthAgentGateway, type UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('ZavorthAgentGateway approval intent resolver', () => {
  it('approves and resumes a pending run from structured slash/command text with explicit ref', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executed after structured approval.',
      replyText: 'Approved via /approve.',
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-12T12:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'telegram',
      sessionId: 'telegram:grey',
      text: 'run npm test',
      requestedTools: ['shell.exec'],
    });
    const approvalId = pending.run.approvals[0].id;

    // Free-text "Aprovo" alone is intentionally not an approval intent (purity).
    // Structured slash /approve + ref owns the control path.
    const resolved = await gateway.resolveApprovalIntent({
      text: `/approve ${approvalId}`,
      source: 'slash-command',
      channel: 'telegram',
      userId: 'grey',
      sessionId: 'telegram:grey',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.resolution.status).toBe('resolved');
    expect(resolved.resolution.ref).toBe(approvalId);
    expect(resolved.result?.decision).toBe('approved');
    expect(resolved.result?.run.status).toBe('completed');
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('does not treat bare free-text as approval intent', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-12T12:05:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'Should not execute from free-text alone.',
      }),
    });

    await gateway.handle({
      userId: 'grey',
      channel: 'telegram',
      sessionId: 'telegram:one',
      text: 'run npm test',
      requestedTools: ['shell.exec'],
    });
    await gateway.handle({
      userId: 'grey',
      channel: 'discord',
      sessionId: 'discord:two',
      text: 'open the browser',
      requestedTools: ['filesystem.write'],
    });

    const bare = await gateway.resolveApprovalIntent({
      text: 'continue',
      source: 'text',
      channel: 'whatsapp',
      userId: 'grey',
    });
    expect(bare.ok).toBe(false);
    expect(bare.resolution.status).toBe('not_approval_intent');
    expect(bare.result).toBeNull();

    // Ambiguity only after a real structured decision token without unique ref.
    const ambiguous = await gateway.resolveApprovalIntent({
      text: '/approve',
      source: 'slash-command',
      channel: 'telegram',
      userId: 'grey',
    });
    expect(ambiguous.ok).toBe(false);
    expect(['ambiguous', 'not_found', 'confirmation_required']).toContain(ambiguous.resolution.status);
    expect(ambiguous.result).toBeNull();
  });

  it('allows dashboard buttons to approve danger approvals by explicit ref', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Danger tool executed after authenticated button.',
      replyText: 'Approved on dashboard.',
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-12T12:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'web:grey',
      text: 'run rm build in governed preview',
      requestedTools: ['shell.exec'],
    });

    const resolved = await gateway.resolveApprovalIntent({
      decision: 'approved',
      ref: pending.run.approvals[0].id,
      source: 'button',
      channel: 'dashboard',
      userId: 'grey',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.resolution.status).toBe('resolved');
    expect(resolved.result?.decision).toBe('approved');
    expect(resolved.result?.run.approvals[0].status).toBe('approved');
  });
});
