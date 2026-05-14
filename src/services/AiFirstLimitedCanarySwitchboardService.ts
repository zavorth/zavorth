import {
  AI_FIRST_LIMITED_CANARY_SWITCHBOARD_CONTRACT_VERSION,
  type AiFirstLimitedCanaryActivation,
  type AiFirstLimitedCanaryDecisionStatus,
  type AiFirstLimitedCanaryFallbackReason,
  type AiFirstLimitedCanaryRouteDecision,
  type AiFirstLimitedCanaryRouteEntry,
  type AiFirstLimitedCanaryRouteProbe,
  type AiFirstLimitedCanaryRouteStatus,
  type AiFirstLimitedCanarySwitchboardSnapshot,
} from '../contracts/AiFirstLimitedCanarySwitchboardContract.js';
import type {
  AiFirstPromotionAllowlistEntry,
  AiFirstPromotionCandidateRegistrySnapshot,
} from '../contracts/AiFirstPromotionCandidateRegistryContract.js';
import type {
  AiFirstRoutePlanIntent,
  AiFirstRoutePlanRisk,
} from '../contracts/AiFirstRoutePlanContract.js';
import { redactSensitiveText } from './AiFirstRoutePlanContractService.js';

type AiFirstLimitedCanarySwitchboardRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

export type AiFirstLimitedCanaryActivationInput = {
  activationId?: string | null;
  routeKey?: string | null;
  familyId?: AiFirstRoutePlanIntent | null;
  surfaces?: string[] | null;
  enabled?: boolean | null;
  approvedBy?: string | null;
  reason?: string | null;
};

export type AiFirstLimitedCanarySwitchboardInput = {
  switchboardName?: string | null;
  registrySnapshot: AiFirstPromotionCandidateRegistrySnapshot;
  manualActivations?: AiFirstLimitedCanaryActivationInput[] | null;
  routeProbes?: AiFirstLimitedCanaryRouteProbe[] | null;
};

const RISK_RANK: Record<AiFirstRoutePlanRisk, number> = {
  safe: 0,
  attention: 1,
  danger: 2,
};

