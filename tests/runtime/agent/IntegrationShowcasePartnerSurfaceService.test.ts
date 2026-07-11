import {
  AgentRunService,
  INTEGRATION_SHOWCASE_PARTNER_SURFACE_CONTRACT_VERSION,
  IntegrationShowcasePartnerSurfaceService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-integration-showcase-${++index}`;
}

function createRun(metadata: Record<string, unknown> = {}) {
  return new AgentRunService({
    now: () => new Date('2026-05-04T05:52:00.000Z'),
    idFactory: createIdFactory(),
  }).createRun({
    userId: 'grey',
    channel: 'cli',
    sessionId: 'session-integration-showcase',
    text: 'prepare integration showcase',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata,
  });
}

function pilotReady() {
  return {
    contractVersion: '2026-05-04.adoption-pilot',
    source: 'PublicAdoptionPilotLoopService',
    status: 'pilot-ready',
    surface: {
      qaCommand: 'npm run qa:public-adoption-pilot-loop',
    },
  };
}

function integration(id: string, vendor: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    vendor,
    modes: ['fixture', 'credential'],
    fixtureAvailable: true,
    trustPlaneControls: ['approval', 'policy', 'audit'],
    partnerStatus: 'compatible',
    formalPartnerRegistered: false,
    ...overrides,
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

function integrationShowcase(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe('IntegrationShowcasePartnerSurfaceService Integration Showcase', () => {
  it('publishes fixture-first integration showcase without formal partner claims', () => {
    const run = createRun();
    run.metadata.publicAdoptionPilotLoop = pilotReady();
    run.metadata.integrationShowcase = integrationShowcase();

    const snapshot = new IntegrationShowcasePartnerSurfaceService({
      now: () => new Date('2026-05-04T05:52:00.000Z'),
    }).buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: INTEGRATION_SHOWCASE_PARTNER_SURFACE_CONTRACT_VERSION,
      source: 'IntegrationShowcasePartnerSurfaceService',
      status: 'showcase-ready',
      publicAdoptionPilotLoop: expect.objectContaining({
        linked: true,
        pilotReady: true,
      }),
      showcase: expect.objectContaining({
        contractStatus: 'ready',
        vendorCount: 4,
        fixtureReadyCount: 4,
        credentialModeCount: 4,
      }),
      readiness: expect.objectContaining({
        publicAdoptionPilotLoopReady: true,
        integrationShowcaseLinked: true,
        trustPlaneReady: true,
        artifactsReady: true,
        canPublishShowcasePreview: true,
        canClaimFormalPartner: false,
      }),
      policy: expect.objectContaining({
        noFormalPartnerClaimWithoutRegistry: true,
        noCredentialRequiredForFixture: true,
        noNetworkRequiredForFixture: true,
        noExternalMutation: true,
        partnerSurfaceAuditable: true,
      }),
    }));
    expect(snapshot.partnerSurface).toEqual(expect.objectContaining({
      unsafeFormalClaims: [],
      canClaimFormalPartner: false,
    }));
  });

  it('requires the public adoption pilot loop before opening integration showcase', () => {
    const run = createRun();
    run.metadata.integrationShowcase = integrationShowcase();
    delete run.metadata.publicAdoptionPilotLoop;

    const snapshot = new IntegrationShowcasePartnerSurfaceService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('needs-public-adoption-pilot-loop');
    expect(snapshot.readiness.publicAdoptionPilotLoopReady).toBe(false);
    expect(snapshot.nextSafeAction).toContain('Public Adoption Pilot');
  });

  it('blocks unsafe formal partner claims without registry proof', () => {
    const run = createRun();
    run.metadata.publicAdoptionPilotLoop = pilotReady();
    run.metadata.integrationShowcase = integrationShowcase({
      integrations: [
        integration('slack', 'Slack', { partnerStatus: 'registered-partner', formalPartnerRegistered: false }),
        integration('github', 'GitHub'),
        integration('vercel', 'Vercel'),
        integration('figma', 'Figma'),
      ],
    });

    const snapshot = new IntegrationShowcasePartnerSurfaceService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('partner-claim-blocked');
    expect(snapshot.partnerSurface.unsafeFormalClaims).toContain('slack');
    expect(snapshot.readiness.canClaimFormalPartner).toBe(false);
    expect(snapshot.policy.noFormalPartnerClaimWithoutRegistry).toBe(true);
  });
});
