import type { AiFirstRoutePlanNormalizationResult } from '../contracts/AiFirstRoutePlanContract.js';
import type { ZavorthResponseDecision } from '../contracts/ZavorthResponseDecisionContract.js';
import {
  AI_FIRST_SHADOW_ROUTER_CONTRACT_VERSION,
  type AiFirstShadowAiRouteSummary,
  type AiFirstShadowDivergence,
  type AiFirstShadowDivergenceSeverity,
  type AiFirstShadowLegacyRouteSummary,
  type AiFirstShadowRouteFamily,
  type AiFirstShadowRouterRecommendation,
  type AiFirstShadowRouterSnapshot,
} from '../contracts/AiFirstShadowRouterContract.js';
import {
  AiFirstRoutePlanContractService,
  redactSensitiveText,
} from './AiFirstRoutePlanContractService.js';

type AiFirstShadowRouterRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  planService?: Pick<AiFirstRoutePlanContractService, 'normalize'>;
};

export type AiFirstShadowRouterInput = {
  surface?: string | null;
  userMessage?: string | null;
  rawAiPlan?: unknown;
  aiPlanResult?: AiFirstRoutePlanNormalizationResult | null;
  legacyDecision?: ZavorthResponseDecision | null;
  legacyRoute?: Partial<AiFirstShadowLegacyRouteSummary> | null;
};

const RISK_RANK = {
  safe: 0,
  attention: 1,
  danger: 2,
};

