import { buildZavorthControlZavorthControlViewModel } from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.js';
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-integration-showcase-${++index}`;
}

function pilotReadySnapshot() {
  return {
    contractVersion: '2026-05-04.adoption-pilot',
    source: 'PublicAdoptionPilotLoopService',
    generatedAt: '2026-05-04T05:52:00.000Z',
    status: 'pilot-ready',
    surface: {
      qaCommand: 'npm run qa:public-adoption-pilot-loop',
    },
  };
}

function integration(id: string, vendor: string) {
  return {
    id,
    vendor,
    modes: ['fixture', 'credential'],
    fixtureAvailable: true,
    trustPlaneControls: ['approval', 'policy', 'audit'],
    partnerStatus: 'compatible',
    formalPartnerRegistered: false,
  };
}

function matrix(id: string) {
  return {
    id,
    modes: ['fixture', 'credential'],
    fixtureAvailable: true,
    capabilities: ['readiness', 'preview', 'safe-degradation'],
  };
}

function metadata() {
  return {
    integrationShowcase: {
      stage: '58',
      surface: 'integration-showcase',
      generatedAt: '2026-05-04T05:52:00.000Z',
      status: 'ready',
      routes: ['/integrations', '/docs#integration-showcase'],
      integrations: [
        integration('slack', 'Slack'),
        integration('github', 'GitHub'),
        integration('vercel', 'Vercel'),
        integration('figma', 'Figma'),
      ],
      matrix: [matrix('slack'), matrix('github'), matrix('vercel'), matrix('figma')],
      partnerPolicy: {
        registryRequiredForFormalClaim: true,
        allowedClaims: ['fixture compatible', 'credential-ready adapter', 'Trust Plane visible'],
        prohibitedClaims: ['registered partner', 'official certification', 'automatic external mutation'],
        auditArtifacts: ['integration-smoke.json', 'capability-matrix.json', 'partner-surface.json'],
      },
      artifacts: {
        smokePath: '.qa/integration-showcase/integration-smoke.json',
        matrixPath: '.qa/integration-showcase/capability-matrix.json',
        partnerSurfacePath: '.qa/integration-showcase/partner-surface.json',
      },
      checks: [
        { id: 'integration-showcase:smoke-artifact', status: 'pass' },
        { id: 'integration-showcase:matrix-artifact', status: 'pass' },
        { id: 'integration-showcase:partner-artifact', status: 'pass' },
      ],
      nextRecommendedGate: { stage: '59', title: 'Release Train', reason: 'release readiness' },
    },
  };
}

describe('ZavorthControl Integration Showcase Partner Surface Integration Showcase', () => {
  it('projects integrationShowcasePartnerSurface metadata into the zavorthControl view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T05:52:00.000Z'),
      idFactory: createIdFactory(),
      publicAdoptionPilotLoop: { buildSnapshot: () => pilotReadySnapshot() } as any,
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-integration-showcase',
      text: 'abrir integration showcase',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: metadata(),
    });

    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: { status: 'ready' },
      wsStatus: 'connected',
      agentRun: { id: run.id, status: 'completed', metadata: run.metadata },
      integrationShowcasePartnerSurface: run.metadata.integrationShowcasePartnerSurface as any,
    });

    expect(viewModel.integrationShowcasePartnerSurface).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.integration-showcase',
      status: 'showcase-ready',
      showcase: expect.objectContaining({
        vendorCount: 4,
        fixtureReadyCount: 4,
      }),
      readiness: expect.objectContaining({
        publicAdoptionPilotLoopReady: true,
        canPublishShowcasePreview: true,
        canClaimFormalPartner: false,
      }),
      policy: expect.objectContaining({
        noFormalPartnerClaimWithoutRegistry: true,
        noCredentialRequiredForFixture: true,
        noNetworkRequiredForFixture: true,
      }),
    }));
    expect(viewModel.integrationShowcasePartnerSurface?.gates.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with Integration Showcase into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T05:52:00.000Z'),
      idFactory: createIdFactory(),
      publicAdoptionPilotLoop: { buildSnapshot: () => pilotReadySnapshot() },
      executor: () => ({ status: 'completed', summary: 'ok com integration showcase', replyText: 'ok' }),
    } as any);

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-integration-showcase-live',
      text: 'abrir integration showcase',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: metadata(),
    });

    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.integrationShowcasePartnerSurface).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.integration-showcase',
      status: 'showcase-ready',
      partnerSurface: expect.objectContaining({
        unsafeFormalClaims: [],
        canClaimFormalPartner: false,
      }),
      policy: expect.objectContaining({
        noFormalPartnerClaimWithoutRegistry: true,
        noExternalMutation: true,
        partnerSurfaceAuditable: true,
      }),
    }));
    expect(projection.integrationShowcasePartnerSurface?.gates.length).toBeGreaterThan(0);
  });
});
