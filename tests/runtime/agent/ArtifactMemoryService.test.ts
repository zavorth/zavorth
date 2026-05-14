import {
  ARTIFACT_MEMORY_CONTRACT_VERSION,
  ArtifactMemoryService,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-artifact-memory-1',
    traceId: 'trace-artifact-memory-1',
    requestId: 'request-artifact-memory-1',
    sessionId: 'session-artifact-memory-1',
    userId: 'grey',
    channel: 'cli',
    title: 'Artifact memory run',
    input: 'indexe artifacts para reuso',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    status: 'completed',
    createdAt: '2026-05-04T00:38:00.000Z',
    updatedAt: '2026-05-04T00:38:00.000Z',
    summary: 'Artifact Memory indexou artifacts citaveis.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'workspace read e artifacts read disponiveis',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'openai',
      modelLabel: 'gpt-test',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [
      {
        id: 'artifact-plan-wave-38',
        title: 'Plano Wave 38 Artifact Memory',
        kind: 'plan',
        createdAt: '2026-05-04T00:38:00.000Z',
        sessionId: 'session-artifact-memory-1',
        status: 'ready',
      },
      {
        id: 'artifact-report-wave-38',
        title: 'Relatorio Artifact Memory',
        kind: 'report',
        createdAt: '2026-05-04T00:38:00.000Z',
        sessionId: 'session-artifact-memory-1',
        status: 'ready',
      },
      {
        id: 'artifact-diff-wave-38',
        title: 'Diff Artifact Memory',
        kind: 'diff',
        createdAt: '2026-05-04T00:38:00.000Z',
        sessionId: 'session-artifact-memory-1',
        status: 'draft',
      },
    ],
    memorySignals: [],
    metadata: {
      taskId: 'wave-38',
      artifactSummaries: {
        'artifact-plan-wave-38': {
          summary: 'Plano para pesquisa e reuso de artifacts com origem.',
        },
      },
      memoryWithReceipts: {
        receipts: [
          {
            id: 'receipt-artifact-plan',
            origin: {
              kind: 'artifact',
              artifactId: 'artifact-plan-wave-38',
              ref: 'artifact-plan-wave-38',
            },
          },
        ],
      },
    },
    ...overrides,
  };
}

describe('ArtifactMemoryService Wave 38', () => {
  it('builds a read-only searchable memory index for artifacts with receipts', () => {
    const snapshot = new ArtifactMemoryService({
      now: () => new Date('2026-05-04T00:39:00.000Z'),
    }).buildSnapshot({
      run: createRun(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: ARTIFACT_MEMORY_CONTRACT_VERSION,
      source: 'ArtifactMemoryService',
      status: 'ready',
      summary: expect.objectContaining({
        artifactCount: 3,
        memoryEntryCount: 4,
        reusableCount: 4,
        linkedMemoryReceiptCount: 1,
        runObservatoryLinked: true,
        searchReady: true,
      }),
      policy: expect.objectContaining({
        noArtifactContentInvented: true,
        noFilesystemReadPerformed: true,
        noArtifactMutation: true,
        memoryWriteNotPerformed: true,
        promotionRequiresExplicitAction: true,
        reusedArtifactMustCiteOrigin: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.summary.indexedCategories).toEqual(expect.arrayContaining([
      'plan',
      'report',
      'diff',
      'run-summary',
    ]));
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        artifactId: 'artifact-plan-wave-38',
        receipt: expect.objectContaining({
          memoryReceiptId: 'receipt-artifact-plan',
        }),
        actions: expect.objectContaining({
          citeCommand: 'zavorth artifact-memory cite artifact-plan-wave-38',
        }),
      }),
    ]));
  });

  it('redacts secrets from metadata candidates without reading filesystem content', () => {
    const snapshot = new ArtifactMemoryService().buildSnapshot({
      run: createRun({
        artifacts: [],
        summary: '',
        metadata: {
          artifactMemoryCandidates: [
            {
              artifactId: 'artifact-secret-report',
              title: 'Relatorio com secret',
              kind: 'report',
              summary: 'token=super-secret-123 nao pode vazar',
              status: 'ready',
            },
          ],
        },
      }),
    });

    expect(snapshot.status).toBe('needs-index');
    expect(snapshot.entries[0]?.summary).toContain('token=[redacted]');
    expect(snapshot.entries[0]?.summary).not.toContain('super-secret-123');
    expect(snapshot.policy.noFilesystemReadPerformed).toBe(true);
  });
});
