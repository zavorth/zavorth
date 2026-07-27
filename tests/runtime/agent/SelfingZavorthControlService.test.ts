import {
  SELFING_ZAVORTH_CONTROL_CONTRACT_VERSION,
  SelfingZavorthControlService,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-selfing-zavorthControl-1',
    traceId: 'trace-selfing-zavorthControl-1',
    requestId: 'request-selfing-zavorthControl-1',
    sessionId: 'session-selfing-zavorthControl-1',
    userId: 'grey',
    channel: 'cli',
    title: 'Selfing zavorthControl run',
    input: 'revise identity and memory',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    status: 'completed',
    createdAt: '2026-05-04T00:37:00.000Z',
    updatedAt: '2026-05-04T00:37:00.000Z',
    summary: 'Selfing published.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'workspace read and memory read available',
      tools: [
        {
          id: 'workspace.read',
          label: 'Workspace read',
          risk: 'safe',
          requiresApproval: false,
        },
        {
          id: 'memory.read',
          label: 'Memory read',
          risk: 'safe',
          requiresApproval: false,
        },
      ],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'openai',
      modelLabel: 'gpt-test',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [
      {
        id: 'memory-tone',
        title: 'Tone preference',
        layer: 'semantic',
        summary: 'User prefers short replies in English.',
        confidence: 0.9,
      },
      {
        id: 'memory-low',
        title: 'Uncertain memory',
        layer: 'episodic',
        summary: 'Memory with low confidence.',
        confidence: 0.34,
      },
    ],
    metadata: {
      canonicalContext: {
        warm: {
          workspaceProfile: {
            workspaceName: 'Zavorth',
            agentDisplayName: 'Zavorth',
            userDisplayName: 'Grey',
            tonePreference: 'direct and technical',
            memoryMode: 'receipts-first',
            safetyPosture: 'preview-before-apply',
            firstRunProfilePath: '.zavorth/profile.json',
          },
          identityFiles: [
            {
              path: 'SOUL.md',
              exists: true,
              summary: 'Zavorth living identity.',
            },
            {
              path: 'USER.md',
              exists: true,
              summary: 'User preferences.',
            },
            {
              path: 'MEMORY.md',
              exists: true,
              summary: 'Important memories.',
            },
          ],
        },
        cold: {
          memoryPrompt: 'Canonical memory with receipts.',
        },
      },
      memoryWithReceipts: {
        summary: {
          receiptCount: 2,
          lowConfidenceCount: 1,
        },
        receipts: [
          {
            id: 'receipt-memory-tone',
            memoryId: 'memory-tone',
            title: 'Tone preference',
            layer: 'semantic',
            summary: 'User prefers short replies in English.',
            source: 'memory-signal',
            confidence: 0.9,
            confidenceLabel: 'high',
            actions: {
              reviewCommand: 'zavorth memory receipts run run-selfing-zavorthControl-1',
              askSourceCommand: 'zavorth memory source memory-tone',
              forgetCommand: 'zavorth memory forget memory-tone',
              correctCommand: 'zavorth memory correct memory-tone "<new value>"',
            },
          },
          {
            id: 'receipt-memory-low',
            memoryId: 'memory-low',
            title: 'Uncertain memory',
            layer: 'episodic',
            summary: 'Memory with low confidence.',
            source: 'memory-signal',
            confidence: 0.34,
            confidenceLabel: 'low',
            actions: {
              reviewCommand: 'zavorth memory receipts run run-selfing-zavorthControl-1',
              askSourceCommand: 'zavorth memory source memory-low',
              forgetCommand: 'zavorth memory forget memory-low',
              correctCommand: 'zavorth memory correct memory-low "<new value>"',
            },
          },
        ],
      },
      trustPosture: {
        trustMode: 'collaborator',
        blocked: false,
      },
    },
    ...overrides,
  };
}

describe('SelfingZavorthControlService Selfing ZavorthControl', () => {
  it('builds a read-only identity and memory zavorthControl with preview/versioning policy', () => {
    const snapshot = new SelfingZavorthControlService({
      now: () => new Date('2026-05-04T00:38:00.000Z'),
    }).buildSnapshot({
      run: createRun(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: SELFING_ZAVORTH_CONTROL_CONTRACT_VERSION,
      source: 'SelfingZavorthControlService',
      status: 'needs-review',
      identity: expect.objectContaining({
        agentName: 'Zavorth',
        userName: 'Grey',
        trustMode: 'collaborator',
      }),
      summary: expect.objectContaining({
        identityFileCount: 3,
        memoryReceiptCount: 2,
        lowConfidenceMemoryCount: 1,
        versionedChangesRequired: true,
      }),
      policy: expect.objectContaining({
        readOnlySnapshot: true,
        noIdentityChanged: true,
        noMemoryChanged: true,
        changesRequirePreview: true,
        changesAreVersioned: true,
        memoryCorrectionsUseReceipts: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section: 'identity',
        title: 'SOUL.md',
        previewRequired: true,
        versioned: true,
      }),
      expect.objectContaining({
        section: 'memory',
        title: 'Tone preference',
        source: 'memory-signal',
      }),
    ]));
    expect(snapshot.suggestions.some((suggestion) => suggestion.id === 'selfing:suggestion:low-confidence-memory')).toBe(true);
  });

  it('does not serialize secrets from identity file content', () => {
    const snapshot = new SelfingZavorthControlService().buildSnapshot({
      run: createRun({
        metadata: {
          canonicalContext: {
            warm: {
              identityFiles: [
                {
                  path: 'IDENTITY.md',
                  exists: true,
                  content: 'api_key=sk-test-secret should never appear',
                },
              ],
            },
          },
        },
      }),
    });

    expect(snapshot.cards[0]?.value).toContain('[redacted]');
    expect(snapshot.cards[0]?.value).not.toContain('sk-test-secret');
  });
});
