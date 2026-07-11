import type {
  AiFirstRoutePlan,
  AiFirstRoutePlanNormalizationResult,
  AiFirstRoutePlanRisk,
  AiFirstRoutePlanSideEffect,
} from '../contracts/AiFirstRoutePlanContract.js';
import {
  AI_FIRST_POLICY_GUARDRAIL_CONTRACT_VERSION,
  type AiFirstPolicyGuardrailMismatch,
  type AiFirstPolicyGuardrailMismatchSeverity,
  type AiFirstPolicyGuardrailSnapshot,
  type AiFirstPolicyGuardrailStatus,
} from '../contracts/AiFirstPolicyGuardrailContract.js';
import {
  UniversalPreviewModeService,
  type UniversalPreviewModeSnapshot,
} from '../runtime/agent/UniversalPreviewModeService.js';
import {
  UniversalIntentService,
  type UniversalIntentDecision,
  type UniversalIntentInput,
  type UniversalIntentNextSafeAction,
} from '../runtime/uni/index.js';
import {
  AiFirstRoutePlanContractService,
  redactSensitiveText,
} from './AiFirstRoutePlanContractService.js';
import { AiFirstShadowRouterService } from './AiFirstShadowRouterService.js';

import type { AiFirstShadowRouterSnapshot } from '../contracts/AiFirstShadowRouterContract.js';
import type { ZavorthResponseDecision } from '../contracts/ZavorthResponseDecisionContract.js';
import type {
  UniversalAgentChannel,
  UniversalToolExposure,
  UniversalToolExposureProfile,
  UniversalToolRiskLevel,
} from '../runtime/agent/UniversalAgentRuntimeTypes.js';




type AiFirstPolicyGuardrailRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  planService?: Pick<AiFirstRoutePlanContractService, 'normalize'>;
  shadowRouterService?: Pick<AiFirstShadowRouterService, 'compare'>;
  universalIntentService?: Pick<UniversalIntentService, 'decide'>;
  previewModeService?: Pick<UniversalPreviewModeService, 'buildSnapshot'>;
};

export type AiFirstPolicyGuardrailInput = {
  surface?: string | null;
  userMessage?: string | null;
  rawAiPlan?: unknown;
  aiPlanResult?: AiFirstRoutePlanNormalizationResult | null;
  shadowSnapshot?: AiFirstShadowRouterSnapshot | null;
  legacyDecision?: ZavorthResponseDecision | null;
  workspaceRoot?: string | null;
  targetPath?: string | null;
  trustMode?: 'protected' | 'collaborator' | 'overlord' | null;
  userRole?: string | null;
};

const RISK_RANK: Record<AiFirstRoutePlanRisk, number> = {
  safe: 0,
  attention: 1,
  danger: 2,
};

