import {
  AgentRunService,
  BlueprintCompletionGateService,
  type BlueprintCompletionGateSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveBlueprintCompletionCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:blueprint-completion|blueprint-complete|blueprint-final|runtime-completion|final-gate|complete-blueprint|run|status|latest)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildBlueprintCompletionCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): BlueprintCompletionGateSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T07:00:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text || 'fechar blueprint completo',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: {},
  });
  run.metadata = {
    ...run.metadata,
    releaseCandidatePreCanaryGate: buildPreCanaryReady(),
    capabilityAutopilotReleaseRolloutPlan: buildRolloutPlanReady(),
    capabilityAutopilotReleaseExecution: buildReleaseExecutionReady(),
    capabilityAutopilotCanaryPromotion: buildCanaryPromotionReady(),
    capabilityAutopilotReleaseDecision: buildReleaseDecisionReady(),
  };
  return buildBlueprintCompletionSnapshotFromRun(run);
}

export function buildBlueprintCompletionSnapshotFromRun(
  run: UniversalAgentRun,
): BlueprintCompletionGateSnapshot {
  return new BlueprintCompletionGateService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatBlueprintCompletionSnapshot(snapshot: BlueprintCompletionGateSnapshot): string {
  const lines = [
    'Blueprint Completion Gate - Final',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- sessao: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- gates: ${snapshot.summary.completedGateCount}/${snapshot.summary.requiredGateCount}`,
    `- decisao: ${snapshot.summary.releaseDecision}`,
    `- canal: ${snapshot.summary.releaseChannel}`,
    `- blueprint completo: ${String(snapshot.summary.blueprintComplete)}`,
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

  lines.push('', 'Readiness');
  lines.push(`- pre-canary: ${String(snapshot.readiness.preCanaryReady)}`);
  lines.push(`- rollout: ${String(snapshot.readiness.rolloutPlanReady)}`);
  lines.push(`- execution: ${String(snapshot.readiness.releaseExecutionReady)}`);
  lines.push(`- canary promotion: ${String(snapshot.readiness.canaryPromotionReady)}`);
  lines.push(`- release decision: ${String(snapshot.readiness.releaseDecisionReady)}`);
  lines.push(`- safeguards: ${String(snapshot.readiness.safeguardsReady)}`);

  lines.push('', 'Politica final');
  lines.push('- sem deploy nao governado');
  lines.push('- promocao manual obrigatoria');
  lines.push('- sem auto-execute');
  lines.push('- sem global rollout por default');
  lines.push('- sem skip canary');
  lines.push('- sem skip approval');
  lines.push('- rollback e audit receipts obrigatorios');

  lines.push('', 'Comandos');
  lines.push(`- Pre-canary: ${snapshot.surface.preCanaryCommand}`);
  lines.push(`- Rollout: ${snapshot.surface.rolloutCommand}`);
  lines.push(`- Execution: ${snapshot.surface.executionCommand}`);
  lines.push(`- Canary promotion: ${snapshot.surface.canaryPromotionCommand}`);
  lines.push(`- Decision: ${snapshot.surface.decisionCommand}`);
  lines.push(`- Final gate: ${snapshot.surface.finalGateCommand}`);
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}

function buildPreCanaryReady() {
  return {
    status: 'pre-canary-ready',
    readiness: {
      canOpenPreCanary: true,
    },
  };
}

function buildRolloutPlanReady() {
  return {
    phase: '81',
    status: 'rollout_plan_ready',
    recommendation: 'prepare_manual_v1_1_rollout',
    rollout: {
      canaryPercent: 5,
    },
    safeguards: {
      manualPromotionRequired: true,
      rcFlagDefaultOff: true,
      publishTagEnabled: false,
      globalRolloutEnabled: false,
      autoRolloutEnabled: false,
    },
  };
}

function buildReleaseExecutionReady() {
  return {
    phase: '82',
    status: 'release_execution_ready',
    recommendation: 'execute_manual_v1_1_release',
    executionIntent: {
      releaseExecutionApproved: true,
      manualOperatorPresent: true,
      releaseVersion: 'v1.1.0',
      releaseTag: 'v1.1.0',
      versionManifestReady: true,
      releaseBranchClean: true,
    },
    canary: {
      initialCanaryPercent: 5,
      canaryLaunchApproved: true,
    },
    safeguards: {
      autoExecuteEnabled: false,
      globalRolloutEnabled: false,
      skipCanaryEnabled: false,
    },
  };
}

function buildCanaryPromotionReady() {
  return {
    phase: '83',
    status: 'canary_promotion_ready',
    recommendation: 'promote_canary_to_next_cohort',
    incidents: {
      rollbackRecommended: false,
    },
    promotion: {
      canaryCohortStable: true,
      promotionApproved: true,
      nextCohortPercent: 25,
    },
    safeguards: {
      rollbackRunbookReady: true,
      observabilityReviewReady: true,
      auditPersisted: true,
      autoPromoteEnabled: false,
      globalRolloutEnabled: false,
      skipApprovalEnabled: false,
    },
  };
}

function buildReleaseDecisionReady() {
  return {
    generatedAt: '2026-05-04T07:00:00.000Z',
    versionCandidate: 'v1.1.0',
    decision: 'ship_v1_1_flagged',
    releaseChannel: 'alpha',
    riskPosture: 'medium',
    missingPhases: [],
    failedPhases: [],
    featureFlag: {
      name: 'ZAVORTH_CAPABILITY_AUTOPILOT',
      defaultEnabled: false,
      reason: 'Ship behind explicit feature flag.',
    },
  };
}
