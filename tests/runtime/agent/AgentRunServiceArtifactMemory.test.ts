import {
  AgentRunService,
  ARTIFACT_MEMORY_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-artifact-memory-${++index}`;
}

describe('AgentRunService Artifact Memory Artifact Memory', () => {
  it('publishes run.metadata.artifactMemory during the agent run lifecycle', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:38:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Artifacts ready for memory with provenance.',
        replyText: 'ok',
        artifacts: [
          {
            id: 'artifact-agent-plan',
            title: 'Executor plan',
            kind: 'plan' as const,
            createdAt: '2026-05-04T00:38:00.000Z',
            status: 'ready' as const,
          },
          {
            id: 'artifact-agent-report',
            title: 'Report do executor',
            kind: 'report' as const,
            createdAt: '2026-05-04T00:38:00.000Z',
            status: 'ready' as const,
          },
        ],
        metadata: {
          taskId: 'agent-run-artifact-memory',
          artifactSummaries: {
            'artifact-agent-plan': {
              summary: 'Plan created by the executor and indexed without reading file.',
            },
          },
        },
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-artifact-memory',
      text: 'publique artifact memory',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
    });

    const artifactMemory = result.run.metadata.artifactMemory as any;
    expect(result.run.status).toBe('completed');
    expect(artifactMemory).toEqual(expect.objectContaining({
      contractVersion: ARTIFACT_MEMORY_CONTRACT_VERSION,
      source: 'ArtifactMemoryService',
      summary: expect.objectContaining({
        artifactCount: 2,
        memoryEntryCount: 3,
        reusableCount: 3,
        searchReady: true,
      }),
      policy: expect.objectContaining({
        noArtifactContentInvented: true,
        noArtifactMutation: true,
        reusedArtifactMustCiteOrigin: true,
      }),
    }));
    expect(artifactMemory.entries.some((entry: any) => entry.artifactId === 'artifact-agent-plan')).toBe(true);
    expect(artifactMemory.entries.some((entry: any) => entry.kind === 'run-summary')).toBe(true);
  });
});
