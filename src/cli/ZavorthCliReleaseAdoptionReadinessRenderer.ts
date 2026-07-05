import {
  AgentRunService,
  ReleaseAdoptionReadinessService,
  type ReleaseAdoptionReadinessSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveReleaseAdoptionReadinessCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:release-adoption-readiness|release-adoption|adoption-readiness|release-readiness|public-adoption-readiness|release-lts|support-readiness|run|status|latest)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildReleaseAdoptionReadinessCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): ReleaseAdoptionReadinessSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T06:53:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text || 'preparar release adoption readiness',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: {},
  });
  run.metadata = {
    ...run.metadata,
    feedbackTelemetryProductLoop: buildFeedbackReadySnapshot(),
    publicAdoptionPilotLoop: buildPilotReadySnapshot(run),
    integrationShowcasePartnerSurface: buildShowcaseReadySnapshot(run),
    releaseTrain: buildReleaseTrainSnapshot(),
    publicAdoptionReadiness: buildPublicAdoptionSnapshot(),
  };
  return buildReleaseAdoptionReadinessSnapshotFromRun(run);
}

export function buildReleaseAdoptionReadinessSnapshotFromRun(
  run: UniversalAgentRun,
): ReleaseAdoptionReadinessSnapshot {
  return new ReleaseAdoptionReadinessService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatReleaseAdoptionReadinessSnapshot(
  snapshot: ReleaseAdoptionReadinessSnapshot,
): string {
  const lines = [
    'Release & Adoption Readiness - Release Adoption Readiness',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- showcase: ${snapshot.integrationShowcase.status}`,
    `- release train: ${snapshot.releaseTrain.status}`,
    `- adoption score: ${snapshot.publicAdoption.readinessScore}`,
    `- suporte: ${String(snapshot.readiness.supportLoopReady)}`,
    `- canary iniciado: ${String(snapshot.readiness.canStartCanary)}`,
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

  lines.push('', 'Superficies');
  for (const surface of snapshot.surfaces) {
    lines.push(`- ${surface.status}: ${surface.label} (${surface.routeOrCommand}) - ${surface.detail}`);
  }

  lines.push('', 'Readiness');
  lines.push(`- integration showcase: ${String(snapshot.readiness.integrationShowcaseReady)}`);
  lines.push(`- release train: ${String(snapshot.readiness.releaseTrainReady)}`);
  lines.push(`- public adoption: ${String(snapshot.readiness.publicAdoptionReady)}`);
  lines.push(`- support loop: ${String(snapshot.readiness.supportLoopReady)}`);
  lines.push(`- feedback metrics: ${String(snapshot.readiness.feedbackMetricsReady)}`);
  lines.push(`- LTS/hotfix: ${String(snapshot.readiness.ltsHotfixPolicyReady)}`);

  lines.push('', 'Politica');
  lines.push('- deploy was not executed');
  lines.push('- canary was not started');
  lines.push('- telemetry implicita continua desligada');
  lines.push('- external feedback was not sent');
  lines.push('- metricas sao agregadas');
  lines.push('- stable claim exige evidencia');
  lines.push('- rollback preview is required');

  lines.push('', 'Rotas e comandos');
  lines.push(`- Release: ${snapshot.surface.releaseRoute}`);
  lines.push(`- Feedback: ${snapshot.surface.feedbackRoute}`);
  lines.push(`- Docs: ${snapshot.surface.docsRoute}`);
  lines.push(`- Release train: ${snapshot.surface.releaseTrainCommand}`);
  lines.push(`- Public adoption: ${snapshot.surface.publicAdoptionCommand}`);
  lines.push(`- Pilot loop: ${snapshot.surface.pilotLoopCommand}`);
  lines.push(`- Feedback preview: ${snapshot.surface.feedbackPreviewCommand}`);
  lines.push(`- Phase gate: ${snapshot.surface.phaseGateCommand}`);
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}

function buildFeedbackReadySnapshot() {
  return {
    contractVersion: '2026-05-04.feedback-telemetry',
    source: 'FeedbackTelemetryProductLoopService',
    status: 'opt-in-ready',
    policy: {
      noTelemetryEnabled: true,
      noFeedbackSent: true,
      noRawPayloadSerialized: true,
      revokeDeleteAvailable: true,
    },
  };
}

function buildPilotReadySnapshot(run: UniversalAgentRun) {
  return {
    contractVersion: '2026-05-04.adoption-pilot',
    source: 'PublicAdoptionPilotLoopService',
    generatedAt: '2026-05-04T06:53:00.000Z',
    identifiers: {
      runId: run.id,
      traceId: run.traceId,
      requestId: run.requestId,
      sessionId: run.sessionId,
    },
    status: 'pilot-ready',
    pilot: {
      supportPolicyCount: 3,
      triageRuleCount: 5,
      ledgerEntryCount: 3,
    },
    adoptionLoop: {
      plannedPilotCount: 3,
      zavorthControlAggregationOnly: true,
      noPayloadPolicy: true,
    },
    policy: {
      noWorkspacePayloadStored: true,
      zavorthControlAggregatedOnly: true,
    },
    surface: {
      qaCommand: 'npm run qa:public-adoption-pilot-loop',
    },
  };
}

function buildShowcaseReadySnapshot(run: UniversalAgentRun) {
  return {
    contractVersion: '2026-05-04.integration-showcase',
    source: 'IntegrationShowcasePartnerSurfaceService',
    generatedAt: '2026-05-04T06:53:00.000Z',
    identifiers: {
      runId: run.id,
      traceId: run.traceId,
      requestId: run.requestId,
      sessionId: run.sessionId,
    },
    status: 'showcase-ready',
    showcase: {
      vendorCount: 4,
      fixtureReadyCount: 4,
    },
    surface: {
      qaCommand: 'npm run qa:integration-showcase',
    },
  };
}

function buildReleaseTrainSnapshot() {
  return {
    stage: '59',
    surface: 'release-train',
    generatedAt: '2026-05-04T06:53:00.000Z',
    status: 'ready',
    projectRoot: '<core>',
    websiteRoot: '<website>',
    artifactDir: '.qa/release-train',
    summary: { ok: true, passed: 18, warnings: 0, failed: 0 },
    baseline: {
      version: 'v1.0.0',
      channel: 'stable',
      packageVersion: '1.1.0',
    },
    policies: [
      { lane: 'baseline' },
      { lane: 'patch' },
      { lane: 'minor' },
      { lane: 'breaking' },
    ],
    calendar: [
      { id: 'rc-window' },
      { id: 'patch-hotfix' },
      { id: 'minor-planning' },
      { id: 'lts-review' },
    ],
    releaseCandidateChecklist: [
      { id: 'status' },
      { id: 'bundle' },
      { id: 'distribution' },
      { id: 'integrations' },
      { id: 'rollback' },
      { id: 'changelog' },
    ],
    hotfixPlaybook: [
      { id: 'classify' },
      { id: 'branch' },
      { id: 'validate' },
      { id: 'publish' },
    ],
    artifacts: {
      planPath: '.qa/release-train/release-train-plan.json',
      checklistPath: '.qa/release-train/release-candidate-checklist.json',
      hotfixPath: '.qa/release-train/hotfix-playbook.json',
    },
    checks: [],
    nextRecommendedAction: {
      id: 'cycle-closed',
      title: 'Ciclo 53-59 fechado',
      reason: 'operar v1.0.x ou planejar v1.1.0',
    },
  };
}

function buildPublicAdoptionSnapshot() {
  return {
    stage: '53',
    surface: 'public-adoption-readiness',
    generatedAt: '2026-05-04T06:53:00.000Z',
    status: 'ready',
    projectRoot: '<core>',
    websiteRoot: '<website>',
    summary: {
      ok: true,
      passed: 20,
      warnings: 0,
      failed: 0,
      readinessScore: 95,
    },
    baseline: {
      release: 'v1.0.0',
      packageName: 'zavorth',
      packageVersion: '1.1.0',
      roadmapPath: 'docs/product-direction.md',
      planningPath: 'docs/product-direction.md',
    },
    requiredScripts: ['public-adoption', 'qa:public-adoption', 'qa:stage:53'],
    launchChecklist: [],
    claims: [
      { id: 'local-first-governed-runtime' },
      { id: 'preview-approval-evidence' },
      { id: 'fixture-first-demo' },
      { id: 'telemetry-opt-in' },
      { id: 'verifiable-release' },
    ],
    risks: [
      { id: 'website-not-present' },
      { id: 'secrets-missing' },
      { id: 'unsafe-feedback' },
      { id: 'release-drift' },
    ],
    demoRunbook: [
      { minute: '0-1', route: '/' },
      { minute: '1-3', route: '/demo' },
      { minute: '3-5', route: '/start' },
      { minute: '5-7', route: '/docs' },
      { minute: '7-9', route: '/release' },
      { minute: '9-10', route: '/feedback' },
    ],
    checks: [],
    nextRecommendedStage: {
      stage: '54',
      title: 'Hosted Website And Demo Operations',
      reason: 'preview e deploy governados',
    },
  };
}
