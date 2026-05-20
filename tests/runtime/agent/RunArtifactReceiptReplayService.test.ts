import {
  AgentRunService,
  RUN_ARTIFACT_RECEIPT_REPLAY_CONTRACT_VERSION,
  RunArtifactReceiptReplayService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-replay-hardening-${++index}`;
}

describe('RunArtifactReceiptReplayService Channel mesh5', () => {
  it('builds a receipts-only replay snapshot across run, artifacts, and feature metadata', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:45:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-replay-hardening',
      text: 'audite artifacts e receipts do run',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        artifactMemory: {
          source: 'ArtifactMemoryService',
          contractVersion: '2026-05-03.artifact-memory',
          status: 'ready',
          entries: [
            {
              artifactId: 'artifact-replay-plan',
              title: 'Plano replay',
              kind: 'plan',
              category: 'plan',
              receipt: {
                observatoryReceiptId: 'receipt:artifact-replay-plan',
                memoryReceiptId: 'memory:artifact-replay-plan',
              },
            },
          ],
          receipts: [
            {
              id: 'artifact-memory:receipt',
              kind: 'artifact-ledger',
              source: 'ArtifactMemoryService',
              detail: 'Artifact possui origem citavel.',
              status: 'ready',
            },
          ],
        },
        memoryWithReceipts: {
          source: 'MemoryWithReceiptsService',
          contractVersion: '2026-05-03.memory-receipts',
          receipts: [
            {
              id: 'memory:artifact-replay-plan',
              kind: 'memory',
              source: 'MemoryWithReceiptsService',
              detail: 'Memoria ligada ao artifact.',
              status: 'ready',
            },
          ],
        },
        providerMeshConsolidation: {
          source: 'ProviderMeshConsolidationService',
          contractVersion: '2026-05-04.provider-mesh',
          status: 'ready',
          receipts: [
            {
              id: 'provider-mesh:receipt',
              kind: 'route',
              source: 'ProviderMeshConsolidationService',
              detail: 'Rota do model picker registrada.',
              status: 'ready',
            },
          ],
        },
        universalIntentTrustEnforcement: {
          source: 'UniversalIntentTrustEnforcementService',
          contractVersion: '2026-05-04.trust-enforcement',
          status: 'allow',
          receipts: [
            {
              id: 'uni-trust:receipt',
              kind: 'policy',
              source: 'UniversalIntentTrustEnforcementService',
              detail: 'Trust Slider avaliado antes do replay.',
              status: 'ready',
            },
          ],
        },
      },
    });
    run.artifacts = [
      {
        id: 'artifact-replay-plan',
        title: 'Plano replay',
        kind: 'plan',
        createdAt: run.updatedAt,
        sessionId: run.sessionId,
        status: 'ready',
      },
    ];

    const snapshot = new RunArtifactReceiptReplayService({
      now: () => new Date('2026-05-04T00:45:00.000Z'),
    }).buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: RUN_ARTIFACT_RECEIPT_REPLAY_CONTRACT_VERSION,
      source: 'RunArtifactReceiptReplayService',
      status: expect.stringMatching(/ready|partial/),
      summary: expect.objectContaining({
        artifactLinkCount: 1,
        artifactMemoryLinked: true,
        memoryWithReceiptsLinked: true,
        runObservatoryLinked: true,
      }),
      policy: expect.objectContaining({
        noToolExecutedByReplay: true,
        noFilesystemReadPerformed: true,
        noArtifactContentInvented: true,
        replayUsesReceiptsOnly: true,
        naturalLanguageDoesNotBypassPolicy: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.summary.frameCount).toBeGreaterThan(0);
    expect(snapshot.features).toEqual(expect.arrayContaining([
      expect.objectContaining({ featureId: 'artifact-memory', present: true }),
      expect.objectContaining({ featureId: 'memory-with-receipts', present: true }),
      expect.objectContaining({ featureId: 'provider-mesh', present: true }),
      expect.objectContaining({ featureId: 'uni-trust', present: true }),
    ]));
    expect(snapshot.artifactLinks[0]).toEqual(expect.objectContaining({
      artifactId: 'artifact-replay-plan',
      commands: expect.objectContaining({
        replayCommand: 'zavorth replay artifact artifact-replay-plan',
      }),
    }));
  });
});
