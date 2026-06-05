import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.js';
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ProductizationEvidenceService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-productization-evidence-${++index}`;
}

describe('ZavorthControl productization evidence Channel mesh6', () => {
  it('projects productizationEvidence metadata into the zavorthControl view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T01:46:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-productization-evidence',
      text: 'audite release readiness do produto',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        productizationContract: {
          source: 'ZavorthProductizationContractService',
          stage: 'C9',
          status: 'ready',
          control: { ready: true },
          cli: { ready: true },
          sdk: { ready: true },
          docs: { ready: true },
          website: { ready: true },
        },
        releaseStatus: {
          status: 'preview',
          channel: 'preview',
        },
      },
    });
    run.metadata.productizationEvidence = new ProductizationEvidenceService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: run.id,
        status: 'completed',
        metadata: run.metadata,
      },
      productizationEvidence: run.metadata.productizationEvidence as any,
    });

    expect(viewModel.productizationEvidence).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.product-evidence',
      status: expect.stringMatching(/ready|partial/),
      summary: expect.objectContaining({
        productizationContractLinked: true,
        releasePreviewReady: true,
        stableReleaseAllowed: false,
      }),
      releaseReadiness: expect.objectContaining({
        status: 'preview-ready',
        channel: 'preview',
      }),
      policy: expect.objectContaining({
        noReleasePublished: true,
        stableRequiresRealRelease: true,
        secretsSerialized: false,
      }),
    }));
    expect(viewModel.productizationEvidence?.gates.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with productization evidence into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T01:46:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com productization evidence',
        replyText: 'ok',
        artifacts: [
          {
            id: 'artifact-gateway-productization-evidence',
            title: 'Artifact Gateway Productization Evidence',
            kind: 'report',
            createdAt: '2026-05-04T01:46:00.000Z',
            status: 'ready',
          },
        ],
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-productization-evidence-live',
      text: 'prepare produto para preview release',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        productizationContract: {
          source: 'ZavorthProductizationContractService',
          stage: 'C9',
          status: 'ready',
          control: { ready: true },
          cli: { ready: true },
          sdk: { ready: true },
          docs: { ready: true },
          website: { ready: true },
        },
        releaseStatus: {
          status: 'preview',
          channel: 'preview',
        },
      },
    });

    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.productizationEvidence).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.product-evidence',
      summary: expect.objectContaining({
        productizationContractLinked: true,
        replayLinked: true,
        stableReleaseAllowed: false,
      }),
      releaseReadiness: expect.objectContaining({
        status: 'preview-ready',
      }),
      policy: expect.objectContaining({
        noReleasePublished: true,
        noInstallerExecuted: true,
      }),
    }));
    expect(projection.productizationEvidence?.gates.length).toBeGreaterThan(0);
  });
});
