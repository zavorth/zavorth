import {
  AgentRunService,
  IntegrationShowcasePartnerSurfaceService,
  ProductEntryRuntimeService,
  type IntegrationShowcasePartnerSurfaceSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

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
          summary: ['Primeiro uso configurado para integration showcase.'],
        } as any),
        buildWorkspaceIdentitySnapshot: () => ({
          nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
          configured: true,
          profilePath: 'data/runtime/first-run/profile.json',
          userDisplayName: 'usuario',
          agentDisplayName: 'Zavorth',
          tonePreference: 'equilibrado',
          workspaceRoot: '<workspace>',
          memoryMode: 'local-metadata',
          safetyPosture: 'preview-first',
          providerStatus: 'deferred',
        } as any),
        resolvePaths: () => ({ profilePath: 'data/runtime/first-run/profile.json' } as any),
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
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- sessao: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- pilot loop: ${snapshot.publicAdoptionPilotLoop.status}`,
    `- showcase: ${snapshot.showcase.contractStatus}`,
    `- vendors: ${snapshot.showcase.vendorCount}`,
    `- fixtures prontos: ${snapshot.showcase.fixtureReadyCount}`,
    `- claim formal permitido: ${String(snapshot.partnerSurface.canClaimFormalPartner)}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Gates',
  ];

  for (const gate of snapshot.gates) {
    lines.push(
      `- ${gate.status}: ${gate.label}`,
      `  ${gate.source} - ${gate.command} - ${gate.detail}`,
    );
  }

  lines.push('', 'Superficies');
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
  lines.push(`- preview publicavel: ${String(snapshot.readiness.canPublishShowcasePreview)}`);

  lines.push('', 'Politica');
  lines.push('- fixture nao exige credencial');
  lines.push('- fixture nao chama rede');
  lines.push('- nenhuma mutacao externa foi feita');
  lines.push('- nenhum secret foi serializado');
  lines.push('- compatibilidade tecnica nao vira parceria formal');
  lines.push('- partner surface e auditavel');

  lines.push('', 'Rotas e comandos');
  lines.push(`- Integrations: ${snapshot.surface.integrationsRoute}`);
  lines.push(`- Docs: ${snapshot.surface.docsAnchor}`);
  lines.push(`- Showcase: ${snapshot.surface.integrationShowcaseCommand}`);
  lines.push(`- QA: ${snapshot.surface.qaCommand}`);
  lines.push(`- Phase gate: ${snapshot.surface.phaseGateCommand}`);
  lines.push(`- Smoke: ${snapshot.surface.smokeArtifact}`);
  lines.push(`- Matrix: ${snapshot.surface.matrixArtifact}`);
  lines.push(`- Partner surface: ${snapshot.surface.partnerSurfaceArtifact}`);
  lines.push(`- Dashboard: ${snapshot.surface.dashboardPath}`);
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
      dashboardReady: true,
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
    nextRecommendedStage: {
      stage: '59',
      title: 'v1.x Release Train And LTS Policy',
      reason: 'showcase auditavel antes de claims publicos fortes',
    },
  };
}
