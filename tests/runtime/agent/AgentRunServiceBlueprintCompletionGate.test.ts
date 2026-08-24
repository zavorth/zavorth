import {
  AgentRunService,
  BLUEPRINT_COMPLETION_GATE_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';
import { blueprintMetadata } from './BlueprintCompletionGateService.test.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-blueprint-${++index}`;
}

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('AgentRunService Blueprint Completion final gate', () => {
  it('publishes run.metadata.blueprintCompletionGate after pre-canary', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T07:00:00.000Z'),
      idFactory: createIdFactory(),
      releaseCandidatePreCanaryGate: {
        buildSnapshot: () => ({
          status: 'pre-canary-ready',
          readiness: { canOpenPreCanary: true },
        }),
      } as any,
      executor: () => ({
        status: 'completed' as const,
        summary: 'Blueprint completo.',
        replyText: 'ok',
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-blueprint',
      text: 'complete blueprint',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: blueprintMetadata(),
    });

    const snapshot = result.run.metadata.blueprintCompletionGate as any;
    expect(result.run.metadata.releaseCandidatePreCanaryGate).toBeTruthy();
    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: BLUEPRINT_COMPLETION_GATE_CONTRACT_VERSION,
      source: 'BlueprintCompletionGateService',
      status: 'blueprint-complete',
      readiness: expect.objectContaining({
        blueprintComplete: true,
        safeguardsReady: true,
      }),
      policy: expect.objectContaining({
        noAutoExecute: true,
        noSkipApproval: true,
      }),
    }));
  });
});
