import type { CapabilityAutopilotCanaryPromotionSnapshot } from '../../services/CapabilityAutopilotCanaryMonitoringPromotionGateService.js';
import type { CapabilityAutopilotReleaseDecisionSnapshot } from '../../services/CapabilityAutopilotReleaseDecisionService.js';
import type { CapabilityAutopilotReleaseExecutionSnapshot } from '../../services/CapabilityAutopilotReleaseExecutionGateService.js';
import type { CapabilityAutopilotReleaseRolloutPlanSnapshot } from '../../services/CapabilityAutopilotReleaseRolloutPlanService.js';
import type { ReleaseCandidatePreCanaryGateSnapshot } from './ReleaseCandidatePreCanaryGateService.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const BLUEPRINT_COMPLETION_GATE_CONTRACT_VERSION = '2026-05-04.blueprint-complete' as const;
export const BLUEPRINT_COMPLETION_GATE_METADATA_KEY = 'blueprintCompletionGate' as const;

export type BlueprintCompletionGateStatus =
  | 'blueprint-complete'
  | 'needs-pre-canary'
  | 'needs-rollout-plan'
  | 'needs-release-execution'
  | 'needs-canary-promotion'
  | 'needs-release-decision'
  | 'blocked';

export type BlueprintCompletionGateLevel = 'ready' | 'needs-action' | 'blocked' | 'unknown';

export type BlueprintCompletionGate = {
  id: string;
  label: string;
  status: BlueprintCompletionGateLevel;
  source:
    | 'ReleaseCandidatePreCanaryGateService'
    | 'CapabilityAutopilotReleaseRolloutPlanService'
    | 'CapabilityAutopilotReleaseExecutionGateService'
    | 'CapabilityAutopilotCanaryMonitoringPromotionGateService'
    | 'CapabilityAutopilotReleaseDecisionService'
    | 'BlueprintCompletionGateService';
  command: string;
  detail: string;
  critical: boolean;
};

export type BlueprintCompletionGateSnapshot = {
  contractVersion: typeof BLUEPRINT_COMPLETION_GATE_CONTRACT_VERSION;
  source: 'BlueprintCompletionGateService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: BlueprintCompletionGateStatus;
  summary: {
    completedGateCount: number;
    requiredGateCount: 5;
    releaseChannel: string;
    releaseDecision: string;
    blueprintComplete: boolean;
  };
  preCanary: {
    linked: boolean;
    status: ReleaseCandidatePreCanaryGateSnapshot['status'] | 'unknown';
    ready: boolean;
    canOpenPreCanary: boolean;
  };
  rolloutPlan: {
    linked: boolean;
    status: CapabilityAutopilotReleaseRolloutPlanSnapshot['status'] | 'unknown';
    ready: boolean;
    canaryPercent: number;
    manualPromotionRequired: boolean;
    globalRolloutEnabled: boolean;
    autoRolloutEnabled: boolean;
  };
  releaseExecution: {
    linked: boolean;
    status: CapabilityAutopilotReleaseExecutionSnapshot['status'] | 'unknown';
    ready: boolean;
    releaseVersion: string | null;
    releaseTag: string | null;
    initialCanaryPercent: number;
    manualOperatorPresent: boolean;
    autoExecuteEnabled: boolean;
    globalRolloutEnabled: boolean;
    skipCanaryEnabled: boolean;
  };
  canaryPromotion: {
    linked: boolean;
    status: CapabilityAutopilotCanaryPromotionSnapshot['status'] | 'unknown';
    ready: boolean;
    nextCohortPercent: number;
    promotionApproved: boolean;
    rollbackRecommended: boolean;
    autoPromoteEnabled: boolean;
    globalRolloutEnabled: boolean;
    skipApprovalEnabled: boolean;
  };
  releaseDecision: {
    linked: boolean;
    decision: CapabilityAutopilotReleaseDecisionSnapshot['decision'] | 'unknown';
    ready: boolean;
    releaseChannel: CapabilityAutopilotReleaseDecisionSnapshot['releaseChannel'] | 'unknown';
    riskPosture: CapabilityAutopilotReleaseDecisionSnapshot['riskPosture'] | 'unknown';
    missingPhaseCount: number;
    failedPhaseCount: number;
    featureFlagDefaultEnabled: boolean;
  };
  readiness: {
    preCanaryReady: boolean;
    rolloutPlanReady: boolean;
    releaseExecutionReady: boolean;
    canaryPromotionReady: boolean;
    releaseDecisionReady: boolean;
    safeguardsReady: boolean;
    blueprintComplete: boolean;
  };
  gates: BlueprintCompletionGate[];
  receipts: Array<{
    id: string;
    kind: 'pre-canary' | 'rollout' | 'execution' | 'canary' | 'decision' | 'policy';
    source: string;
    detail: string;
    status: BlueprintCompletionGateLevel;
  }>;
  policy: {
    noUngovernedDeploy: true;
    manualPromotionRequired: true;
    noAutoExecute: true;
    noGlobalRolloutByDefault: true;
    noSkipCanary: true;
    noSkipApproval: true;
    rollbackPathRequired: true;
    auditReceiptsRequired: true;
    featureFlagRequired: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    preCanaryCommand: 'npm run qa:release-candidate-pre-canary';
    rolloutCommand: 'npm run qa:capability-autopilot-release-rollout';
    executionCommand: 'npm run qa:capability-autopilot-release-execution';
    canaryPromotionCommand: 'npm run qa:capability-autopilot-canary-promotion';
    decisionCommand: 'npm run qa:capability-autopilot-release-decision';
    finalGateCommand: 'npm run qa:blueprint-completion';
  };
  nextSafeAction: string;
};