export class AiFirstPolicyGuardrailService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly planService: Pick<AiFirstRoutePlanContractService, 'normalize'>;
  private readonly shadowRouterService: Pick<AiFirstShadowRouterService, 'compare'>;
  private readonly universalIntentService: Pick<UniversalIntentService, 'decide'>;
  private readonly previewModeService: Pick<UniversalPreviewModeService, 'buildSnapshot'>;
  private sequence = 0;

  constructor(runtime: AiFirstPolicyGuardrailRuntime = {}) {
    this.now = runtime.now ?? (() => new Date());
    this.idFactory = runtime.idFactory ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
    this.planService = runtime.planService ?? new AiFirstRoutePlanContractService({
      now: this.now,
      idFactory: this.idFactory,
    });
    this.shadowRouterService = runtime.shadowRouterService ?? new AiFirstShadowRouterService({
      now: this.now,
      idFactory: this.idFactory,
      planService: this.planService,
    });
    this.universalIntentService = runtime.universalIntentService ?? new UniversalIntentService({
      now: this.now,
    });
    this.previewModeService = runtime.previewModeService ?? new UniversalPreviewModeService({
      now: this.now,
    });
  }

  public evaluate(input: AiFirstPolicyGuardrailInput): AiFirstPolicyGuardrailSnapshot {
    const surface = String(input.surface || input.shadowSnapshot?.input.surface || 'conversation');
    const userMessage = redactSensitiveText(String(input.userMessage || input.shadowSnapshot?.input.userMessage || ''));
    const aiPlanResult = input.aiPlanResult ?? this.planService.normalize({
      surface,
      userMessage,
      rawPlan: input.rawAiPlan,
    });
    const shadowSnapshot = input.shadowSnapshot ?? this.shadowRouterService.compare({
      surface,
      userMessage,
      rawAiPlan: input.rawAiPlan,
      aiPlanResult,
      legacyDecision: input.legacyDecision || null,
    });
    const universalIntent = this.universalIntentService.decide(this.toUniversalIntentInput({
      input,
      surface,
      userMessage,
      plan: aiPlanResult.normalized,
    }));
    const preview = this.previewModeService.buildSnapshot({
      text: userMessage,
      surface: normalizeSurface(surface),
      requestedTools: aiPlanResult.normalized.requestedTools,
      toolExposure: this.toToolExposure(aiPlanResult.normalized),
      metadata: {
        previewMode: aiPlanResult.normalized.policy.requiresPreview,
        aiFirstPolicyGuardrail: true,
      },
      generatedAt: this.now().toISOString(),
    });
    const mismatches = this.buildMismatches({
      aiPlanResult,
      shadowSnapshot,
      universalIntent,
      preview,
    });
    const summary = summarizeMismatches(mismatches);
    const decision = buildDecision({
      summary,
      mismatches,
      aiPlanResult,
      shadowSnapshot,
      universalIntent,
    });

    return {
      contractVersion: AI_FIRST_POLICY_GUARDRAIL_CONTRACT_VERSION,
      source: 'ai-first-policy-guardrail',
      generatedAt: this.now().toISOString(),
      guardrailId: this.idFactory('guardrail'),
      input: {
        surface,
        userMessage,
      },
      aiPlan: {
        accepted: aiPlanResult.accepted,
        intent: aiPlanResult.normalized.intent.primary,
        risk: aiPlanResult.normalized.risk.level,
        nextSafeAction: aiPlanResult.normalized.policy.nextSafeAction,
        requiresApproval: aiPlanResult.normalized.policy.requiresApproval,
        requiresPreview: aiPlanResult.normalized.policy.requiresPreview,
        canExecuteNow: false,
        requestedTools: [...aiPlanResult.normalized.requestedTools],
      },
      shadow: {
        shadowId: shadowSnapshot.shadowId,
        totalDivergences: shadowSnapshot.summary.totalDivergences,
        highDivergences: shadowSnapshot.summary.high,
        mediumDivergences: shadowSnapshot.summary.medium,
        recommendation: shadowSnapshot.recommendation.action,
        defaultRuntimeChanged: false,
        keepCurrentRuntimeDecision: true,
      },
      deterministicPolicy: {
        intent: universalIntent.intent,
        risk: universalIntent.risk,
        sideEffect: universalIntent.safety.sideEffect,
        requiresClarification: universalIntent.requiresClarification,
        requiresPermission: universalIntent.requiresPermission,
        permissionKind: universalIntent.permissionRequest?.kind || null,
        approvalRequired: Boolean(universalIntent.permissionRequest?.approvalRequired || universalIntent.requiresPermission),
        previewRequired: Boolean(universalIntent.permissionRequest?.previewRequired),
        nextSafeAction: universalIntent.nextSafeAction,
        trustBlocked: universalIntent.trustPosture.blocked,
        trustPosture: universalIntent.trustPosture.posture,
        matchedSignals: [...universalIntent.diagnostics.matchedSignals],
      },
      preview: {
        mode: preview.mode,
        highestRisk: normalizePreviewRisk(preview.risk.highestRisk),
        requiresApproval: preview.risk.requiresApproval,
        previewRequired: preview.risk.previewRequired,
        noExecutionPerformed: true,
        executorBlockedInPreviewMode: preview.safety.executorBlockedInPreviewMode,
        toolsActuallyCalled: [],
      },
      mismatches,
      summary,
      decision,
      receipts: [
        {
          id: this.idFactory('receipt'),
          kind: 'policy',
          detail: 'AI-first plan validated by deterministic UniversalIntent policy.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'preview',
          detail: 'Preview snapshot was built without tool execution.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'permission',
          detail: universalIntent.requiresPermission
            ? 'Permission remains required before any sensitive action.'
            : 'No permission request was required by deterministic policy.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'shadow',
          detail: 'Shadow router remains comparison-only and current runtime stays authoritative.',
        },
        ...(decision.status === 'block'
          ? [{
              id: this.idFactory('receipt'),
              kind: 'block' as const,
              detail: 'Policy guardrail blocked promotion of this AI-first sample.',
            }]
          : []),
      ],
      gates: [
        {
          id: 'checkpoint-3-deterministic-policy-authoritative',
          status: 'passed',
          detail: 'UniversalIntent policy validates the AI-first proposal before promotion.',
        },
        {
          id: 'checkpoint-3-preview-no-execution',
          status: 'passed',
          detail: 'Preview mode produced a no-execution snapshot.',
        },
        {
          id: 'checkpoint-3-approval-preserved',
          status: 'passed',
          detail: 'Approval requirements cannot be removed by the AI-first plan.',
        },
        {
          id: 'checkpoint-3-current-runtime-preserved',
          status: 'passed',
          detail: 'defaultRuntimeChanged is false and keepCurrentRuntimeDecision is true.',
        },
      ],
    };
  }

  public renderMarkdown(snapshot: AiFirstPolicyGuardrailSnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth AI-first Router Approval gate');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- guardrailId: ${snapshot.guardrailId}`);
    lines.push(`- status: ${snapshot.decision.status}`);
    lines.push(`- action: ${snapshot.decision.action}`);
    lines.push(`- sampleEligibleForPromotion: ${String(snapshot.decision.sampleEligibleForPromotion)}`);
    lines.push(`- canExecuteNow: ${String(snapshot.decision.canExecuteNow)}`);
    lines.push(`- defaultRuntimeChanged: ${String(snapshot.decision.defaultRuntimeChanged)}`);
    lines.push('');
    lines.push('## AI-first plan');
    lines.push(`- intent: ${snapshot.aiPlan.intent}`);
    lines.push(`- risk: ${snapshot.aiPlan.risk}`);
    lines.push(`- requiresApproval: ${String(snapshot.aiPlan.requiresApproval)}`);
    lines.push(`- requiresPreview: ${String(snapshot.aiPlan.requiresPreview)}`);
    lines.push('');
    lines.push('## Deterministic policy');
    lines.push(`- intent: ${snapshot.deterministicPolicy.intent}`);
    lines.push(`- risk: ${snapshot.deterministicPolicy.risk}`);
    lines.push(`- sideEffect: ${snapshot.deterministicPolicy.sideEffect}`);
    lines.push(`- requiresPermission: ${String(snapshot.deterministicPolicy.requiresPermission)}`);
    lines.push(`- nextSafeAction: ${snapshot.deterministicPolicy.nextSafeAction}`);
    lines.push('');
    lines.push('## Mismatches');
    if (snapshot.mismatches.length === 0) {
      lines.push('- none');
    } else {
      for (const mismatch of snapshot.mismatches) {
        lines.push(`- ${mismatch.severity} / ${mismatch.kind}: ${mismatch.detail}`);
      }
    }
    return lines.join('\n');
  }

  private toUniversalIntentInput(input: {
    input: AiFirstPolicyGuardrailInput;
    surface: string;
    userMessage: string;
    plan: AiFirstRoutePlan;
  }): UniversalIntentInput {
    const sideEffects = input.plan.risk.sideEffects;
    const actionKinds = input.plan.proposedActions.map((action) => action.kind);
    return {
      surface: input.surface,
      text: input.userMessage,
      requestedTools: input.plan.requestedTools,
      capabilityIds: input.plan.requestedTools,
      userRole: input.input.userRole || null,
      trustMode: input.input.trustMode || null,
      contextHints: {
        workspaceRoot: input.input.workspaceRoot || null,
        targetPath: input.input.targetPath || firstTargetValue(input.plan),
        hostScopeRequested: input.plan.proposedActions.some((action) => action.target.type === 'external'),
      },
      riskHints: {
        mutation: sideEffects.includes('local-write')
          || sideEffects.includes('destructive')
          || actionKinds.some((kind) => kind === 'write' || kind === 'configure' || kind === 'test'),
        shell: sideEffects.includes('command') || actionKinds.includes('run-command'),
        network: sideEffects.includes('network') || actionKinds.includes('search'),
        externalSideEffect: sideEffects.includes('external-send') || actionKinds.includes('send'),
        destructive: sideEffects.includes('destructive'),
        approvalRequired: input.plan.policy.requiresApproval,
        operatorRequired: input.plan.risk.level === 'danger' && sideEffects.includes('command'),
      },
    };
  }

  private toToolExposure(plan: AiFirstRoutePlan): UniversalToolExposureProfile {
    const tools: UniversalToolExposure[] = [];
    for (const action of plan.proposedActions) {
      const toolIds = action.requestedToolIds.length > 0
        ? action.requestedToolIds
        : action.sideEffect === 'none'
          ? []
          : [`ai-first.${action.kind}`];
      for (const toolId of toolIds) {
        tools.push({
          id: toolId,
          label: action.label || toolId,
          risk: action.risk,
          requiresApproval: action.requiresApproval,
          description: action.summary,
          policyTags: action.requiresPreview ? ['preview-required'] : [],
        });
      }
    }
    const highest = maxRisk(tools.map((tool) => normalizeToolRisk(tool.risk)));
    return {
      mode: highest === 'danger'
        ? 'restricted'
        : tools.some((tool) => tool.requiresApproval)
          ? 'confirm'
          : 'safe',
      summary: 'AI-first policy guardrail exposure preview.',
      tools,
      blockedTools: [],
    };
  }

  private buildMismatches(input: {
    aiPlanResult: AiFirstRoutePlanNormalizationResult;
    shadowSnapshot: AiFirstShadowRouterSnapshot;
    universalIntent: UniversalIntentDecision;
    preview: UniversalPreviewModeSnapshot;
  }): AiFirstPolicyGuardrailMismatch[] {
    const mismatches: AiFirstPolicyGuardrailMismatch[] = [];
    const plan = input.aiPlanResult.normalized;
    if (!input.aiPlanResult.accepted) {
      mismatches.push(this.mismatch({
        kind: 'plan-invalid',
        severity: 'high',
        detail: 'AI-first plan was not accepted by the Intent model contract normalizer.',
        aiFirst: 'invalid',
        deterministic: 'fallback-required',
      }));
    }

    if ((plan.policy.canExecuteNow as boolean) !== false) {
      mismatches.push(this.mismatch({
        kind: 'execution-attempt',
        severity: 'high',
        detail: 'AI-first plan attempted to mark itself executable.',
        aiFirst: 'can-execute-now',
        deterministic: 'no-execution-in-policy-gate',
      }));
    }

    if (RISK_RANK[plan.risk.level] < RISK_RANK[input.universalIntent.risk]) {
      mismatches.push(this.mismatch({
        kind: 'risk-understated',
        severity: input.universalIntent.risk === 'danger' ? 'high' : 'medium',
        detail: 'Deterministic policy found higher risk than the AI-first plan declared.',
        aiFirst: plan.risk.level,
        deterministic: input.universalIntent.risk,
      }));
    }

    const deterministicApprovalRequired = input.universalIntent.requiresPermission
      || input.preview.risk.requiresApproval;
    if (deterministicApprovalRequired && !plan.policy.requiresApproval) {
      mismatches.push(this.mismatch({
        kind: 'approval-missing',
        severity: 'high',
        detail: 'Deterministic policy requires approval, but the AI-first plan did not.',
        aiFirst: 'approval-not-required',
        deterministic: 'approval-required',
      }));
    }

    const deterministicPreviewRequired = Boolean(input.universalIntent.permissionRequest?.previewRequired)
      || input.preview.risk.previewRequired;
    if (deterministicPreviewRequired && !plan.policy.requiresPreview) {
      mismatches.push(this.mismatch({
        kind: 'preview-missing',
        severity: 'high',
        detail: 'Deterministic policy requires preview, but the AI-first plan did not.',
        aiFirst: 'preview-not-required',
        deterministic: 'preview-required',
      }));
    }

    if (input.universalIntent.requiresClarification && plan.policy.nextSafeAction !== 'ask-clarification') {
      mismatches.push(this.mismatch({
        kind: 'clarification-required',
        severity: 'medium',
        detail: 'Deterministic policy wants clarification before action.',
        aiFirst: plan.policy.nextSafeAction,
        deterministic: 'ask-clarification',
      }));
    }

    if (input.universalIntent.trustPosture.blocked) {
      mismatches.push(this.mismatch({
        kind: 'trust-blocked',
        severity: 'high',
        detail: input.universalIntent.trustPosture.blockReason || 'Trust posture blocked this request.',
        aiFirst: 'not-blocked',
        deterministic: 'blocked',
      }));
    }

    if (input.shadowSnapshot.summary.high > 0) {
      mismatches.push(this.mismatch({
        kind: 'shadow-high-divergence',
        severity: 'medium',
        detail: 'Shadow router found high-severity divergence; sample must stay out of promotion.',
        aiFirst: `${input.shadowSnapshot.summary.high} high divergence(s)`,
        deterministic: 'hold-for-shadow-analysis',
      }));
    } else if (input.shadowSnapshot.summary.medium > 0) {
      mismatches.push(this.mismatch({
        kind: 'shadow-medium-divergence',
        severity: 'low',
        detail: 'Shadow router found medium-severity divergence; collect more samples.',
        aiFirst: `${input.shadowSnapshot.summary.medium} medium divergence(s)`,
        deterministic: 'observe',
      }));
    }

    const deterministicNext = normalizeUniversalNextSafeAction(input.universalIntent.nextSafeAction);
    if (deterministicNext && plan.policy.nextSafeAction !== deterministicNext) {
      mismatches.push(this.mismatch({
        kind: 'next-action-mismatch',
        severity: isGuardedNextAction(deterministicNext) ? 'medium' : 'low',
        detail: 'AI-first next safe action differs from deterministic policy.',
        aiFirst: plan.policy.nextSafeAction,
        deterministic: deterministicNext,
      }));
    }

    return mismatches;
  }

  private mismatch(input: {
    kind: AiFirstPolicyGuardrailMismatch['kind'];
    severity: AiFirstPolicyGuardrailMismatchSeverity;
    detail: string;
    aiFirst: string;
    deterministic: string;
  }): AiFirstPolicyGuardrailMismatch {
    return {
      id: this.idFactory('mismatch'),
      ...input,
    };
  }
}

