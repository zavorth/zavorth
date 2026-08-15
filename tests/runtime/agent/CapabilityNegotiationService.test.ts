import {
  CAPABILITY_NEGOTIATION_CONTRACT_VERSION,
  CapabilityNegotiationService,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  const run: UniversalAgentRun = {
    id: 'run-capability-negotiation-1',
    traceId: 'trace-capability-negotiation-1',
    requestId: 'request-capability-negotiation-1',
    sessionId: 'session-capability-negotiation-1',
    userId: 'grey',
    channel: 'cli',
    title: 'Capability negotiation run',
    input: 'corrija o runtime e rode testes',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    status: 'thinking',
    createdAt: '2026-05-04T00:35:00.000Z',
    updatedAt: '2026-05-04T00:35:00.000Z',
    summary: 'Run criado.',
    events: [],
    toolExposure: {
      mode: 'restricted',
      summary: '3 ferramentas expostas com policy restricted.',
      tools: [
        {
          id: 'workspace.read',
          label: 'Workspace read',
          capabilityId: 'workspace.read',
          group: 'workspace',
          risk: 'safe',
          requiresApproval: false,
          description: 'Leitura de workspace.',
        },
        {
          id: 'write_file',
          label: 'Write file',
          capabilityId: 'write_file',
          group: 'workspace',
          risk: 'danger',
          requiresApproval: true,
          description: 'write_file pode alterar arquivos.',
        },
        {
          id: 'shell.exec',
          label: 'Shell exec',
          capabilityId: 'shell.exec',
          group: 'local_control',
          risk: 'danger',
          requiresApproval: true,
          description: 'shell.exec pode executar comandos locais.',
        },
      ],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'AI Gateway',
      modelLabel: 'Claude Sonnet 4.5',
      routingPolicy: 'gateway',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {
      targetPaths: ['src/runtime/agent', 'tests/runtime/agent'],
      naturalCapabilityDiscovery: {
        source: 'NaturalCapabilityDiscoveryService',
        recommendations: [
          {
            id: 'workspace-mutation',
            label: 'Workspace mutation',
            toolIds: ['write_file'],
            groups: ['workspace'],
            risk: 'danger',
            requiresApproval: true,
            previewRequired: false,
            permission: 'approval',
            reason: 'Pedido pode alterar arquivos.',
            nextSafeAction: 'Solicitar approval antes de escrever.',
          },
          {
            id: 'shell-execution',
            label: 'Shell execution',
            toolIds: ['shell.exec'],
            groups: ['local_control'],
            risk: 'danger',
            requiresApproval: true,
            previewRequired: false,
            permission: 'approval',
            reason: 'Pedido pede testes.',
            nextSafeAction: 'Solicitar approval antes de rodar comandos.',
          },
        ],
        quarantine: {
          blockedToolIds: [],
        },
      },
      universalPreviewMode: {
        source: 'UniversalPreviewModeService',
        planSteps: [
          {
            id: 'preview-write',
            kind: 'write',
            label: 'Preparar patch',
            toolId: 'write_file',
            risk: 'danger',
            requiresApproval: true,
            previewRequired: true,
            action: 'Gerar preview antes de aplicar.',
            impact: 'Pode alterar arquivos.',
          },
        ],
        toolExposure: {
          blockedToolIds: [],
        },
      },
    },
  };
  return {
    ...run,
    ...overrides,
    metadata: {
      ...run.metadata,
      ...(overrides.metadata || {}),
    },
  };
}

describe('CapabilityNegotiationService Capability Negotiation', () => {
  it('builds a proposal scope for sensitive multi-tool tasks', () => {
    const snapshot = new CapabilityNegotiationService({
      now: () => new Date('2026-05-04T00:36:00.000Z'),
    }).buildSnapshot({
      run: createRun(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: CAPABILITY_NEGOTIATION_CONTRACT_VERSION,
      source: 'CapabilityNegotiationService',
      status: 'proposal',
      decisionSource: 'natural-capability-discovery',
      summary: expect.objectContaining({
        approvalRequired: true,
        previewRequired: true,
        highestRisk: 'danger',
        sensitiveTask: true,
      }),
      policy: expect.objectContaining({
        noExecutionPerformed: true,
        naturalLanguageDoesNotBypassPolicy: true,
        approvedScopeLimitsTools: true,
        approvedScopeLimitsPaths: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.scope.allowedToolIds).toEqual(expect.arrayContaining([
      'write_file',
      'shell.exec',
    ]));
    expect(snapshot.scope.pathHints).toEqual(expect.arrayContaining([
      'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      'src/runtime/agent',
    ]));
    expect(snapshot.proposal?.summary).toContain('negotiate the scope');
  });

  it('marks scope as approved when the associated approval is approved', () => {
    const run = createRun({
      approvals: [
        {
          id: 'approval-capability-scope',
          runId: 'run-capability-negotiation-1',
          title: 'Aprovar escopo de capabilities',
          reason: 'Escopo sensivel.',
          risk: 'danger',
          status: 'approved',
          createdAt: '2026-05-04T00:36:00.000Z',
        },
      ],
      metadata: {
        capabilityNegotiation: {
          status: 'waiting-approval',
          approvalId: 'approval-capability-scope',
          scope: {
            id: 'capability-scope-run-capability-negotiation-1',
          },
        },
      },
    });

    const snapshot = new CapabilityNegotiationService().buildSnapshot({ run });

    expect(snapshot.status).toBe('approved');
    expect(snapshot.scope.approved).toBe(true);
    expect(snapshot.policy.approvalsStillRequired).toBe(false);
    expect(snapshot.nextSafeAction).toContain('approved scope');
  });
});