export type BlueprintCompletionGateInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type BlueprintCompletionGateRuntime = {
  now?: () => Date;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function arrayOrEmpty<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function gateLevel(ready: boolean, linked = true, blocked = false): BlueprintCompletionGateLevel {
  if (blocked) {
    return 'blocked';
  }
  if (ready) {
    return 'ready';
  }
  return linked ? 'needs-action' : 'unknown';
}

export class BlueprintCompletionGateService {
  private readonly now: () => Date;

  constructor(runtime: BlueprintCompletionGateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: BlueprintCompletionGateInput): BlueprintCompletionGateSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const preCanaryRaw = this.readPreCanary(run);
    const rolloutRaw = this.readRolloutPlan(run);
    const executionRaw = this.readReleaseExecution(run);
    const canaryRaw = this.readCanaryPromotion(run);
    const decisionRaw = this.readReleaseDecision(run);

    const preCanaryReady = preCanaryRaw?.status === 'pre-canary-ready'
      && preCanaryRaw.readiness?.canOpenPreCanary === true;
    const rolloutPlanReady = rolloutRaw?.status === 'rollout_plan_ready'
      && rolloutRaw.safeguards?.manualPromotionRequired === true
      && rolloutRaw.safeguards?.globalRolloutEnabled === false
      && rolloutRaw.safeguards?.autoRolloutEnabled === false;
    const releaseExecutionReady = executionRaw?.status === 'release_execution_ready'
      && executionRaw.executionIntent?.manualOperatorPresent === true
      && executionRaw.safeguards?.autoExecuteEnabled === false
      && executionRaw.safeguards?.globalRolloutEnabled === false
      && executionRaw.safeguards?.skipCanaryEnabled === false;
    const canaryPromotionReady = canaryRaw?.status === 'canary_promotion_ready'
      && canaryRaw.promotion?.promotionApproved === true
      && canaryRaw.incidents?.rollbackRecommended === false
      && canaryRaw.safeguards?.autoPromoteEnabled === false
      && canaryRaw.safeguards?.globalRolloutEnabled === false
      && canaryRaw.safeguards?.skipApprovalEnabled === false;
    const releaseDecisionReady = Boolean(
      decisionRaw
      && (decisionRaw.decision === 'ship_v1_1_flagged' || decisionRaw.decision === 'ship_v1_1_default_on')
      && arrayOrEmpty(decisionRaw.missingGates).length === 0
      && arrayOrEmpty(decisionRaw.failedGates).length === 0,
    );
    const safeguardsReady = Boolean(
      rolloutRaw?.safeguards?.manualPromotionRequired === true
      && rolloutRaw?.safeguards?.globalRolloutEnabled === false
      && rolloutRaw?.safeguards?.autoRolloutEnabled === false
      && executionRaw?.safeguards?.autoExecuteEnabled === false
      && executionRaw?.safeguards?.globalRolloutEnabled === false
      && executionRaw?.safeguards?.skipCanaryEnabled === false
      && canaryRaw?.safeguards?.autoPromoteEnabled === false
      && canaryRaw?.safeguards?.globalRolloutEnabled === false
      && canaryRaw?.safeguards?.skipApprovalEnabled === false,
    );
    const blocked = Boolean(
      preCanaryRaw?.status === 'blocked'
      || rolloutRaw?.status === 'blocked'
      || executionRaw?.status === 'blocked'
      || canaryRaw?.status === 'blocked'
      || decisionRaw?.decision === 'hold_backlog'
      || rolloutRaw?.safeguards?.globalRolloutEnabled === true
      || rolloutRaw?.safeguards?.autoRolloutEnabled === true
      || executionRaw?.safeguards?.autoExecuteEnabled === true
      || executionRaw?.safeguards?.globalRolloutEnabled === true
      || executionRaw?.safeguards?.skipCanaryEnabled === true
      || canaryRaw?.safeguards?.autoPromoteEnabled === true
      || canaryRaw?.safeguards?.globalRolloutEnabled === true
      || canaryRaw?.safeguards?.skipApprovalEnabled === true,
    );
    const completedGateCount = [
      preCanaryReady,
      rolloutPlanReady,
      releaseExecutionReady,
      canaryPromotionReady,
      releaseDecisionReady,
    ].filter(Boolean).length;
    const blueprintComplete = completedGateCount === 5 && safeguardsReady && !blocked;
    const status = this.resolveStatus({
      blocked,
      preCanaryReady,
      rolloutPlanReady,
      releaseExecutionReady,
      canaryPromotionReady,
      releaseDecisionReady,
      blueprintComplete,
    });
    const readiness = {
      preCanaryReady,
      rolloutPlanReady,
      releaseExecutionReady,
      canaryPromotionReady,
      releaseDecisionReady,
      safeguardsReady,
      blueprintComplete,
    };

    return {
      contractVersion: BLUEPRINT_COMPLETION_GATE_CONTRACT_VERSION,
      source: 'BlueprintCompletionGateService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      summary: {
        completedGateCount,
        requiredGateCount: 5,
        releaseChannel: normalizeText(decisionRaw?.releaseChannel, 'unknown'),
        releaseDecision: normalizeText(decisionRaw?.decision, 'unknown'),
        blueprintComplete,
      },
      preCanary: {
        linked: Boolean(preCanaryRaw),
        status: preCanaryRaw?.status || 'unknown',
        ready: preCanaryReady,
        canOpenPreCanary: preCanaryRaw?.readiness?.canOpenPreCanary === true,
      },
      rolloutPlan: {
        linked: Boolean(rolloutRaw),
        status: rolloutRaw?.status || 'unknown',
        ready: rolloutPlanReady,
        canaryPercent: numberOrZero(rolloutRaw?.rollout?.canaryPercent),
        manualPromotionRequired: rolloutRaw?.safeguards?.manualPromotionRequired === true,
        globalRolloutEnabled: rolloutRaw?.safeguards?.globalRolloutEnabled === true,
        autoRolloutEnabled: rolloutRaw?.safeguards?.autoRolloutEnabled === true,
      },
      releaseExecution: {
        linked: Boolean(executionRaw),
        status: executionRaw?.status || 'unknown',
        ready: releaseExecutionReady,
        releaseVersion: normalizeText(executionRaw?.executionIntent?.releaseVersion) || null,
        releaseTag: normalizeText(executionRaw?.executionIntent?.releaseTag) || null,
        initialCanaryPercent: numberOrZero(executionRaw?.canary?.initialCanaryPercent),
        manualOperatorPresent: executionRaw?.executionIntent?.manualOperatorPresent === true,
        autoExecuteEnabled: executionRaw?.safeguards?.autoExecuteEnabled === true,
        globalRolloutEnabled: executionRaw?.safeguards?.globalRolloutEnabled === true,
        skipCanaryEnabled: executionRaw?.safeguards?.skipCanaryEnabled === true,
      },
      canaryPromotion: {
        linked: Boolean(canaryRaw),
        status: canaryRaw?.status || 'unknown',
        ready: canaryPromotionReady,
        nextCohortPercent: numberOrZero(canaryRaw?.promotion?.nextCohortPercent),
        promotionApproved: canaryRaw?.promotion?.promotionApproved === true,
        rollbackRecommended: canaryRaw?.incidents?.rollbackRecommended === true,
        autoPromoteEnabled: canaryRaw?.safeguards?.autoPromoteEnabled === true,
        globalRolloutEnabled: canaryRaw?.safeguards?.globalRolloutEnabled === true,
        skipApprovalEnabled: canaryRaw?.safeguards?.skipApprovalEnabled === true,
      },
      releaseDecision: {
        linked: Boolean(decisionRaw),
        decision: decisionRaw?.decision || 'unknown',
        ready: releaseDecisionReady,
        releaseChannel: decisionRaw?.releaseChannel || 'unknown',
        riskPosture: decisionRaw?.riskPosture || 'unknown',
        missingPhaseCount: arrayOrEmpty(decisionRaw?.missingGates).length,
        failedPhaseCount: arrayOrEmpty(decisionRaw?.failedGates).length,
        featureFlagDefaultEnabled: decisionRaw?.featureFlag?.defaultEnabled === true,
      },
      readiness,
      gates: this.buildGates({
        preCanaryReady,
        preCanaryLinked: Boolean(preCanaryRaw),
        rolloutPlanReady,
        rolloutLinked: Boolean(rolloutRaw),
        releaseExecutionReady,
        executionLinked: Boolean(executionRaw),
        canaryPromotionReady,
        canaryLinked: Boolean(canaryRaw),
        releaseDecisionReady,
        decisionLinked: Boolean(decisionRaw),
        safeguardsReady,
        blocked,
      }),
      receipts: this.buildReceipts(readiness),
      policy: {
        noUngovernedDeploy: true,
        manualPromotionRequired: true,
        noAutoExecute: true,
        noGlobalRolloutByDefault: true,
        noSkipCanary: true,
        noSkipApproval: true,
        rollbackPathRequired: true,
        auditReceiptsRequired: true,
        featureFlagRequired: true,
        naturalLanguageDoesNotBypassPolicy: true,
      },
      surface: {
        cliCommand: `zavorth blueprint-completion run ${run.id} --json`,
        zavorthControlPath: `/zavorthControl...runId=${encodeURIComponent(run.id)}&sector=config`,
        preCanaryCommand: 'npm run qa:release-candidate-pre-canary',
        rolloutCommand: 'npm run qa:capability-autopilot-release-rollout',
        executionCommand: 'npm run qa:capability-autopilot-release-execution',
        canaryPromotionCommand: 'npm run qa:capability-autopilot-canary-promotion',
        decisionCommand: 'npm run qa:capability-autopilot-release-decision',
        finalGateCommand: 'npm run qa:blueprint-completion',
      },
      nextSafeAction: this.resolveNextSafeAction(status),
    };
  }

  private readPreCanary(run: UniversalAgentRun): ReleaseCandidatePreCanaryGateSnapshot | null {
    return (recordOrNull(run.metadata.releaseCandidatePreCanaryGate)
      || recordOrNull(run.metadata.preCanaryGate)) as unknown as ReleaseCandidatePreCanaryGateSnapshot | null;
  }

  private readRolloutPlan(run: UniversalAgentRun): CapabilityAutopilotReleaseRolloutPlanSnapshot | null {
    return (recordOrNull(run.metadata.capabilityAutopilotReleaseRolloutPlan)
      || recordOrNull(run.metadata.releaseRolloutPlan)
      || recordOrNull(run.metadata.capabilityAutopilotRolloutPlan)) as unknown as CapabilityAutopilotReleaseRolloutPlanSnapshot | null;
  }

  private readReleaseExecution(run: UniversalAgentRun): CapabilityAutopilotReleaseExecutionSnapshot | null {
    return (recordOrNull(run.metadata.capabilityAutopilotReleaseExecution)
      || recordOrNull(run.metadata.releaseExecutionGate)
      || recordOrNull(run.metadata.capabilityAutopilotReleaseExecutionGate)) as unknown as CapabilityAutopilotReleaseExecutionSnapshot | null;
  }

  private readCanaryPromotion(run: UniversalAgentRun): CapabilityAutopilotCanaryPromotionSnapshot | null {
    return (recordOrNull(run.metadata.capabilityAutopilotCanaryPromotion)
      || recordOrNull(run.metadata.canaryPromotionGate)
      || recordOrNull(run.metadata.capabilityAutopilotCanaryMonitoringPromotionGate)) as unknown as CapabilityAutopilotCanaryPromotionSnapshot | null;
  }

  private readReleaseDecision(run: UniversalAgentRun): CapabilityAutopilotReleaseDecisionSnapshot | null {
    return (recordOrNull(run.metadata.capabilityAutopilotReleaseDecision)
      || recordOrNull(run.metadata.releaseDecision)
      || recordOrNull(run.metadata.capabilityAutopilotDecision)) as unknown as CapabilityAutopilotReleaseDecisionSnapshot | null;
  }

  private resolveStatus(input: {
    blocked: boolean;
    preCanaryReady: boolean;
    rolloutPlanReady: boolean;
    releaseExecutionReady: boolean;
    canaryPromotionReady: boolean;
    releaseDecisionReady: boolean;
    blueprintComplete: boolean;
  }): BlueprintCompletionGateStatus {
    if (input.blocked) {
      return 'blocked';
    }
    if (!input.preCanaryReady) {
      return 'needs-pre-canary';
    }
    if (!input.rolloutPlanReady) {
      return 'needs-rollout-plan';
    }
    if (!input.releaseExecutionReady) {
      return 'needs-release-execution';
    }
    if (!input.canaryPromotionReady) {
      return 'needs-canary-promotion';
    }
    if (!input.releaseDecisionReady) {
      return 'needs-release-decision';
    }
    return input.blueprintComplete ? 'blueprint-complete' : 'needs-release-decision';
  }

  private buildGates(input: {
    preCanaryReady: boolean;
    preCanaryLinked: boolean;
    rolloutPlanReady: boolean;
    rolloutLinked: boolean;
    releaseExecutionReady: boolean;
    executionLinked: boolean;
    canaryPromotionReady: boolean;
    canaryLinked: boolean;
    releaseDecisionReady: boolean;
    decisionLinked: boolean;
    safeguardsReady: boolean;
    blocked: boolean;
  }): BlueprintCompletionGate[] {
    return [
      {
        id: 'pre-canary',
        label: 'Pre-canary gate closed',
        status: gateLevel(input.preCanaryReady, input.preCanaryLinked),
        source: 'ReleaseCandidatePreCanaryGateService',
        command: 'npm run qa:release-candidate-pre-canary',
        detail: 'Pre-Canary Gate must be pre-canary-ready before final closure.',
        critical: true,
      },
      {
        id: 'rollout-plan',
        label: 'Rollout manual governado',
        status: gateLevel(input.rolloutPlanReady, input.rolloutLinked),
        source: 'CapabilityAutopilotReleaseRolloutPlanService',
        command: 'npm run qa:capability-autopilot-release-rollout',
        detail: 'Rollout needs cohorts, rollback window, and manual promotion.',
        critical: true,
      },
      {
        id: 'release-execution',
        label: 'Release execution gate',
        status: gateLevel(input.releaseExecutionReady, input.executionLinked),
        source: 'CapabilityAutopilotReleaseExecutionGateService',
        command: 'npm run qa:capability-autopilot-release-execution',
        detail: 'Execution needs operator manual, artifacts, limited canary, rollback, and observability.',
        critical: true,
      },
      {
        id: 'canary-promotion',
        label: 'Canary monitoring promotion',
        status: gateLevel(input.canaryPromotionReady, input.canaryLinked),
        source: 'CapabilityAutopilotCanaryMonitoringPromotionGateService',
        command: 'npm run qa:capability-autopilot-canary-promotion',
        detail: 'Promotion depends on observation, health, incidents, feedback, and approval.',
        critical: true,
      },
      {
        id: 'release-decision',
        label: 'Release decision final',
        status: gateLevel(input.releaseDecisionReady, input.decisionLinked),
        source: 'CapabilityAutopilotReleaseDecisionService',
        command: 'npm run qa:capability-autopilot-release-decision',
        detail: 'Decision needs ship flagged/default-on with no missing or failing steps.',
        critical: true,
      },
      {
        id: 'safeguards',
        label: 'Safeguards finais',
        status: gateLevel(input.safeguardsReady, true, input.blocked),
        source: 'BlueprintCompletionGateService',
        command: 'npm run qa:blueprint-completion',
        detail: 'without auto-execute, global rollout, skip canary, skip approval ou auto-promote.',
        critical: true,
      },
    ];
  }

  private buildReceipts(readiness: BlueprintCompletionGateSnapshot['readiness']): BlueprintCompletionGateSnapshot['receipts'] {
    return [
      {
        id: 'blueprint:pre-canary',
        kind: 'pre-canary',
        source: 'ReleaseCandidatePreCanaryGateService',
        detail: readiness.preCanaryReady ? 'Pre-canary ready.' : 'Pre-canary pending.',
        status: readiness.preCanaryReady ? 'ready' : 'needs-action',
      },
      {
        id: 'blueprint:rollout',
        kind: 'rollout',
        source: 'CapabilityAutopilotReleaseRolloutPlanService',
        detail: readiness.rolloutPlanReady ? 'Rollout governado ready.' : 'Rollout pending.',
        status: readiness.rolloutPlanReady ? 'ready' : 'needs-action',
      },
      {
        id: 'blueprint:execution',
        kind: 'execution',
        source: 'CapabilityAutopilotReleaseExecutionGateService',
        detail: readiness.releaseExecutionReady ? 'Execution gate ready.' : 'Execution gate pending.',
        status: readiness.releaseExecutionReady ? 'ready' : 'needs-action',
      },
      {
        id: 'blueprint:canary',
        kind: 'canary',
        source: 'CapabilityAutopilotCanaryMonitoringPromotionGateService',
        detail: readiness.canaryPromotionReady ? 'Canary promotion ready.' : 'Canary promotion pending.',
        status: readiness.canaryPromotionReady ? 'ready' : 'needs-action',
      },
      {
        id: 'blueprint:decision',
        kind: 'decision',
        source: 'CapabilityAutopilotReleaseDecisionService',
        detail: readiness.releaseDecisionReady ? 'Release decision ready.' : 'Release decision pending.',
        status: readiness.releaseDecisionReady ? 'ready' : 'needs-action',
      },
      {
        id: 'blueprint:policy',
        kind: 'policy',
        source: 'BlueprintCompletionGateService',
        detail: readiness.safeguardsReady ? 'Safeguards finais ready.' : 'Safeguards finais pending.',
        status: readiness.safeguardsReady ? 'ready' : 'needs-action',
      },
    ];
  }

  private resolveNextSafeAction(status: BlueprintCompletionGateStatus): string {
    if (status === 'needs-pre-canary') {
      return 'Fechar Pre-Canary Gate como pre-canary-ready.';
    }
    if (status === 'needs-rollout-plan') {
      return 'Anexar rollout_plan_ready com manual promotion, cohorts e rollback.';
    }
    if (status === 'needs-release-execution') {
      return 'Anexar release_execution_ready com operador manual, artifacts e observabilidade.';
    }
    if (status === 'needs-canary-promotion') {
      return 'Attach canary_promotion_ready with metrics, incident review, and approval.';
    }
    if (status === 'needs-release-decision') {
      return 'Anexar release decision ship_v1_1_flagged/default_on without stages faltando ou falhando.';
    }
    if (status === 'blocked') {
      return 'Remover bloqueios e qualquer auto/global/skip before marcar o blueprint como completo.';
    }
    return 'Blueprint runtime is complete; next changes should be real product work, real users, or a new backlog outside this file.';
  }
}
