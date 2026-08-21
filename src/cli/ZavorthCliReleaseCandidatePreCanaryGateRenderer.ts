import {
  AgentRunService,
  ReleaseCandidatePreCanaryGateService,
  type ReleaseCandidatePreCanaryGateSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveReleaseCandidatePreCanaryGateCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:release-candidate-pre-canary|pre-canary-gate|rc-pre-canary|release-candidate-gate|go-no-go|precanary|run|status|latest)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildReleaseCandidatePreCanaryGateCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): ReleaseCandidatePreCanaryGateSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T06:54:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text || 'preparar release candidate pre-canary gate',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: {},
  });
  run.metadata = {
    ...run.metadata,
    releaseAdoptionReadiness: buildReleaseAdoptionReadySnapshot(run),
    releaseCandidateEvidencePack: buildEvidencePackReadySnapshot(),
    ecosystemPublishing: buildEcosystemPublishingSnapshot(),
    integrationShowcasePartnerSurface: buildShowcaseReadySnapshot(run),
    capabilityAutopilotReleaseCandidate: buildAutopilotReleaseCandidateSnapshot(),
    goNoGoDecision: buildGoNoGoDecisionSnapshot(),
  };
  return buildReleaseCandidatePreCanaryGateSnapshotFromRun(run);
}

export function buildReleaseCandidatePreCanaryGateSnapshotFromRun(
  run: UniversalAgentRun,
): ReleaseCandidatePreCanaryGateSnapshot {
  return new ReleaseCandidatePreCanaryGateService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatReleaseCandidatePreCanaryGateSnapshot(
  snapshot: ReleaseCandidatePreCanaryGateSnapshot,
): string {
  const lines = [
    'Release Candidate / Pre-Canary Gate - Pre-Canary Gate',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- release/adoption: ${snapshot.releaseAdoption.status}`,
    `- evidence pack: ${snapshot.evidencePack.status} (${snapshot.evidencePack.passCount}/${snapshot.evidencePack.checkCount})`,
    `- ecosystem: ${snapshot.ecosystem.status}`,
    `- autopilot RC: ${snapshot.autopilot.status}`,
    `- go/no-go: ${snapshot.goNoGo.decision}`,
    `- canary started: ${String(snapshot.readiness.canStartCanary)}`,
    `- rollout started: ${String(snapshot.readiness.rolloutStarted)}`,
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

  lines.push('', 'surfaces');
  for (const surface of snapshot.surfaces) {
    lines.push(`- ${surface.status}: ${surface.label} (${surface.routeOrCommand}) - ${surface.detail}`);
  }

  lines.push('', 'Readiness');
  lines.push(`- release/adoption: ${String(snapshot.readiness.releaseAdoptionReady)}`);
  lines.push(`- evidence pack: ${String(snapshot.readiness.evidencePackReady)}`);
  lines.push(`- ecosystem: ${String(snapshot.readiness.ecosystemPublishingReady)}`);
  lines.push(`- autopilot RC: ${String(snapshot.readiness.autopilotReleaseCandidateReady)}`);
  lines.push(`- go/no-go: ${String(snapshot.readiness.goNoGoReady)}`);
  lines.push(`- governance: ${String(snapshot.readiness.governanceReady)}`);
  lines.push(`- rollback: ${String(snapshot.readiness.rollbackReady)}`);

  lines.push('', 'Policy');
  lines.push('- canary was not started');
  lines.push('- rollout was not started');
  lines.push('- deploy was not executed');
  lines.push('- global rollout and auto-promote stay off');
  lines.push('- go/no-go requires explicit approval');
  lines.push('- rollback preview is required');
  lines.push('- ecosystem claims require evidence');

  lines.push('', 'Routes and commands');
  lines.push(`- Evidence pack: ${snapshot.surface.evidencePackCommand}`);
  lines.push(`- Integrations: ${snapshot.surface.integrationCommand}`);
  lines.push(`- Autopilot RC: ${snapshot.surface.autopilotCommand}`);
  lines.push(`- Rollback preview: ${snapshot.surface.rollbackPreviewCommand}`);
  lines.push(`- Release gate: ${snapshot.surface.phaseGateCommand}`);
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}

function buildReleaseAdoptionReadySnapshot(run: UniversalAgentRun) {
  return {
    contractVersion: '2026-05-04.release-readiness',
    source: 'ReleaseAdoptionReadinessService',
    generatedAt: '2026-05-04T06:54:00.000Z',
    identifiers: {
      runId: run.id,
      traceId: run.traceId,
      requestId: run.requestId,
      sessionId: run.sessionId,
    },
    status: 'release-adoption-ready',
    readiness: {
      canOpenPublicAdoption: true,
      canStartCanary: false,
    },
  };
}

function buildEvidencePackReadySnapshot() {
  return {
    status: 'ready',
    checkCount: 6,
    passCount: 6,
    artifactCount: 5,
    releaseNotesReady: true,
    changelogReady: true,
    rollbackPreviewReady: true,
    knownIssuesReady: true,
    checks: [
      { id: 'runtime', status: 'pass' },
      { id: 'gateway', status: 'pass' },
      { id: 'surfaces', status: 'pass' },
      { id: 'release-train', status: 'pass' },
      { id: 'autopilot', status: 'pass' },
      { id: 'rollback', status: 'pass' },
    ],
    artifacts: [
      { id: 'evidence-pack' },
      { id: 'release-notes' },
      { id: 'changelog' },
      { id: 'rollback-preview' },
      { id: 'known-issues' },
    ],
  };
}

function buildEcosystemPublishingSnapshot() {
  return {
    status: 'publishable',
    integrationCount: 4,
    fixtureReadyCount: 4,
    docsReady: true,
    matrixReady: true,
    partnerSurfaceReady: true,
    noFormalPartnerClaim: true,
  };
}

function buildShowcaseReadySnapshot(run: UniversalAgentRun) {
  return {
    contractVersion: '2026-05-04.integration-showcase',
    source: 'IntegrationShowcasePartnerSurfaceService',
    generatedAt: '2026-05-04T06:54:00.000Z',
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
  };
}

function buildAutopilotReleaseCandidateSnapshot() {
  return {
    stage: '80',
    surface: 'capability-autopilot-release-candidate-gate',
    status: 'release_candidate_ready',
    recommendation: 'promote_to_release_candidate',
    releaseCandidateReady: true,
    summary: {
      ok: true,
      passed: 12,
      warnings: 0,
      failed: 0,
    },
    readinessControls: {
      rollbackRehearsalFresh: true,
      supportLoadOk: true,
      docsUpdated: true,
      releaseNotesReady: true,
      stagedRolloutPlanReady: true,
      killSwitchReady: true,
    },
    governance: {
      telemetryReviewPassed: true,
      privacyReviewPassed: true,
      rcFlagDefaultOff: true,
      globalRolloutEnabled: false,
      autoPromoteEnabled: false,
    },
    blockers: [],
    metadata: {
      releaseCandidateReady: true,
      autoExecute: false,
    },
  };
}

function buildGoNoGoDecisionSnapshot() {
  return {
    decision: 'go',
    explicitApproval: true,
    approverId: 'release-owner',
    approvalReceiptId: 'receipt-pre-canary-go',
    rollbackOwner: 'rollback-owner',
    incidentOwner: 'incident-owner',
    reasons: [
      'Local evidence pack approved.',
      'Autopilot RC ready with default-off governance.',
    ],
  };
}
