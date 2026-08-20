import {
  AgentRunService,
  AGENT_SELF_CONFIG_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-self-config-${++index}`;
}

describe('AgentRunService Agent Self Config', () => {
  it('publishes run.metadata.agentSelfConfig during the agent run lifecycle', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:37:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Agent self config atualizado apos executor.',
        replyText: 'ok',
        memorySignals: [
          {
            id: 'executor-memory',
            title: 'Memoria do executor',
            layer: 'semantic' as const,
            summary: 'Executor confirmou preferencia do usuario.',
            confidence: 0.86,
          },
        ],
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-self-config',
      text: 'publique agent self config',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        contextInput: {
          warm: {
            workspaceProfile: {
              workspaceName: 'Zavorth',
              agentDisplayName: 'Zavorth',
              userDisplayName: 'Grey',
              tonePreference: 'curto e direto',
              memoryMode: 'receipts-first',
              safetyPosture: 'preview-before-apply',
            },
            identityFiles: [
              {
                path: 'SOUL.md',
                exists: true,
                summary: 'Identidade viva do agente.',
              },
            ],
          },
        },
      },
    });

    const agentSelfConfig = result.run.metadata.agentSelfConfig as any;
    expect(result.run.status).toBe('completed');
    expect(agentSelfConfig).toEqual(expect.objectContaining({
      contractVersion: AGENT_SELF_CONFIG_CONTRACT_VERSION,
      source: 'AgentSelfConfigService',
      identity: expect.objectContaining({
        agentName: 'Zavorth',
        userName: 'Grey',
      }),
      summary: expect.objectContaining({
        identityFileCount: 1,
        memoryReceiptCount: 1,
        knownToolCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        readOnlySnapshot: true,
        noIdentityChanged: true,
        noMemoryChanged: true,
      }),
    }));
    expect(agentSelfConfig.cards.some((card: any) => card.title === 'Memoria do executor')).toBe(true);
  });
});
