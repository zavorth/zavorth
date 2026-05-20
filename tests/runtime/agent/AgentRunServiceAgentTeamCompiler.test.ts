import {
  AGENT_TEAM_COMPILER_CONTRACT_VERSION,
  AgentRunService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-team-${++index}`;
}

describe('AgentRunService Agent Team Compiler Channel mesh0', () => {
  it('publishes run.metadata.agentTeamCompiler during the agent run lifecycle', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Team compiler observou plano de equipe.',
        replyText: 'ok',
        metadata: {
          providerArena: {
            selected: {
              candidateId: 'candidate-openai',
              providerLabel: 'openai',
              modelLabel: 'gpt-test',
            },
          },
        },
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-team',
      text: 'compile uma equipe de agentes para implementar, revisar e validar esta entrega',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner', 'implementer', 'verifier'],
      },
    });

    const compiler = result.run.metadata.agentTeamCompiler as any;
    expect(result.run.status).toBe('waiting_approval');
    expect(compiler).toEqual(expect.objectContaining({
      contractVersion: AGENT_TEAM_COMPILER_CONTRACT_VERSION,
      source: 'AgentTeamCompilerService',
      status: 'waiting-approval',
      summary: expect.objectContaining({
        roleCount: 3,
        approvalRequiredCount: 3,
        requestedSwarm: true,
        subagentReceiptsPrepared: true,
        compilerOnly: true,
      }),
      policy: expect.objectContaining({
        noSubagentsLaunched: true,
        approvalRequiredBeforeLaunch: true,
        budgetsDefaultToZero: true,
      }),
    }));
    expect(compiler.roles.some((role: any) => role.roleId === 'implementer')).toBe(true);
    expect(compiler.roles.every((role: any) => role.approval.required === true)).toBe(true);
  });
});
