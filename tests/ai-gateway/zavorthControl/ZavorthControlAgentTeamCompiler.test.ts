import { buildZavorthControlZavorthControlViewModel } from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.js';
import { mapZavorthControlRunObservatory } from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlRunObservatory.js';
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  AgentTeamCompilerService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-agent-team-${++index}`;
}

describe('ZavorthControl Agent Team Compiler Channel mesh0', () => {
  it('projects agentTeamCompiler metadata into the zavorthControl view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-agent-team',
      text: 'compile an agent team to review and implement',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner', 'implementer', 'verifier'],
      },
    });
    run.metadata.agentTeamCompiler = new AgentTeamCompilerService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
        perceptionControl: {
          status: 'active',
          selectedRoute: 'local',
        },
      },
      wsStatus: 'connected',
      agentRun: {
        id: run.id,
        status: 'completed',
        metadata: run.metadata,
      },
      agentTeamCompiler: run.metadata.agentTeamCompiler as any,
      dynamicWorkflow: {
        apiKey: 'plain-api-key',
        nested: {
          password: 'hunter2',
        },
        note: 'token=secret-value',
      },
    });

    expect(viewModel.agentTeamCompiler).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.track-40',
      status: 'waiting-approval',
      summary: expect.objectContaining({
        roleCount: 3,
        approvalRequiredCount: 3,
        compilerOnly: true,
      }),
      approval: expect.objectContaining({
        required: true,
        approvalId: expect.stringContaining('agent-team-approval:'),
      }),
      launch: expect.objectContaining({
        mode: 'approval-gated-team-run',
        directToolExecution: false,
        synthesisRequired: true,
        executionAuthority: 'subagent-runtime-required',
      }),
      policy: expect.objectContaining({
        noSubagentsLaunched: true,
        approvalRequiredBeforeLaunch: true,
        budgetsDefaultToZero: true,
      }),
    }));
    expect(viewModel.agentTeamCompiler?.roles[0]?.actions.previewCommand).toContain('zavorth agent-team preview');
    expect(viewModel.perceptionControl).toEqual(expect.objectContaining({
      status: 'active',
      selectedRoute: 'local',
    }));
    expect(JSON.stringify(viewModel.dynamicWorkflow)).not.toContain('plain-api-key');
    expect(JSON.stringify(viewModel.dynamicWorkflow)).not.toContain('hunter2');
    expect(JSON.stringify(viewModel.dynamicWorkflow)).not.toContain('secret-value');
    expect(viewModel.dynamicWorkflow.apiKey).toBe('[redacted-secret]');
    expect(viewModel.dynamicWorkflow.nested.password).toBe('[redacted-secret]');
  });

  it('maps gateway snapshots with Agent Team Compiler into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com agent team compiler',
        replyText: 'ok',
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-agent-team-live',
      text: 'compile an agent team to validate this delivery',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner', 'verifier'],
      },
    });
    result.run.metadata.perceptionControl = {
      status: 'active',
      selectedRoute: 'gateway',
    };
    result.run.metadata.dynamicWorkflow = {
      key: 'raw-key',
      nested: {
        accessToken: 'raw-token',
      },
      note: 'api_key=raw-secret',
    };

    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.agentTeamCompiler).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.track-40',
      summary: expect.objectContaining({
        roleCount: 2,
        approvalRequiredCount: 2,
        compilerOnly: true,
      }),
      policy: expect.objectContaining({
        noSubagentsLaunched: true,
      }),
      launch: expect.objectContaining({
        directToolExecution: false,
      }),
    }));
    expect(projection.perceptionControl).toEqual(expect.objectContaining({
      status: 'active',
      selectedRoute: 'gateway',
    }));
    expect(JSON.stringify(projection.dynamicWorkflow)).not.toContain('raw-key');
    expect(JSON.stringify(projection.dynamicWorkflow)).not.toContain('raw-token');
    expect(JSON.stringify(projection.dynamicWorkflow)).not.toContain('raw-secret');
    expect(projection.dynamicWorkflow.key).toBe('[redacted-secret]');
    expect(projection.dynamicWorkflow.nested.accessToken).toBe('[redacted-secret]');
  });

  it('returns a full empty run observatory shape for absent input', () => {
    const observatory = mapZavorthControlRunObservatory(null);

    expect(observatory).toEqual(expect.objectContaining({
      query: {},
      totalRuns: 0,
      matchedRuns: 0,
      runs: [],
      diffPreviews: [],
      intelligenceFabricHealth: {},
      extensions: {},
    }));
    expect(observatory.zavorthControlIntelligenceFabricHealth).toBeUndefined();
    expect(observatory.indexes).toEqual(expect.objectContaining({
      runIds: [],
      traceIds: [],
      sessionIds: [],
      statuses: [],
    }));
  });
});