function firstTargetValue(plan: AiFirstRoutePlan): string | null {
  for (const action of plan.proposedActions) {
    if (action.target.value) {
      return action.target.value;
    }
  }
  return null;
}

function normalizeSurface(surface: string): UniversalAgentChannel {
  if (
    surface === 'web'
    || surface === 'cli'
    || surface === 'telegram'
    || surface === 'discord'
    || surface === 'api'
    || surface === 'slack'
    || surface === 'whatsapp'
    || surface === 'signal'
    || surface === 'email'
    || surface === 'teams'
  ) {
    return surface;
  }
  if (surface === 'msteams' || surface === 'ms-teams') return 'teams';
  if (surface === 'wa') return 'whatsapp';
  if (surface === 'mail') return 'email';
  return 'unknown';
}

function normalizeToolRisk(risk: UniversalToolRiskLevel): AiFirstRoutePlanRisk {
  if (risk === 'danger' || risk === 'attention' || risk === 'safe') {
    return risk;
  }
  return 'safe';
}

function normalizePreviewRisk(risk: UniversalToolRiskLevel): AiFirstRoutePlanRisk | 'unknown' {
  if (risk === 'danger' || risk === 'attention' || risk === 'safe' || risk === 'unknown') {
    return risk;
  }
  return 'unknown';
}

