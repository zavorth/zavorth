import {
  AGENT_SELF_CONFIG_CONTRACT_VERSION,
  AgentSelfConfigService,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-agent-self-config-1',
    traceId: 'trace-agent-self-config-1',
    requestId: 'request-agent-self-config-1',
    sessionId: 'session-agent-self-config-1',
    userId: 'grey',
    channel: 'cli',
    title: 'Agent self config run',
    input: 'revise identidade e memoria',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    status: 'completed',
    createdAt: '2026-05-04T00:37:00.000Z',
    updatedAt: '2026-05-04T00:37:00.000Z',
    summary: 'Agent self config publicado.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'workspace read e memory read disponiveis',
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
        title: 'Preferencia de tom',
        layer: 'semantic',
        summary: 'Usuario prefere respostas curtas em portugues.',
        confidence: 0.9,
      },
      {
        id: 'memory-low',
        title: 'Memoria incerta',
        layer: 'episodic',
        summary: 'Memoria com confianca baixa.',
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
            tonePreference: 'direto e tecnico',
            memoryMode: 'receipts-first',
            safetyPosture: 'preview-before-apply',
            firstRunProfilePath: '.zavorth/profile.json',
          },
          identityFiles: [
            {
              path: 'SOUL.md',
              exists: true,
              summary: 'Identidade viva do Zavorth.',
            },
            {
              path: 'USER.md',
              exists: true,
              summary: 'Preferencias do usuario.',
            },
            {
              path: 'MEMORY.md',
              exists: true,
              summary: 'Memorias importantes.',
            },
          ],
        },
        cold: {
          memoryPrompt: 'Memoria canonica com receipts.',
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
            title: 'Preferencia de tom',
            layer: 'semantic',
            summary: 'Usuario prefere respostas curtas em portugues.',
            source: 'memory-signal',
            confidence: 0.9,
            confidenceLabel: 'high',
            actions: {
              reviewCommand: 'zavorth memory receipts run run-agent-self-config-1',
              askSourceCommand: 'zavorth memory source memory-tone',
              forgetCommand: 'zavorth memory forget memory-tone',
              correctCommand: 'zavorth memory correct memory-tone "<novo valor>"',
            },
          },
          {
            id: 'receipt-memory-low',
            memoryId: 'memory-low',
            title: 'Memoria incerta',
            layer: 'episodic',
            summary: 'Memoria com confianca baixa.',
            source: 'memory-signal',
            confidence: 0.34,
            confidenceLabel: 'low',
            actions: {
              reviewCommand: 'zavorth memory receipts run run-agent-self-config-1',
              askSourceCommand: 'zavorth memory source memory-low',
              forgetCommand: 'zavorth memory forget memory-low',
              correctCommand: 'zavorth memory correct memory-low "<novo valor>"',
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

describe('AgentSelfConfigService', () => {
  it('builds a read-only identity and memory zavorthControl with preview/versioning policy', () => {
    const snapshot = new AgentSelfConfigService({
      now: () => new Date('2026-05-04T00:38:00.000Z'),
    }).buildSnapshot({
      run: createRun(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: AGENT_SELF_CONFIG_CONTRACT_VERSION,
      source: 'AgentSelfConfigService',
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
        title: 'Preferencia de tom',
        source: 'memory-signal',
      }),
    ]));
    expect(snapshot.suggestions.some((suggestion) => suggestion.id === 'selfing:suggestion:low-confidence-memory')).toBe(true);
  });

  it('does not serialize secrets from identity file content', () => {
    const snapshot = new AgentSelfConfigService().buildSnapshot({
      run: createRun({
        metadata: {
          canonicalContext: {
            warm: {
              identityFiles: [
                {
                  path: 'IDENTITY.md',
                  exists: true,
                  content: 'api_key=sk-test-secret nunca deve aparecer',
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
