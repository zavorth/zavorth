import {
  AgentRunService,
  INTEGRATION_SHOWCASE_PARTNER_SURFACE_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-integration-showcase-${++index}`;
}

function pilotReadySnapshot() {
  return {
    contractVersion: '2026-05-04.wave-51',
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

function integrationShowcase() {
  return {
    phase: '58',
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
    nextRecommendedPhase: { phase: '59', title: 'Release Train', reason: 'release readiness' },
  };
}

describe('AgentRunService Integration Showcase Partner Surface Wave 52', () => {
  it('publishes run.metadata.integrationShowcasePartnerSurface after publicAdoptionPilotLoop', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T05:52:00.000Z'),
      idFactory: createIdFactory(),
      publicAdoptionPilotLoop: { buildSnapshot: () => pilotReadySnapshot() } as any,
      executor: () => ({
        status: 'completed' as const,
        summary: 'Integration showcase pronto.',
        replyText: 'ok',
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-integration-showcase',
      text: 'go integration showcase',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        integrationShowcase: integrationShowcase(),
      },
    });

    const snapshot = result.run.metadata.integrationShowcasePartnerSurface as any;
    expect(result.run.metadata.publicAdoptionPilotLoop).toBeTruthy();
    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: INTEGRATION_SHOWCASE_PARTNER_SURFACE_CONTRACT_VERSION,
      source: 'IntegrationShowcasePartnerSurfaceService',
      status: 'showcase-ready',
      readiness: expect.objectContaining({
        publicAdoptionPilotLoopReady: true,
        integrationShowcaseLinked: true,
        fixtureModesReady: true,
        capabilityMatrixReady: true,
        partnerSurfacePolicyReady: true,
        artifactsReady: true,
        canPublishShowcasePreview: true,
      }),
      policy: expect.objectContaining({
        noFormalPartnerClaimWithoutRegistry: true,
        noCredentialRequiredForFixture: true,
        noNetworkRequiredForFixture: true,
        noExternalMutation: true,
        partnerSurfaceAuditable: true,
      }),
    }));
    expect(snapshot.partnerSurface.canClaimFormalPartner).toBe(false);
  });
});
