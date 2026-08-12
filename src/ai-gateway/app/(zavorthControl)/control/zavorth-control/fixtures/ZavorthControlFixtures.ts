import { buildZavorthControlZavorthControlViewModel } from '../adapters/ZavorthControlAdapter';

export const ZAVORTH_CONTROL_FIXTURE_IDS = [
  'safe-run',
  'awaiting-approval',
  'remote-mesh-mcp-approval',
  'failed-run',
  'artifact-ready',
  'replay-available',
  'policy-blocked',
  'budget-exceeded',
  'auto-subagents',
  'first-run-pending',
  'doctor-degraded',
  'release-preview-ready',
] as const;

export type ZavorthControlZavorthControlFixtureId = typeof ZAVORTH_CONTROL_FIXTURE_IDS[number];

type Fixture = {
  id: ZavorthControlZavorthControlFixtureId;
  label: string;
  description: string;
  input: Record<string, any>;
};

const generatedAt = '2026-04-26T14:00:00.000Z';

function baseInput(id: ZavorthControlZavorthControlFixtureId): Record<string, any> {
  return {
    generatedAt,
    adapterSource: {
      kind: 'contract-fixture',
      label: 'ZavorthControl Contract Fixture',
      fixtureId: id,
    },
    runtime: {
      status: 'ready',
      provider: 'Zavorth',
      model: 'native-runtime',
    },
    wsStatus: 'connected',
    sessionEntries: [{
      id: `session-${id}`,
      title: 'Main Session',
      status: 'active',
      channel: 'web',
      updatedAt: generatedAt,
    }],
    transcriptEntries: [
      {
        id: `message-user-${id}`,
        role: 'user',
        text: 'Run the task safely.',
        createdAt: generatedAt,
      },
      {
        id: `message-assistant-${id}`,
        role: 'assistant',
        text: 'Zavorth prepared the next visible step.',
        createdAt: generatedAt,
      },
    ],
    actions: [{ id: 'runtime.inspect', group: 'runtime', label: 'Ver detalhes' }],
  };
}

