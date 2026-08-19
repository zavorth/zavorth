import {
  AgentRunService,
  ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-ask-policy-${++index}`;
}

describe('AgentRunService Ask Before Assumption Policy Channel mesh2', () => {
  it('publishes run.metadata.askBeforeAssumptionPolicy during the agent run lifecycle', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:42:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'I did not execute any assumption.',
        replyText: 'ok',
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-agent-ask-policy',
      text: 'delete isso e envie para o canal certo',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.write', 'network.send'],
      metadata: {
        askBeforeAssumptionPolicy: {
          assumptions: [
            {
              category: 'missing-target',
              title: 'Destino nao confirmado',
              detail: 'O pedido nao indica qual arquivo ou canal deve ser usado.',
              severity: 'danger',
              affectedActions: ['workspace.write', 'network.send'],
              question: 'Qual alvo e destino devo usar?',
            },
          ],
        },
      },
    });

    const askPolicy = result.run.metadata.askBeforeAssumptionPolicy as any;
    expect(askPolicy).toEqual(expect.objectContaining({
      contractVersion: ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION,
      source: 'AskBeforeAssumptionPolicyService',
      status: 'blocked',
      summary: expect.objectContaining({
        questionCount: expect.any(Number),
        mutableActionBlockedCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        noAssumptionActedOn: true,
        noMutationExecuted: true,
        asksBeforeMutation: true,
        approvalStillRequired: true,
      }),
    }));
    expect(askPolicy.questions.some((question: any) => question.blocksMutation)).toBe(true);
    expect(askPolicy.nextSafeAction).toContain('Ask before any mutation');
  });
});
