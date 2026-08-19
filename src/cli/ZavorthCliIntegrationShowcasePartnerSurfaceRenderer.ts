import {
  AgentRunService,
  IntegrationShowcasePartnerSurfaceService,
  ProductEntryRuntimeService,
  type IntegrationShowcasePartnerSurfaceSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';
import type {
  ZavorthFirstRunBootstrapPlan,
  ZavorthWorkspaceIdentityProfileSnapshot,
  ZavorthFirstRunBootstrapPaths,
} from '../contracts/FirstRunWorkspaceBootstrapContract.js';

export function resolveIntegrationShowcasePartnerSurfaceCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:integration-showcase-partner-surface|integration-showcase-runtime|partner-surface|integration-partner-surface|showcase-partners|integration-runtime|run|status|latest)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildIntegrationShowcasePartnerSurfaceCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): IntegrationShowcasePartnerSurfaceSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T05:52:00.000Z'),
    productEntryRuntime: new ProductEntryRuntimeService({
      now: () => new Date('2026-05-04T05:52:00.000Z'),
      firstRunProfileService: {
        buildPlan: () => ({
          nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
          generatedAt: '2026-05-04T05:52:00.000Z',
          mode: 'dry-run',
          status: 'ready',
          dryRun: true,
          nonInteractiveSafe: true,
          paths: {
            storageRoot: '<workspace>',
            runtimeDir: 'data/runtime/first-run',
            profilePath: 'data/runtime/first-run/profile.json',
            workspacePath: 'data/runtime/first-run/workspace.json',
            identityPath: 'data/runtime/first-run/identity.json',
            policyPath: 'data/runtime/first-run/policy.json',
          },
          questions: [],
          writes: [],
          summary: ['First use configured for integration showcase.'],
        } as unknown as ZavorthFirstRunBootstrapPlan),
        buildWorkspaceIdentitySnapshot: () => ({
          nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
          configured: true,
          profilePath: 'data/runtime/first-run/profile.json',
          userDisplayName: 'user',
          agentDisplayName: 'Zavorth',
          tonePreference: 'balanced',
          workspaceRoot: '<workspace>',
          memoryMode: 'local-metadata',
          safetyPosture: 'preview-first',
          providerStatus: 'deferred',
        } as unknown as ZavorthWorkspaceIdentityProfileSnapshot),
        resolvePaths: () => ({ profilePath: 'data/runtime/first-run/profile.json' } as unknown as ZavorthFirstRunBootstrapPaths),
      },
      personalizationService: {
        getStatus: () => ({
          pending: false,
          reasons: [],
          files: {
            identity: 'IDENTITY.md',
            soul: 'SOUL.md',
            user: 'USER.md',
            bootstrap: 'BOOTSTRAP.md',
            domain: 'DOMAIN.md',
            learningStyle: 'LEARNING-STYLE.md',
            errorHandling: 'ERROR-HANDLING.md',
            outputFormat: 'OUTPUT-FORMAT.md',
            timeAutomation: 'TIME-AUTOMATION.md',
          },
          bootstrapExists: false,
          missingUserFields: [],
          identityName: 'Zavorth',
        }),
      },
    }),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text || 'preparar integration showcase partner surface',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: {},
  });
  run.metadata = {
    ...run.metadata,
    publicAdoptionPilotLoop: buildPilotReadySnapshot(run),
    integrationShowcase: buildIntegrationShowcaseFixture(),
  };
  return buildIntegrationShowcasePartnerSurfaceSnapshotFromRun(run);
}

