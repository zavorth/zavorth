import {
  AgentRunService,
  SELFING_DASHBOARD_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-selfing-${++index}`;
}

describe('AgentRunService Selfing Dashboard Selfing Dashboard', () => {
  it('publishes run.metadata.selfingDashboard during the agent run lifecycle', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:37:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Selfing atualizado apos executor.',
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
      sessionId: 'session-agent-selfing-dashboard',
      text: 'publique selfing dashboard',
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

    const selfing = result.run.metadata.selfingDashboard as any;
    expect(result.run.status).toBe('completed');
    expect(selfing).toEqual(expect.objectContaining({
      contractVersion: SELFING_DASHBOARD_CONTRACT_VERSION,
      source: 'SelfingDashboardService',
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
    expect(selfing.cards.some((card: any) => card.title === 'Memoria do executor')).toBe(true);
  });
});