const fixtures: Record<ZavorthControlZavorthControlFixtureId, Fixture> = {
  'safe-run': {
    id: 'safe-run',
    label: 'Safe run',
    description: 'Run completed without approval and with a read-only tool.',
    input: {
      ...baseInput('safe-run'),
      agentRun: {
        id: 'run-safe-001',
        status: 'completed',
        title: 'Read local context',
        summary: 'Contexto lido without mutation.',
        sessionId: 'session-safe-run',
        events: [{ id: 'tool-read-file', kind: 'tool', title: 'read_file', status: 'done' }],
      },
      toolExposure: {
        mode: 'safe',
        tools: [{ id: 'read_file', label: 'Read file', risk: 'safe', requiresApproval: false }],
      },
      providerCockpit: {
        status: 'ready',
        selectedProviderId: 'zavorth-native',
        safety: {
          normalRenderMakesNoNetworkCalls: true,
          noRawProviderSecrets: true,
          zavorthControlCannotExecuteProviderCalls: true,
        },
      },
    },
  },
  'awaiting-approval': {
    id: 'awaiting-approval',
    label: 'Approval required',
    description: 'Run waiting for write approval.',
    input: {
      ...baseInput('awaiting-approval'),
      agentRun: {
        id: 'run-approval-001',
        status: 'waiting_approval',
        title: 'Edit file',
        summary: 'Waiting for approval before writing.',
        approvals: [{ id: 'approval-write-001', title: 'Edit local file', status: 'pending', risk: 'danger' }],
      },
      toolExposure: {
        mode: 'confirm',
        tools: [{ id: 'write_file', label: 'Edit file', risk: 'danger', requiresApproval: true }],
      },
    },
  },
  'remote-mesh-mcp-approval': {
    id: 'remote-mesh-mcp-approval',
    label: 'Remote Mesh MCP approval',
    description: 'Preview of the real MCP approval button through the governed proxy.',
    input: {
      ...baseInput('remote-mesh-mcp-approval'),
      agentRun: {
        id: 'run-remote-mesh-001',
        status: 'waiting_approval',
        title: 'Approve Docker restart',
        approvals: [{ id: 'approval-mcp-001', title: 'Approve Docker restart', status: 'pending', risk: 'danger' }],
      },
      remoteMeshApprovalUx: {
        commands: {
          zavorthControlProxyPath: '/api/web/remote-mesh/notebook/mcp',
        },
        cards: [{
          id: 'approval-mcp-001',
          surface: 'zavorthControl',
          title: 'Approve Docker restart',
          zavorthControl: {
            primaryActionLabel: 'Apply to MCP',
          },
        }],
      },
    },
  },
  'failed-run': {
    id: 'failed-run',
    label: 'Failed run',
    description: 'Failure renderizada com health blocked e log de error.',
    input: {
      ...baseInput('failed-run'),
      runtimeStatus: 'blocked',
      agentRun: {
        id: 'run-failed-001',
        status: 'failed',
        title: 'Render panel',
        summary: 'Renderer blocked by structured error.',
      },
      health: {
        status: 'blocked',
        checks: [{ id: 'renderer', label: 'Renderer', status: 'blocked' }],
      },
      logs: [{ id: 'log-failed-001', level: 'error', runId: 'run-failed-001', message: 'Renderer failed safely.' }],
    },
  },
  'artifact-ready': {
    id: 'artifact-ready',
    label: 'Artifacts ready',
    description: 'Artifacts ready without confundir com replay.',
    input: {
      ...baseInput('artifact-ready'),
      agentRun: {
        id: 'run-artifact-001',
        status: 'completed',
        title: 'Prepare diff and plan',
        events: [{ id: 'tool-workspace-diff', kind: 'tool', title: 'workspace.diff', status: 'done' }],
      },
      artifacts: [
        { id: 'artifact-diff-001', kind: 'diff', title: 'Diff', status: 'ready' },
        { id: 'artifact-plan-001', kind: 'plan', title: 'Plan', status: 'ready' },
      ],
    },
  },
  'replay-available': {
    id: 'replay-available',
    label: 'Replay available',
    description: 'Replay available for an auditable execution.',
    input: {
      ...baseInput('replay-available'),
      agentRun: { id: 'run-replay-001', status: 'completed', title: 'review run' },
      replay: {
        id: 'replay-run-001',
        runId: 'run-replay-001',
        status: 'available',
        eventCount: 7,
        artifactCount: 1,
      },
    },
  },
  'policy-blocked': {
    id: 'policy-blocked',
    label: 'Policy blocked',
    description: 'Network blocked by policy before execution.',
    input: {
      ...baseInput('policy-blocked'),
      runtimeStatus: 'blocked',
      agentRun: {
        id: 'run-policy-001',
        status: 'failed',
        title: 'Pesquisar rede',
        summary: 'Execution blocked by network policy.',
      },
      health: {
        status: 'blocked',
        checks: [{ id: 'network-policy', label: 'Network policy', status: 'blocked' }],
      },
      toolExposure: {
        mode: 'confirm',
        tools: [{ id: 'web.search', label: 'Pesquisar web', risk: 'danger', requiresApproval: true }],
      },
    },
  },
  'budget-exceeded': {
    id: 'budget-exceeded',
    label: 'Budget exceeded',
    description: 'Run retida porque o budget foi excedido.',
    input: {
      ...baseInput('budget-exceeded'),
      runtimeStatus: 'degraded',
      agentRun: { id: 'run-budget-001', status: 'queued', title: 'run task longa' },
      budget: {
        status: 'exceeded',
        tokenBudget: 10000,
        tokensUsed: 14200,
      },
    },
  },
  'auto-subagents': {
    id: 'auto-subagents',
    label: 'Auto subagents',
    description: 'Automatic delegation with safe limits.',
    input: {
      ...baseInput('auto-subagents'),
      agentRun: { id: 'run-subagents-001', status: 'running', title: 'Auditoria profunda' },
      subagentAutoInvocation: {
        status: 'auto-selected',
        selectedBy: 'implicit-complexity',
        live: true,
        roles: [
          { roleId: 'researcher', label: 'Researcher' },
          { roleId: 'auditor', label: 'Auditor' },
        ],
        safety: {
          readOnlyOnly: true,
          approvalsRequiredForMutation: true,
        },
      },
    },
  },
  'first-run-pending': {
    id: 'first-run-pending',
    label: 'First run pending',
    description: 'Onboarding inicial pending e reversible.',
    input: {
      ...baseInput('first-run-pending'),
      runtimeStatus: 'degraded',
      identity: {
        agentName: 'Zavorth',
        firstRunStatus: 'pending',
        summary: 'Missing name, tone, and initial preferences.',
      },
    },
  },
  'doctor-degraded': {
    id: 'doctor-degraded',
    label: 'Doctor degraded',
    description: 'Primary provider needs configuration.',
    input: {
      ...baseInput('doctor-degraded'),
      runtimeStatus: 'degraded',
      health: {
        status: 'degraded',
        checks: [
          { id: 'provider-primary', label: 'Primary provider', status: 'degraded' },
          { id: 'channel-primary', label: 'Primary channel', status: 'ready' },
        ],
      },
      integrations: [{ id: 'provider-primary', label: 'Primary provider', status: 'degraded' }],
    },
  },
  'release-preview-ready': {
    id: 'release-preview-ready',
    label: 'Release preview ready',
    description: 'Preview ready com rollback available.',
    input: {
      ...baseInput('release-preview-ready'),
      releaseStatus: {
        status: 'preview_ready',
        channel: 'preview',
        rollbackAvailable: true,
        version: '2026.04.26-preview',
      },
    },
  },
};

export function listZavorthControlZavorthControlFixtures(): Fixture[] {
  return ZAVORTH_CONTROL_FIXTURE_IDS.map((id) => fixtures[id]);
}

export function getZavorthControlZavorthControlFixture(id: ZavorthControlZavorthControlFixtureId): Fixture {
  return fixtures[id];
}

export function buildZavorthControlZavorthControlFixture(id: ZavorthControlZavorthControlFixtureId): Record<string, any> {
  return buildZavorthControlZavorthControlViewModel(fixtures[id].input);
}
