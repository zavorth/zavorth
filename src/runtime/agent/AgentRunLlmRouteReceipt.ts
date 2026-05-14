import type { LlmRuntimeRouteReceipt } from '../../services/llm/LlmRuntimeService.js';
import type {
  UniversalAgentModelProfile,
  UniversalAgentRun,
} from './UniversalAgentRuntimeTypes.js';

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function resolveLlmRuntimeRouteReceipt(metadata: Record<string, unknown>): LlmRuntimeRouteReceipt | null {
  const candidates = [
    metadata.llmRuntimeRoute,
    metadata.llmRoute,
    metadata.providerRoute,
    metadata.route,
  ];
  for (const candidate of candidates) {
    const record = recordOrNull(candidate);
    if (
      record
      && record.source === 'LlmRuntimeService'
      && normalizeText(record.providerName)
    ) {
      return record as unknown as LlmRuntimeRouteReceipt;
    }
  }
  return null;
}

export function resolveRoutingPolicy(route: LlmRuntimeRouteReceipt): UniversalAgentModelProfile['routingPolicy'] {
  if (route.fallbackUsed) {
    return 'fallback';
  }
  return normalizeText(route.providerName).toLowerCase() === 'aigateway' ? 'gateway' : 'direct';
}

export function buildProviderRouteBudgetCorrelation(input: {
  route: LlmRuntimeRouteReceipt;
  runBudget: Record<string, unknown> | null;
  modelPickerSelection?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const modelPickerSelection = input.modelPickerSelection || null;
  return {
    source: 'AgentRunService',
    routeSource: input.route.source,
    providerName: input.route.providerName,
    modelName: input.route.modelName || null,
    primaryProviderName: input.route.primaryProviderName,
    requestedProviderName: input.route.requestedProviderName,
    routingPolicy: resolveRoutingPolicy(input.route),
    fallbackUsed: input.route.fallbackUsed,
    fallbackAllowed: input.route.fallbackAllowed,
    providerAttemptCount: Array.isArray(input.route.attempts) ? input.route.attempts.length : 0,
    unavailableProviderCount: Array.isArray(input.route.attempts)
      ? input.route.attempts.filter((attempt) => attempt.status === 'skipped_unavailable').length
      : 0,
    modelPicker: modelPickerSelection
      ? {
        source: modelPickerSelection.source || null,
        providerName: modelPickerSelection.providerName || null,
        providerLabel: modelPickerSelection.providerLabel || null,
        modelName: modelPickerSelection.modelName || null,
        modelLabel: modelPickerSelection.modelLabel || null,
        routeId: modelPickerSelection.routeId || null,
        readiness: modelPickerSelection.readiness || null,
        ready: modelPickerSelection.ready === true,
        fallbackOrder: Array.isArray(modelPickerSelection.fallbackOrder)
          ? [...modelPickerSelection.fallbackOrder]
          : [],
        explanation: Array.isArray(modelPickerSelection.explanation)
          ? [...modelPickerSelection.explanation]
          : [],
        matchedEffectiveProvider:
          normalizeText(modelPickerSelection.providerName).toLowerCase() === normalizeText(input.route.providerName).toLowerCase()
          || normalizeText(modelPickerSelection.routeId).toLowerCase() === normalizeText(input.route.providerName).toLowerCase(),
      }
      : null,
    request: input.route.request || null,
    budget: input.runBudget
      ? {
        source: input.runBudget.source || null,
        degraded: input.runBudget.degraded === true,
        reason: input.runBudget.reason || null,
        estimatedCostUnits: input.runBudget.estimatedCostUnits ?? null,
        maxEstimatedCostUnits: input.runBudget.maxEstimatedCostUnits ?? null,
        inputChars: input.runBudget.inputChars ?? null,
        requestedToolCount: input.runBudget.requestedToolCount ?? null,
        exposedToolCount: input.runBudget.exposedToolCount ?? null,
      }
      : null,
  };
}

export function applyAgentRunLlmRuntimeRouteReceipt(input: {
  run: UniversalAgentRun;
  mergedMetadata: Record<string, unknown>;
  now: string;
  idFactory: (prefix: string) => string;
}): void {
  const route = resolveLlmRuntimeRouteReceipt(input.mergedMetadata);
  if (!route) {
    return;
  }

  const routingPolicy = resolveRoutingPolicy(route);
  input.run.modelProfile = {
    ...input.run.modelProfile,
    providerLabel: normalizeText(route.providerName, input.run.modelProfile.providerLabel),
    modelLabel: normalizeText(route.modelName, input.run.modelProfile.modelLabel),
    routingPolicy,
    fallbackModelLabel: route.fallbackUsed
      ? normalizeText(route.modelName, input.run.modelProfile.fallbackModelLabel)
      : input.run.modelProfile.fallbackModelLabel,
  };

  const correlation = buildProviderRouteBudgetCorrelation({
    route,
    runBudget: recordOrNull(input.mergedMetadata.runBudget),
    modelPickerSelection: recordOrNull(input.mergedMetadata.modelPickerSelection),
  });
  input.mergedMetadata.llmRuntimeRoute = route;
  input.mergedMetadata.providerRouteBudgetCorrelation = correlation;
  input.run.events.push({
    id: input.idFactory('agent-event'),
    runId: input.run.id,
    kind: 'status',
    title: 'Rota LLM correlacionada',
    detail: `Provider ${route.providerName}${route.modelName ? `/${route.modelName}` : ''} correlacionado ao budget do run.`,
    status: 'done',
    createdAt: input.now,
    metadata: correlation,
  });
}