export class AiFirstShadowRouterService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly planService: Pick<AiFirstRoutePlanContractService, 'normalize'>;
  private sequence = 0;

  constructor(runtime: AiFirstShadowRouterRuntime = {}) {
    this.now = runtime.now ?? (() => new Date());
    this.idFactory = runtime.idFactory ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
    this.planService = runtime.planService ?? new AiFirstRoutePlanContractService({
      now: this.now,
      idFactory: this.idFactory,
    });
  }

  public compare(input: AiFirstShadowRouterInput): AiFirstShadowRouterSnapshot {
    const userMessage = redactSensitiveText(String(input.userMessage || ''));
    const surface = String(input.surface || 'conversation');
    const aiPlanResult = input.aiPlanResult ?? this.planService.normalize({
      surface,
      userMessage,
      rawPlan: input.rawAiPlan,
    });
    const legacy = this.summarizeLegacyRoute(input);
    const aiFirst = this.summarizeAiRoute(aiPlanResult);
    const divergences = this.compareRoutes(legacy, aiFirst);
    const summary = summarizeDivergences(divergences);
    const recommendation = recommend(summary, aiFirst.accepted);

    return {
      contractVersion: AI_FIRST_SHADOW_ROUTER_CONTRACT_VERSION,
      source: 'ai-first-shadow-router',
      generatedAt: this.now().toISOString(),
      shadowId: this.idFactory('shadow'),
      input: {
        surface,
        userMessage,
      },
      legacy,
      aiFirst,
      divergences,
      summary,
      recommendation,
      receipts: [
        {
          id: this.idFactory('receipt'),
          kind: 'shadow-normalization',
          detail: 'AI-first plan normalized for comparison only.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'comparison',
          detail: 'Current route and AI-first route were compared without mutating runtime behavior.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'no-runtime-change',
          detail: 'Current runtime decision remains authoritative in Phase 2.',
        },
        ...(divergences.length > 0
          ? [{
              id: this.idFactory('receipt'),
              kind: 'divergence' as const,
              detail: `${divergences.length} divergence(s) recorded for shadow analysis.`,
            }]
          : []),
      ],
      gates: [
        {
          id: 'phase-2-shadow-only',
          status: 'passed',
          detail: 'Shadow router reports differences but does not replace the current route.',
        },
        {
          id: 'phase-2-no-execution',
          status: 'passed',
          detail: 'The AI-first route plan cannot execute from shadow mode.',
        },
        {
          id: 'phase-2-current-runtime-preserved',
          status: 'passed',
          detail: 'defaultRuntimeChanged is false and keepCurrentRuntimeDecision is true.',
        },
      ],
    };
  }

  public renderMarkdown(snapshot: AiFirstShadowRouterSnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth AI-first Router Phase 2');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- shadowId: ${snapshot.shadowId}`);
    lines.push(`- defaultRuntimeChanged: ${String(snapshot.recommendation.defaultRuntimeChanged)}`);
    lines.push(`- recommendation: ${snapshot.recommendation.action}`);
    lines.push(`- divergences: ${snapshot.summary.totalDivergences}`);
    lines.push('');
    lines.push('## Legacy route');
    lines.push(`- family: ${snapshot.legacy.routeFamily}`);
    lines.push(`- mode: ${snapshot.legacy.mode}`);
    lines.push(`- path: ${snapshot.legacy.responsePath}`);
    lines.push(`- shouldExecute: ${String(snapshot.legacy.shouldExecute)}`);
    lines.push(`- risk: ${snapshot.legacy.risk}`);
    lines.push('');
    lines.push('## AI-first route');
    lines.push(`- accepted: ${String(snapshot.aiFirst.accepted)}`);
    lines.push(`- family: ${snapshot.aiFirst.routeFamily}`);
    lines.push(`- intent: ${snapshot.aiFirst.intent}`);
    lines.push(`- nextSafeAction: ${snapshot.aiFirst.nextSafeAction}`);
    lines.push(`- risk: ${snapshot.aiFirst.risk}`);
    lines.push(`- requiresApproval: ${String(snapshot.aiFirst.requiresApproval)}`);
    lines.push(`- requiresPreview: ${String(snapshot.aiFirst.requiresPreview)}`);
    lines.push('');
    lines.push('## Divergences');
    if (snapshot.divergences.length === 0) {
      lines.push('- none');
    } else {
      for (const divergence of snapshot.divergences) {
        lines.push(`- ${divergence.severity} / ${divergence.kind}: ${divergence.detail}`);
      }
    }
    return lines.join('\n');
  }

  private summarizeLegacyRoute(input: AiFirstShadowRouterInput): AiFirstShadowLegacyRouteSummary {
    if (input.legacyRoute) {
      return {
        source: input.legacyRoute.source || 'manual-fixture',
        mode: input.legacyRoute.mode || 'unknown',
        responsePath: input.legacyRoute.responsePath || 'unknown',
        shouldExecute: Boolean(input.legacyRoute.shouldExecute),
        requestedTools: uniqueStrings(input.legacyRoute.requestedTools || []),
        routeFamily: input.legacyRoute.routeFamily || 'unknown',
        risk: input.legacyRoute.risk || 'safe',
        nextSafeAction: input.legacyRoute.nextSafeAction || 'answer',
        confidence: input.legacyRoute.confidence || 'unknown',
        reason: input.legacyRoute.reason || 'Manual legacy route summary.',
      };
    }

    const decision = input.legacyDecision;
    if (!decision) {
      return {
        source: 'none',
        mode: 'unknown',
        responsePath: 'unknown',
        shouldExecute: false,
        requestedTools: [],
        routeFamily: 'unknown',
        risk: 'safe',
        nextSafeAction: 'answer',
        confidence: 'unknown',
        reason: 'No current route supplied.',
      };
    }

    const requestedTools = uniqueStrings(decision.requestedTools || []);
    return {
      source: 'zavorth-response-decision',
      mode: decision.mode,
      responsePath: decision.responsePath,
      shouldExecute: Boolean(decision.diagnostics.shouldExecute),
      requestedTools,
      routeFamily: inferLegacyFamily(decision.mode, decision.responsePath, requestedTools),
      risk: normalizeRisk(decision.diagnostics.universalIntent?.risk) || inferRiskFromTools(requestedTools, decision.responsePath),
      nextSafeAction: normalizeNextSafeAction(decision.diagnostics.universalIntent?.nextSafeAction)
        || inferNextSafeActionFromDecision(decision.responsePath, requestedTools),
      confidence: decision.confidence,
      reason: decision.reason || decision.sourceReason || 'Current route decision.',
    };
  }

  private summarizeAiRoute(planResult: AiFirstRoutePlanNormalizationResult): AiFirstShadowAiRouteSummary {
    const plan = planResult.normalized;
    return {
      accepted: planResult.accepted,
      intent: plan.intent.primary,
      routeFamily: mapAiIntentToFamily(plan.intent.primary),
      risk: plan.risk.level,
      nextSafeAction: plan.policy.nextSafeAction,
      requestedTools: uniqueStrings(plan.requestedTools),
      requiresApproval: plan.policy.requiresApproval,
      requiresPreview: plan.policy.requiresPreview,
      canExecuteNow: false,
      diagnostics: {
        warnings: [...plan.diagnostics.warnings],
        errors: [...plan.diagnostics.errors],
      },
    };
  }

  private compareRoutes(
    legacy: AiFirstShadowLegacyRouteSummary,
    aiFirst: AiFirstShadowAiRouteSummary,
  ): AiFirstShadowDivergence[] {
    const divergences: AiFirstShadowDivergence[] = [];

    if (!aiFirst.accepted || aiFirst.diagnostics.errors.length > 0) {
      divergences.push(this.divergence({
        kind: 'ai-plan-quality',
        severity: aiFirst.diagnostics.errors.length > 0 ? 'high' : 'medium',
        legacy: 'accepted-current-route',
        aiFirst: 'invalid-or-fallback-ai-plan',
        detail: 'AI-first plan was not accepted and must stay in observation.',
      }));
    }

    if (legacy.routeFamily !== 'unknown' && aiFirst.routeFamily !== 'unknown' && legacy.routeFamily !== aiFirst.routeFamily) {
      divergences.push(this.divergence({
        kind: 'intent-family',
        severity: familyDivergenceSeverity(legacy.routeFamily, aiFirst.routeFamily),
        legacy: legacy.routeFamily,
        aiFirst: aiFirst.routeFamily,
        detail: `Current route sees ${legacy.routeFamily}; AI-first sees ${aiFirst.routeFamily}.`,
      }));
    }

    const legacyOperational = legacy.shouldExecute || legacy.responsePath !== 'fast-chat';
    const aiOperational = aiFirst.routeFamily !== 'conversation'
      || aiFirst.requiresApproval
      || aiFirst.requiresPreview
      || aiFirst.nextSafeAction === 'execute-governed-safe-read'
      || aiFirst.nextSafeAction === 'preview-then-request-permission'
      || aiFirst.nextSafeAction === 'request-permission';
    if (legacyOperational !== aiOperational) {
      divergences.push(this.divergence({
        kind: 'execution-posture',
        severity: legacyOperational ? 'medium' : 'high',
        legacy: legacyOperational ? 'operational' : 'conversation',
        aiFirst: aiOperational ? 'operational' : 'conversation',
        detail: 'Current route and AI-first route disagree about whether this should wake governed runtime.',
      }));
    }

    const riskDistance = Math.abs(RISK_RANK[legacy.risk] - RISK_RANK[aiFirst.risk]);
    if (riskDistance > 0) {
      divergences.push(this.divergence({
        kind: 'risk',
        severity: riskDistance > 1 || aiFirst.risk === 'danger' ? 'high' : 'medium',
        legacy: legacy.risk,
        aiFirst: aiFirst.risk,
        detail: 'Risk estimate differs between current route and AI-first route.',
      }));
    }

    if (
      legacyOperational
      && legacy.responsePath !== 'approval-gate'
      && (aiFirst.requiresApproval || aiFirst.requiresPreview)
    ) {
      divergences.push(this.divergence({
        kind: 'policy',
        severity: 'high',
        legacy: legacy.responsePath,
        aiFirst: aiFirst.requiresPreview ? 'preview-required' : 'approval-required',
        detail: 'AI-first route expects preview/approval where current route would continue without an approval path.',
      }));
    }

    const toolDiff = diffToolSets(legacy.requestedTools, aiFirst.requestedTools);
    if (toolDiff.legacyOnly.length > 0 || toolDiff.aiOnly.length > 0) {
      divergences.push(this.divergence({
        kind: 'tools',
        severity: aiOperational || legacyOperational ? 'medium' : 'low',
        legacy: toolDiff.legacyOnly.join(', ') || 'none',
        aiFirst: toolDiff.aiOnly.join(', ') || 'none',
        detail: 'Requested tool sets differ in shadow comparison.',
      }));
    }

    if (legacy.nextSafeAction !== aiFirst.nextSafeAction) {
      divergences.push(this.divergence({
        kind: 'next-action',
        severity: nextActionSeverity(legacy.nextSafeAction, aiFirst.nextSafeAction),
        legacy: legacy.nextSafeAction,
        aiFirst: aiFirst.nextSafeAction,
        detail: 'Next safe action differs between current route and AI-first route.',
      }));
    }

    return divergences;
  }

  private divergence(input: {
    kind: AiFirstShadowDivergence['kind'];
    severity: AiFirstShadowDivergenceSeverity;
    legacy: string;
    aiFirst: string;
    detail: string;
  }): AiFirstShadowDivergence {
    return {
      id: this.idFactory('divergence'),
      ...input,
    };
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

function mapAiIntentToFamily(intent: string): AiFirstShadowRouteFamily {
  if (intent === 'conversation' || intent === 'unknown') {
    return intent;
  }
  if (intent === 'workspace-inspection') {
    return 'inspection';
  }
  if (intent === 'workspace-mutation') {
    return 'mutation';
  }
  if (intent === 'command-execution') {
    return 'command';
  }
  if (intent === 'research') {
    return 'research';
  }
  if (intent === 'configuration' || intent === 'channel-setup' || intent === 'model-selection') {
    return 'configuration';
  }
  if (intent === 'automation') {
    return 'automation';
  }
  return 'unknown';
}

function inferLegacyFamily(
  mode: string,
  responsePath: string,
  requestedTools: string[],
): AiFirstShadowRouteFamily {
  const tools = requestedTools.join(' ').toLowerCase();
  if (mode === 'conversation' || responsePath === 'fast-chat') {
    return 'conversation';
  }
  if (/(shell|bash|powershell|exec|command)/.test(tools)) {
    return 'command';
  }
  if (/(write|edit|patch|apply|filesystem\.write|file\.edit)/.test(tools)) {
    return 'mutation';
  }
  if (/(secret|storage|config|doctor|setup|credential)/.test(tools)) {
    return 'configuration';
  }
  if (/(web|search|fetch|browser|network)/.test(tools)) {
    return 'research';
  }
  if (/(read|inspect|folder|file)/.test(tools) || responsePath === 'local-inspector') {
    return 'inspection';
  }
  if (/(schedule|automation|cron)/.test(tools)) {
    return 'automation';
  }
  if (mode === 'approval' || mode === 'operation') {
    return 'unknown';
  }
  return 'unknown';
}

function normalizeRisk(value: unknown): 'safe' | 'attention' | 'danger' | null {
  if (value === 'safe' || value === 'attention' || value === 'danger') {
    return value;
  }
  return null;
}

function inferRiskFromTools(
  requestedTools: string[],
  responsePath: string,
): 'safe' | 'attention' | 'danger' {
  const tools = requestedTools.join(' ').toLowerCase();
  if (/(shell|bash|powershell|exec|delete|rm|destructive)/.test(tools)) {
    return 'danger';
  }
  if (responsePath === 'approval-gate' || /(write|edit|send|email|post|network|fetch|web|config|secret|storage)/.test(tools)) {
    return 'attention';
  }
  return 'safe';
}

function normalizeNextSafeAction(value: unknown): AiFirstShadowAiRouteSummary['nextSafeAction'] | null {
  if (value === 'answer') {
    return 'answer';
  }
  if (value === 'execute_governed') {
    return 'execute-governed-safe-read';
  }
  if (value === 'ask_clarification') {
    return 'ask-clarification';
  }
  if (value === 'request_permission') {
    return 'request-permission';
  }
  if (value === 'preview_then_request_permission') {
    return 'preview-then-request-permission';
  }
  if (value === 'block') {
    return 'decline';
  }
  return null;
}

function inferNextSafeActionFromDecision(
  responsePath: string,
  requestedTools: string[],
): AiFirstShadowAiRouteSummary['nextSafeAction'] {
  if (responsePath === 'fast-chat') {
    return 'answer';
  }
  if (responsePath === 'approval-gate') {
    return 'request-permission';
  }
  const tools = requestedTools.join(' ').toLowerCase();
  if (/(write|edit|send|shell|exec|config|secret|storage)/.test(tools)) {
    return 'request-permission';
  }
  return 'execute-governed-safe-read';
}

function familyDivergenceSeverity(
  legacy: AiFirstShadowRouteFamily,
  aiFirst: AiFirstShadowRouteFamily,
): AiFirstShadowDivergenceSeverity {
  if (legacy === 'conversation' || aiFirst === 'conversation') {
    return 'high';
  }
  if (legacy === 'command' || aiFirst === 'command') {
    return 'high';
  }
  return 'medium';
}

function nextActionSeverity(
  legacy: AiFirstShadowAiRouteSummary['nextSafeAction'],
  aiFirst: AiFirstShadowAiRouteSummary['nextSafeAction'],
): AiFirstShadowDivergenceSeverity {
  const guarded = new Set(['preview-then-request-permission', 'request-permission', 'decline']);
  if (guarded.has(legacy) || guarded.has(aiFirst)) {
    return 'medium';
  }
  return 'low';
}

function diffToolSets(legacyTools: string[], aiTools: string[]): { legacyOnly: string[]; aiOnly: string[] } {
  const legacy = new Set(legacyTools.map((tool) => tool.toLowerCase()));
  const ai = new Set(aiTools.map((tool) => tool.toLowerCase()));
  return {
    legacyOnly: legacyTools.filter((tool) => !ai.has(tool.toLowerCase())),
    aiOnly: aiTools.filter((tool) => !legacy.has(tool.toLowerCase())),
  };
}

function summarizeDivergences(divergences: AiFirstShadowDivergence[]): AiFirstShadowRouterSnapshot['summary'] {
  return {
    totalDivergences: divergences.length,
    high: divergences.filter((divergence) => divergence.severity === 'high').length,
    medium: divergences.filter((divergence) => divergence.severity === 'medium').length,
    low: divergences.filter((divergence) => divergence.severity === 'low').length,
    info: divergences.filter((divergence) => divergence.severity === 'info').length,
  };
}

function recommend(
  summary: AiFirstShadowRouterSnapshot['summary'],
  accepted: boolean,
): AiFirstShadowRouterRecommendation {
  if (summary.high > 0) {
    return {
      defaultRuntimeChanged: false,
      keepCurrentRuntimeDecision: true,
      action: 'investigate-divergence',
      reason: 'High-severity divergence requires analysis before promotion.',
    };
  }
  if (!accepted || summary.medium > 0) {
    return {
      defaultRuntimeChanged: false,
      keepCurrentRuntimeDecision: true,
      action: 'collect-more-samples',
      reason: 'Shadow route needs more samples before default consideration.',
    };
  }
  if (summary.totalDivergences === 0) {
    return {
      defaultRuntimeChanged: false,
      keepCurrentRuntimeDecision: true,
      action: 'ready-for-shadow-batch',
      reason: 'This sample matches the current route; continue batch shadow evaluation.',
    };
  }
  return {
    defaultRuntimeChanged: false,
    keepCurrentRuntimeDecision: true,
    action: 'observe',
    reason: 'Only low-severity differences were observed.',
  };
}