export function buildIntegrationShowcasePartnerSurfaceSnapshotFromRun(
  run: UniversalAgentRun,
): IntegrationShowcasePartnerSurfaceSnapshot {
  return new IntegrationShowcasePartnerSurfaceService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatIntegrationShowcasePartnerSurfaceSnapshot(
  snapshot: IntegrationShowcasePartnerSurfaceSnapshot,
): string {
  const lines = [
    'Integration Showcase / Partner Surface - Integration Showcase',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- pilot loop: ${snapshot.publicAdoptionPilotLoop.status}`,
    `- showcase: ${snapshot.showcase.contractStatus}`,
    `- vendors: ${snapshot.showcase.vendorCount}`,
    `- fixtures ready: ${snapshot.showcase.fixtureReadyCount}`,
    `- formal claim allowed: ${String(snapshot.partnerSurface.canClaimFormalPartner)}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Gates',
  ];

  for (const gate of snapshot.gates) {
    lines.push(
      `- ${gate.status}: ${gate.label}`,
      `  ${gate.source} - ${gate.command} - ${gate.detail}`,
    );
  }

  lines.push('', 'Surfaces');
  for (const surface of snapshot.surfaces) {
    lines.push(`- ${surface.status}: ${surface.label} (${surface.routeOrCommand}) - ${surface.detail}`);
  }

  lines.push('', 'Readiness');
  lines.push(`- pilot ready: ${String(snapshot.readiness.publicAdoptionPilotLoopReady)}`);
  lines.push(`- showcase linked: ${String(snapshot.readiness.integrationShowcaseLinked)}`);
  lines.push(`- routes ready: ${String(snapshot.readiness.routesReady)}`);
  lines.push(`- fixture modes ready: ${String(snapshot.readiness.fixtureModesReady)}`);
  lines.push(`- trust plane ready: ${String(snapshot.readiness.trustPlaneReady)}`);
  lines.push(`- artifacts ready: ${String(snapshot.readiness.artifactsReady)}`);
  lines.push(`- publishable preview: ${String(snapshot.readiness.canPublishShowcasePreview)}`);

  lines.push('', 'Policy');
  lines.push('- fixture does not require credentials');
  lines.push('- fixture does not call the network');
  lines.push('- no external mutation was made');
  lines.push('- no secret was serialized');
  lines.push('- technical compatibility does not become a formal partnership');
  lines.push('- partner surface is auditable');

  lines.push('', 'Routes and Commands');
  lines.push(`- Integrations: ${snapshot.surface.integrationsRoute}`);
  lines.push(`- Docs: ${snapshot.surface.docsAnchor}`);
  lines.push(`- Showcase: ${snapshot.surface.integrationShowcaseCommand}`);
  lines.push(`- QA: ${snapshot.surface.qaCommand}`);
  lines.push(`- Release gate: ${snapshot.surface.gateCommand}`);
  lines.push(`- Smoke: ${snapshot.surface.smokeArtifact}`);
  lines.push(`- Matrix: ${snapshot.surface.matrixArtifact}`);
  lines.push(`- Partner surface: ${snapshot.surface.partnerSurfaceArtifact}`);
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}

function buildPilotReadySnapshot(run: UniversalAgentRun) {
  return {
    contractVersion: '2026-05-04.adoption-pilot',
    source: 'PublicAdoptionPilotLoopService',
    generatedAt: '2026-05-04T05:52:00.000Z',
    identifiers: {
      runId: run.id,
      traceId: run.traceId,
      requestId: run.requestId,
      sessionId: run.sessionId,
    },
    status: 'pilot-ready',
    readiness: {
      feedbackProductLoopReady: true,
      pilotLoopContractLinked: true,
      templatesReady: true,
      triageReady: true,
      ledgerReady: true,
      supportReady: true,
      zavorthControlReady: true,
      canStartControlledPilot: true,
      canCollectPublicFeedback: true,
      canPublishPilotMetrics: true,
    },
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

function buildIntegrationShowcaseFixture() {
  return {
    stage: '58',
    surface: 'integration-showcase',
    generatedAt: '2026-05-04T05:52:00.000Z',
    status: 'ready',
    projectRoot: '<core>',
    websiteRoot: '<website>',
    artifactDir: '.qa/integration-showcase',
    summary: { ok: true, passed: 16, warnings: 0, failed: 0 },
    routes: ['/integrations', '/docs#integration-showcase'],
    integrations: [
      integration('slack', 'Slack'),
      integration('github', 'GitHub'),
      integration('vercel', 'Vercel'),
      integration('figma', 'Figma'),
    ],
    matrix: [
      matrix('slack'),
      matrix('github'),
      matrix('vercel'),
      matrix('figma'),
    ],
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
      { id: 'integration-showcase:smoke-artifact', title: 'smoke fixture', status: 'pass' },
      { id: 'integration-showcase:matrix-artifact', title: 'capability matrix', status: 'pass' },
      { id: 'integration-showcase:partner-artifact', title: 'partner surface', status: 'pass' },
    ],
    nextRecommendedGate: {
      stage: '59',
      title: 'v1.x Release Train And LTS Policy',
      reason: 'auditable showcase before strong public claims',
    },
  };
}
