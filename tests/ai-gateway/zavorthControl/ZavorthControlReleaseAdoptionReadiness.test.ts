import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/adapters/zavorthControlZavorthControlAdapter.js';
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-release-adoption-${++index}`;
}

function feedbackReady() {
  return {
    status: 'opt-in-ready',
    policy: { noTelemetryEnabled: true, noFeedbackSent: true, noRawPayloadSerialized: true },
  };
}

function pilotReady() {
  return {
    status: 'pilot-ready',
    pilot: { supportPolicyCount: 3, triageRuleCount: 5, ledgerEntryCount: 3 },
    adoptionLoop: { plannedPilotCount: 3, zavorthControlAggregationOnly: true, noPayloadPolicy: true },
    policy: { noWorkspacePayloadStored: true, zavorthControlAggregatedOnly: true },
  };
}

function showcaseReady() {
  return {
    status: 'showcase-ready',
    showcase: { vendorCount: 4, fixtureReadyCount: 4 },
    surface: { qaCommand: 'npm run qa:integration-showcase' },
  };
}

function releaseTrain() {
  return {
    stage: '59',
    surface: 'release-train',
    status: 'ready',
    summary: { ok: true, passed: 18, warnings: 0, failed: 0 },
    baseline: { version: 'v1.0.0', channel: 'stable', packageVersion: '1.1.0' },
    policies: [{ lane: 'baseline' }, { lane: 'patch' }, { lane: 'minor' }, { lane: 'breaking' }],
    calendar: [{ id: 'rc-window' }, { id: 'patch-hotfix' }, { id: 'minor-planning' }, { id: 'lts-review' }],
    releaseCandidateChecklist: [{ id: 'status' }, { id: 'bundle' }, { id: 'distribution' }, { id: 'integrations' }, { id: 'rollback' }, { id: 'changelog' }],
    hotfixPlaybook: [{ id: 'classify' }, { id: 'branch' }, { id: 'validate' }, { id: 'publish' }],
    artifacts: {},
    checks: [],
  };
}

function publicAdoption() {
  return {
    stage: '53',
    surface: 'public-adoption-readiness',
    status: 'ready',
    summary: { ok: true, passed: 20, warnings: 0, failed: 0, readinessScore: 95 },
    baseline: { release: 'v1.0.0', packageName: 'zavorth', packageVersion: '1.1.0' },
    requiredScripts: ['public-adoption', 'qa:public-adoption', 'qa:stage:53'],
    launchChecklist: [],
    claims: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }],
    risks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    demoRunbook: [{ route: '/' }, { route: '/demo' }, { route: '/start' }, { route: '/docs' }, { route: '/release' }, { route: '/feedback' }],
    checks: [],
  };
}

function metadata() {
  return {
    releaseTrain: releaseTrain(),
    publicAdoptionReadiness: publicAdoption(),
  };
}

function agentService() {
  return new AgentRunService({
    now: () => new Date('2026-05-04T06:53:00.000Z'),
    idFactory: createIdFactory(),
    feedbackTelemetryProductLoop: { buildSnapshot: () => feedbackReady() } as any,
    publicAdoptionPilotLoop: { buildSnapshot: () => pilotReady() } as any,
    integrationShowcasePartnerSurface: { buildSnapshot: () => showcaseReady() } as any,
  });
}

describe('ZavorthControl Release Adoption Readiness Release Adoption Readiness', () => {
  it('projects releaseAdoptionReadiness metadata into the zavorthControl view model', () => {
    const run = agentService().createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-release-adoption',
      text: 'abrir release adoption readiness',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: metadata(),
    });

    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: { status: 'ready' },
      wsStatus: 'connected',
      agentRun: { id: run.id, status: 'completed', metadata: run.metadata },
      releaseAdoptionReadiness: run.metadata.releaseAdoptionReadiness as any,
    });

    expect(viewModel.releaseAdoptionReadiness).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.release-readiness',
      status: 'release-adoption-ready',
      publicAdoption: expect.objectContaining({
        readinessScore: 95,
      }),
      readiness: expect.objectContaining({
        supportLoopReady: true,
        feedbackMetricsReady: true,
        canOpenPublicAdoption: true,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noDeployExecuted: true,
        noCanaryStarted: true,
        adoptionMetricsAggregatedOnly: true,
      }),
    }));
    expect(viewModel.releaseAdoptionReadiness?.gates.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with Release Adoption into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T06:53:00.000Z'),
      idFactory: createIdFactory(),
      feedbackTelemetryProductLoop: { buildSnapshot: () => feedbackReady() },
      publicAdoptionPilotLoop: { buildSnapshot: () => pilotReady() },
      integrationShowcasePartnerSurface: { buildSnapshot: () => showcaseReady() },
      executor: () => ({ status: 'completed', summary: 'ok com release adoption', replyText: 'ok' }),
    } as any);

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-release-adoption-live',
      text: 'abrir release adoption readiness',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: metadata(),
    });

    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.releaseAdoptionReadiness).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.release-readiness',
      status: 'release-adoption-ready',
      releaseTrain: expect.objectContaining({
        policyCount: 4,
        hotfixStepCount: 4,
      }),
      policy: expect.objectContaining({
        noDeployExecuted: true,
        noTelemetryEnabled: true,
        noCanaryStarted: true,
        releaseRequiresRollbackPreview: true,
      }),
    }));
    expect(projection.releaseAdoptionReadiness?.gates.length).toBeGreaterThan(0);
  });
});
