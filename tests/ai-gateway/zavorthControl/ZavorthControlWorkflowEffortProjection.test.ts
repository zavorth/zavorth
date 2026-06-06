import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.js';
import {
  buildZavorthControlAdapterInputFromZavorthControlRuntimeProjection,
  buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot,
} from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/index.js';
import { AgentRunService, AgentTeamCompilerService } from '../../../src/runtime/agent/index.js';
import { ZavorthDynamicWorkflowService } from '../../../src/services/ZavorthDynamicWorkflowService.js';
import { ZavorthEffortControlService } from '../../../src/services/ZavorthEffortControlService.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-workflow-effort-${++index}`;
}

describe('ZavorthControl workflow and effort projection', () => {
  const now = () => new Date('2026-06-06T09:00:00.000Z');

  it('projects effort control and dynamic workflow metadata into the view model without leaking secrets', () => {
    const dynamicWorkflow = new ZavorthDynamicWorkflowService({ now }).buildPreview({
      objective: 'revise 60 arquivos com token=secret-value e sintetize achados',
      requestedFanout: 60,
      maxConcurrency: 10,
      maxCents: 120,
      workerModelClass: 'cheap',
      synthesisModelClass: 'premium',
    });
    const effortControl = new ZavorthEffortControlService({ now }).buildSnapshot({
      level: 'ultra-code',
      request: 'revise 60 arquivos com token=secret-value',
      maxCents: 120,
    });
    const gatewaySnapshot = {
      generatedAt: now().toISOString(),
      activeRun: {
        id: 'run-workflow-effort',
        traceId: 'trace-workflow-effort',
        requestId: 'request-workflow-effort',
        sessionId: 'session-workflow-effort',
        userId: 'grey',
        channel: 'web',
        status: 'completed',
        title: 'revise 60 arquivos',
        input: 'revise 60 arquivos',
        createdAt: now().toISOString(),
        updatedAt: now().toISOString(),
        metadata: {
          dynamicWorkflow,
          effortControl,
        },
      },
    };

    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(gatewaySnapshot);
    const adapterInput = buildZavorthControlAdapterInputFromZavorthControlRuntimeProjection(projection);
    const viewModel = buildZavorthControlZavorthControlViewModel(adapterInput);

    expect(projection.dynamicWorkflow).toEqual(expect.objectContaining({
      contractVersion: 'zavorth-dynamic-workflows/1',
      status: 'needs-approval',
      scale: expect.objectContaining({
        effectiveFanout: 60,
        maxConcurrency: 10,
      }),
      safety: expect.objectContaining({
        noSecretSerialization: true,
      }),
    }));
    expect(projection.effortControl).toEqual(expect.objectContaining({
      contractVersion: 'zavorth-effort-control/1',
      effectiveLevel: 'ultra-code',
      safety: expect.objectContaining({
        noChainOfThoughtExposure: true,
      }),
    }));
    expect(viewModel.dynamicWorkflow).toEqual(expect.objectContaining({
      status: 'needs-approval',
      scale: expect.objectContaining({ effectiveFanout: 60 }),
    }));
    expect(viewModel.effortControl).toEqual(expect.objectContaining({
      effectiveLevel: 'ultra-code',
      routing: expect.objectContaining({
        dynamicWorkflowsRecommended: true,
      }),
    }));
    expect(JSON.stringify(viewModel)).not.toContain('secret-value');
  });

  it('falls back to agentRun metadata when Agent Team Compiler is not passed as a top-level field', () => {
    const run = new AgentRunService({
      now,
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-agent-team-fallback',
      text: 'compile equipe de agentes para validar workflow',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner', 'verifier'],
      },
    });
    run.metadata.agentTeamCompiler = new AgentTeamCompilerService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: { status: 'ready' },
      wsStatus: 'connected',
      agentRun: {
        id: run.id,
        status: 'completed',
        metadata: run.metadata,
      },
    });

    expect(viewModel.agentTeamCompiler).toEqual(expect.objectContaining({
      status: 'waiting-approval',
      summary: expect.objectContaining({
        roleCount: 2,
        compilerOnly: true,
      }),
    }));
  });
});