export class AiFirstLimitedCanarySwitchboardService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(runtime: AiFirstLimitedCanarySwitchboardRuntime = {}) {
    this.now = runtime.now ?? (() => new Date());
    this.idFactory = runtime.idFactory ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public buildSwitchboard(input: AiFirstLimitedCanarySwitchboardInput): AiFirstLimitedCanarySwitchboardSnapshot {
    const registry = input.registrySnapshot;
    const activations = (input.manualActivations || []).map((activation, index) =>
      this.normalizeActivation(activation, index));
    const routes = registry.allowlist.map((allowlistEntry) =>
      this.buildRouteEntry({
        allowlistEntry,
        activation: findActivationForAllowlist(allowlistEntry, activations),
        registry,
      }));
    const decisions = (input.routeProbes || []).map((probe, index) =>
      this.buildRouteDecision({
        probe,
        routes,
        index,
      }));
    const summary = summarize(routes, decisions);
    const recommendation = buildRecommendation(summary);

    return {
      contractVersion: AI_FIRST_LIMITED_CANARY_SWITCHBOARD_CONTRACT_VERSION,
      source: 'ai-first-limited-canary-switchboard',
      generatedAt: this.now().toISOString(),
      switchboardId: this.idFactory('switchboard'),
      input: {
        switchboardName: safeText(input.switchboardName || 'ai-first-limited-canary-switchboard'),
        registryId: registry.registryId,
        registryReadiness: registry.recommendation.readiness,
        activationCount: activations.length,
        probeCount: (input.routeProbes || []).length,
      },
      activations,
      routes,
      decisions,
      summary,
      recommendation,
      receipts: [
        {
          id: this.idFactory('receipt'),
          kind: 'switchboard',
          detail: `${routes.length} route(s) loaded from promotion registry ${registry.registryId}.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'activation',
          detail: `${summary.canaryEnabledRoutes} route(s) enabled by explicit manual canary activation.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'decision',
          detail: `${decisions.length} route probe decision(s) recorded.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'fallback',
          detail: 'Every route decision preserves instant fallback to the current runtime.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'no-runtime-change',
          detail: 'Switchboard does not change the default runtime route.',
        },
      ],
      gates: [
        {
          id: 'phase-6-manual-activation-only',
          status: 'passed',
          detail: 'Canary routes require explicit manual activation.',
        },
        {
          id: 'phase-6-fallback-preserved',
          status: 'passed',
          detail: 'Every decision keeps fallbackRoute=current-runtime.',
        },
        {
          id: 'phase-6-guardrails-required',
          status: 'passed',
          detail: 'Canary selection requires Phase 3 guardrail and registry receipt.',
        },
        {
          id: 'phase-6-current-runtime-preserved',
          status: 'passed',
          detail: 'defaultRuntimeChanged is false and keepCurrentRuntimeDecision is true.',
        },
      ],
    };
  }

  public renderMarkdown(snapshot: AiFirstLimitedCanarySwitchboardSnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth AI-first Router Phase 6');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- switchboardId: ${snapshot.switchboardId}`);
    lines.push(`- registryId: ${snapshot.input.registryId}`);
    lines.push(`- readiness: ${snapshot.recommendation.readiness}`);
    lines.push(`- action: ${snapshot.recommendation.action}`);
    lines.push(`- canaryEnabledRoutes: ${snapshot.summary.canaryEnabledRoutes}`);
    lines.push(`- aiFirstCanarySelections: ${snapshot.summary.aiFirstCanarySelections}`);
    lines.push(`- fallbackSelections: ${snapshot.summary.fallbackSelections}`);
    lines.push(`- activateAutomatically: ${String(snapshot.recommendation.activateAutomatically)}`);
    lines.push(`- defaultRuntimeChanged: ${String(snapshot.recommendation.defaultRuntimeChanged)}`);
    lines.push('');
    lines.push('## Routes');
    for (const route of snapshot.routes) {
      lines.push(`- ${route.routeKey}: ${route.status} / surfaces=${route.enabledSurfaces.join(', ') || 'none'} - ${route.reason}`);
    }
    lines.push('');
    lines.push('## Decisions');
    if (snapshot.decisions.length === 0) {
      lines.push('- none');
    } else {
      for (const decision of snapshot.decisions) {
        lines.push(`- ${decision.requestId}: ${decision.decision} / fallback=${decision.fallbackReason || 'none'} - ${decision.reason}`);
      }
    }
    return lines.join('\n');
  }

  private normalizeActivation(
    activation: AiFirstLimitedCanaryActivationInput,
    index: number,
  ): AiFirstLimitedCanaryActivation {
    return {
      activationId: safeId(activation.activationId || `activation-${index + 1}`),
      routeKey: nullableText(activation.routeKey),
      familyId: activation.familyId || null,
      surfaces: uniqueStrings(activation.surfaces || []),
      enabled: activation.enabled === true,
      approvedBy: nullableText(activation.approvedBy),
      reason: safeText(activation.reason || 'Manual canary activation request.'),
    };
  }

  private buildRouteEntry(input: {
    allowlistEntry: AiFirstPromotionAllowlistEntry;
    activation: AiFirstLimitedCanaryActivation | null;
    registry: AiFirstPromotionCandidateRegistrySnapshot;
  }): AiFirstLimitedCanaryRouteEntry {
    const allowlist = input.allowlistEntry;
    const activation = input.activation;
    const activationValid = Boolean(
      activation
      && activation.enabled
      && activation.approvedBy
      && input.registry.recommendation.readiness === 'ready-for-manual-canary',
    );
    const enabledSurfaces = activationValid
      ? intersectSurfaces(activation?.surfaces || [], allowlist.surfaces)
      : [];
    const status = resolveRouteStatus({
      allowlist,
      activation,
      activationValid,
      enabledSurfaces,
      registry: input.registry,
    });
    return {
      id: this.idFactory('route'),
      routeKey: allowlist.routeKey,
      familyId: allowlist.familyId,
      status,
      sourceAllowlistStatus: allowlist.status,
      configuredSurfaces: [...allowlist.surfaces],
      enabledSurfaces,
      allowedRiskLevels: [...allowlist.allowedRiskLevels],
      maxRisk: allowlist.maxRisk,
      activationId: activationValid ? activation?.activationId || null : null,
      fallbackRoute: 'current-runtime',
      requiresPhase3Guardrail: true,
      requiresRegistryReceipt: true,
      requiresManualActivation: true,
      defaultEnabled: false,
      canExecuteNow: false,
      reason: routeReason({
        allowlist,
        activation,
        activationValid,
        enabledSurfaces,
        registry: input.registry,
        status,
      }),
    };
  }

  private buildRouteDecision(input: {
    probe: AiFirstLimitedCanaryRouteProbe;
    routes: AiFirstLimitedCanaryRouteEntry[];
    index: number;
  }): AiFirstLimitedCanaryRouteDecision {
    const probe = input.probe;
    const route = input.routes.find((entry) => entry.familyId === probe.familyId);
    const fallbackReason = resolveFallbackReason(probe, route);
    const decision: AiFirstLimitedCanaryDecisionStatus = fallbackReason
      ? 'fallback-current-runtime'
      : 'select-ai-first-canary';
    return {
      id: this.idFactory('decision'),
      requestId: safeId(probe.requestId || `probe-${input.index + 1}`),
      familyId: probe.familyId,
      surface: safeText(probe.surface || 'unknown'),
      risk: probe.risk,
      decision,
      matchedRouteKey: route?.routeKey || null,
      fallbackReason,
      fallbackRoute: 'current-runtime',
      phase3GuardrailRequired: true,
      registryReceiptRequired: true,
      fallbackAvailable: true,
      defaultRuntimeChanged: false,
      canExecuteNow: false,
      reason: decision === 'select-ai-first-canary'
        ? 'Manual canary route matched, with required guardrail and registry receipt present.'
        : `Fallback to current runtime: ${fallbackReason || 'unknown'}.`,
    };
  }
}

function findActivationForAllowlist(
  allowlist: AiFirstPromotionAllowlistEntry,
  activations: AiFirstLimitedCanaryActivation[],
): AiFirstLimitedCanaryActivation | null {
  return activations.find((activation) =>
    activation.routeKey === allowlist.routeKey || activation.familyId === allowlist.familyId) || null;
}

function resolveRouteStatus(input: {
  allowlist: AiFirstPromotionAllowlistEntry;
  activation: AiFirstLimitedCanaryActivation | null;
  activationValid: boolean;
  enabledSurfaces: string[];
  registry: AiFirstPromotionCandidateRegistrySnapshot;
}): AiFirstLimitedCanaryRouteStatus {
  if (input.allowlist.status !== 'proposed') {
    return 'withheld';
  }
  if (input.registry.recommendation.readiness !== 'ready-for-manual-canary') {
    return 'disabled';
  }
  if (!input.activation) {
    return 'manual-activation-required';
  }
  if (!input.activation.enabled) {
    return 'disabled';
  }
  if (!input.activationValid || input.enabledSurfaces.length === 0) {
    return 'disabled';
  }
  return 'canary-enabled';
}

function routeReason(input: {
  allowlist: AiFirstPromotionAllowlistEntry;
  activation: AiFirstLimitedCanaryActivation | null;
  activationValid: boolean;
  enabledSurfaces: string[];
  registry: AiFirstPromotionCandidateRegistrySnapshot;
  status: AiFirstLimitedCanaryRouteStatus;
}): string {
  if (input.allowlist.status !== 'proposed') {
    return 'Allowlist entry was withheld by the promotion registry.';
  }
  if (input.registry.recommendation.readiness !== 'ready-for-manual-canary') {
    return 'Registry is not ready for manual canary activation.';
  }
  if (!input.activation) {
    return 'Manual activation is required before canary routing.';
  }
  if (!input.activation.enabled) {
    return 'Manual activation explicitly disabled this route.';
  }
  if (!input.activation.approvedBy) {
    return 'Manual activation is missing an approver.';
  }
  if (input.enabledSurfaces.length === 0) {
    return 'Manual activation did not match any allowlisted surface.';
  }
  if (input.status === 'canary-enabled') {
    return 'Route is enabled for limited canary with instant fallback.';
  }
  return 'Route remains disabled.';
}

function resolveFallbackReason(
  probe: AiFirstLimitedCanaryRouteProbe,
  route: AiFirstLimitedCanaryRouteEntry | undefined,
): AiFirstLimitedCanaryFallbackReason | null {
  if (!route) {
    return 'route-not-enabled';
  }
  if (route.sourceAllowlistStatus !== 'proposed') {
    return 'allowlist-withheld';
  }
  if (route.status === 'manual-activation-required') {
    return 'manual-activation-missing';
  }
  if (route.status === 'disabled') {
    return 'manual-activation-disabled';
  }
  if (route.status !== 'canary-enabled') {
    return 'route-not-enabled';
  }
  if (!route.enabledSurfaces.includes(probe.surface)) {
    return 'surface-not-enabled';
  }
  if (!route.allowedRiskLevels.includes(probe.risk) || RISK_RANK[probe.risk] > RISK_RANK[route.maxRisk]) {
    return 'risk-not-allowed';
  }
  if (!probe.phase3GuardrailPassed) {
    return 'phase3-guardrail-missing';
  }
  if (!probe.registryReceiptPresent) {
    return 'registry-receipt-missing';
  }
  return null;
}

function summarize(
  routes: AiFirstLimitedCanaryRouteEntry[],
  decisions: AiFirstLimitedCanaryRouteDecision[],
): AiFirstLimitedCanarySwitchboardSnapshot['summary'] {
  return {
    totalRoutes: routes.length,
    canaryEnabledRoutes: routes.filter((route) => route.status === 'canary-enabled').length,
    manualActivationRequiredRoutes: routes.filter((route) => route.status === 'manual-activation-required').length,
    withheldRoutes: routes.filter((route) => route.status === 'withheld').length,
    disabledRoutes: routes.filter((route) => route.status === 'disabled').length,
    aiFirstCanarySelections: decisions.filter((decision) => decision.decision === 'select-ai-first-canary').length,
    fallbackSelections: decisions.filter((decision) => decision.decision === 'fallback-current-runtime').length,
  };
}

function buildRecommendation(
  summary: AiFirstLimitedCanarySwitchboardSnapshot['summary'],
): AiFirstLimitedCanarySwitchboardSnapshot['recommendation'] {
  const readiness = summary.canaryEnabledRoutes > 0
    ? 'canary-ready'
    : summary.manualActivationRequiredRoutes > 0
      ? 'manual-activation-needed'
      : 'no-eligible-routes';
  const action = readiness === 'canary-ready'
    ? 'run-limited-canary'
    : readiness === 'manual-activation-needed'
      ? 'request-manual-activation'
      : 'continue-registry';
  return {
    readiness,
    action,
    reason: recommendationReason(readiness),
    defaultRuntimeChanged: false,
    keepCurrentRuntimeDecision: true,
    fallbackInstantlyAvailable: true,
    activateAutomatically: false,
    canExecuteNow: false,
  };
}

function recommendationReason(readiness: AiFirstLimitedCanarySwitchboardSnapshot['recommendation']['readiness']): string {
  if (readiness === 'canary-ready') {
    return 'At least one route is manually enabled for limited canary with fallback.';
  }
  if (readiness === 'manual-activation-needed') {
    return 'Eligible route proposals exist, but manual activation is still required.';
  }
  return 'No route is eligible for limited canary from this registry.';
}

function intersectSurfaces(requested: string[], allowed: string[]): string[] {
  const requestedSet = new Set((requested.length > 0 ? requested : allowed).map((surface) => surface.toLowerCase()));
  return allowed.filter((surface) => requestedSet.has(surface.toLowerCase()));
}

function safeText(value: unknown): string {
  const text = String(value || '').trim();
  return redactSensitiveText(text || 'unknown');
}

function nullableText(value: unknown): string | null {
  const text = String(value || '').trim();
  return text ? redactSensitiveText(text) : null;
}

function safeId(value: unknown): string {
  const text = safeText(value).toLowerCase();
  const id = text.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return id || 'id';
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = safeText(value);
    const key = normalized.toLowerCase();
    if (key === 'unknown' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}