function maxRisk(values: AiFirstRoutePlanRisk[]): AiFirstRoutePlanRisk {
  return values.reduce<AiFirstRoutePlanRisk>((current, next) => {
    return RISK_RANK[next] > RISK_RANK[current] ? next : current;
  }, 'safe');
}

function summarizeMismatches(mismatches: AiFirstPolicyGuardrailMismatch[]): AiFirstPolicyGuardrailSnapshot['summary'] {
  return {
    totalMismatches: mismatches.length,
    high: mismatches.filter((mismatch) => mismatch.severity === 'high').length,
    medium: mismatches.filter((mismatch) => mismatch.severity === 'medium').length,
    low: mismatches.filter((mismatch) => mismatch.severity === 'low').length,
    info: mismatches.filter((mismatch) => mismatch.severity === 'info').length,
  };
}

function buildDecision(input: {
  summary: AiFirstPolicyGuardrailSnapshot['summary'];
  mismatches: AiFirstPolicyGuardrailMismatch[];
  aiPlanResult: AiFirstRoutePlanNormalizationResult;
  shadowSnapshot: AiFirstShadowRouterSnapshot;
  universalIntent: UniversalIntentDecision;
}): AiFirstPolicyGuardrailSnapshot['decision'] {
  const blockingKinds = new Set([
    'plan-invalid',
    'risk-understated',
    'approval-missing',
    'preview-missing',
    'trust-blocked',
    'execution-attempt',
  ]);
  const hasBlockingMismatch = input.mismatches.some((mismatch) =>
    mismatch.severity === 'high' && blockingKinds.has(mismatch.kind));
  const status: AiFirstPolicyGuardrailStatus = hasBlockingMismatch
    ? 'block'
    : input.universalIntent.requiresClarification
      ? 'hold'
      : input.summary.medium > 0 || input.shadowSnapshot.summary.high > 0
        ? 'hold'
        : 'pass';
  const action = status === 'block'
    ? 'block-promotion'
    : input.universalIntent.requiresClarification
      ? 'ask-clarification'
      : status === 'hold'
        ? 'hold-for-divergence'
        : 'allow-shadow-sample';

  return {
    status,
    action,
    reason: buildDecisionReason(status, action),
    sampleEligibleForPromotion: status === 'pass' && input.aiPlanResult.accepted,
    canExecuteNow: false,
    defaultRuntimeChanged: false,
    keepCurrentRuntimeDecision: true,
  };
}

