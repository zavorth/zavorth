import {
  AgentRunService,
  RUN_ARTIFACT_RECEIPT_REPLAY_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-replay-hardening-${++index}`;
}

describe('AgentRunService run/artifact/receipt replay hardening Channel mesh5', () => {
  it('publishes run.metadata.runArtifactReceiptReplay after executor artifacts are merged', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:45:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Replay hardening com artifact do executor.',
        replyText: 'ok',
        artifacts: [
          {
            id: 'artifact-agent-replay',
            title: 'Executor artifact for replay',
            kind: 'report' as const,
            createdAt: '2026-05-04T00:45:00.000Z',
            status: 'ready' as const,
          },
        ],
        metadata: {
          memoryWithReceipts: {
            source: 'MemoryWithReceiptsService',
            contractVersion: '2026-05-03.memory-receipts',
            receipts: [
              {
                id: 'memory:agent-replay',
                kind: 'memory',
                source: 'MemoryWithReceiptsService',
                detail: 'Executor published sourced memory.',
                status: 'ready',
              },
            ],
          },
        },
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-replay-hardening',
      text: 'publique artifact e prepare replay',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
    });

    const replay = result.run.metadata.runArtifactReceiptReplay as any;
    expect(result.run.status).toBe('completed');
    expect(replay).toEqual(expect.objectContaining({
      contractVersion: RUN_ARTIFACT_RECEIPT_REPLAY_CONTRACT_VERSION,
      source: 'RunArtifactReceiptReplayService',
      summary: expect.objectContaining({
        artifactLinkCount: expect.any(Number),
        frameCount: expect.any(Number),
        replayable: true,
      }),
      policy: expect.objectContaining({
        noToolExecutedByReplay: true,
        noFilesystemReadPerformed: true,
        noArtifactMutation: true,
        replayUsesReceiptsOnly: true,
      }),
    }));
    expect(replay.summary.frameCount).toBeGreaterThan(0);
    expect(replay.summary.artifactLinkCount).toBeGreaterThanOrEqual(1);
    expect(replay.artifactLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        artifactId: 'artifact-agent-replay',
      }),
    ]));
  });
});
