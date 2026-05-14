import {
  ZavorthAgentGateway,
  type UniversalAgentExecutor,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('ZavorthAgentGateway approval intent resolver', () => {
  it('approves and resumes a pending run from natural text', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executado apos aprovacao natural.',
      replyText: 'Aprovado por texto natural.',
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
      text: 'rode npm test',
      requestedTools: ['shell.exec'],
    });

    const resolved = await gateway.resolveApprovalIntent({
      text: 'Aprovo',
      source: 'text',
      channel: 'telegram',
      userId: 'grey',
      sessionId: 'telegram:grey',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.resolution.status).toBe('resolved');
    expect(resolved.resolution.ref).toBe(pending.run.approvals[0].id);
    expect(resolved.result?.decision).toBe('approved');
    expect(resolved.result?.run.status).toBe('completed');
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('does not guess when natural text matches multiple pending approvals', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-12T12:05:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'Nao deveria executar.',
      }),
    });

    await gateway.handle({
      userId: 'grey',
      channel: 'telegram',
      sessionId: 'telegram:one',
      text: 'rode npm test',
      requestedTools: ['shell.exec'],
    });
    await gateway.handle({
      userId: 'grey',
      channel: 'discord',
      sessionId: 'discord:two',
      text: 'abra o browser',
      requestedTools: ['filesystem.write'],
    });

    const resolved = await gateway.resolveApprovalIntent({
      text: 'continue',
      source: 'text',
      channel: 'whatsapp',
      userId: 'grey',
    });

    expect(resolved.ok).toBe(false);
    expect(resolved.resolution.status).toBe('ambiguous');
    expect(resolved.resolution.candidates).toHaveLength(2);
    expect(resolved.result).toBeNull();
  });

  it('allows dashboard buttons to approve danger approvals by explicit ref', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Danger tool executado apos botao autenticado.',
      replyText: 'Aprovado no dashboard.',
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
      text: 'rode rm build em preview governado',
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