function buildDecisionReason(status: AiFirstPolicyGuardrailStatus, action: AiFirstPolicyGuardrailSnapshot['decision']['action']): string {
  if (status === 'block') {
    return 'Deterministic policy found a blocking mismatch; do not promote this sample.';
  }
  if (action === 'ask-clarification') {
    return 'Deterministic policy needs a user clarification before any governed action.';
  }
  if (status === 'hold') {
    return 'Policy is preserved, but divergence must be reviewed before promotion.';
  }
  return 'Policy guardrails agree with the AI-first plan for this shadow sample.';
}

function normalizeUniversalNextSafeAction(
  action: UniversalIntentNextSafeAction,
): AiFirstPolicyGuardrailSnapshot['aiPlan']['nextSafeAction'] | null {
  if (action === 'answer') {
    return 'answer';
  }
  if (action === 'execute_governed') {
    return 'execute-governed-safe-read';
  }
  if (action === 'ask_clarification') {
    return 'ask-clarification';
  }
  if (action === 'request_permission') {
    return 'request-permission';
  }
  if (action === 'preview_then_request_permission') {
    return 'preview-then-request-permission';
  }
  if (action === 'block') {
    return 'decline';
  }
  return null;
}

function isGuardedNextAction(action: AiFirstPolicyGuardrailSnapshot['aiPlan']['nextSafeAction']): boolean {
  return action === 'preview-then-request-permission' || action === 'request-permission' || action === 'decline';
}
