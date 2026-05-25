import type {
  AccessRouteCatalogEntry,
  ModelPickerContract,
  ModelPickerReadiness,
} from '../../contracts/ModelPickerContract.js';
import {
  queryUniversalAgentRuns,
  type UniversalAgentRunObservatoryReceipt,
} from './RunObservatory.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const PROVIDER_ARENA_CONTRACT_VERSION = '2026-05-03.provider-arena' as const;

export type ProviderArenaDecisionSource =
  | 'configured'
  | 'profile'
  | 'learned'
  | 'observed'
  | 'unknown';

export type ProviderArenaCandidateSource =
  | ProviderArenaDecisionSource
  | 'fallback'
  | 'catalog';

export type ProviderArenaHealthStatus =
  | 'healthy'
  | 'unhealthy'
  | 'unknown'
  | 'not_applicable';

export type ProviderArenaCandidate = {
  id: string;
  routeId: string;
  providerId: string;
  providerLabel: string;
  modelLabel: string;
  familyId: string;
  routeKind: string;
  readiness: ModelPickerReadiness | 'unknown';
  ready: boolean;
  healthStatus: ProviderArenaHealthStatus;
  capabilityScore: number;
  costScore: number;
  latencyScore: number;
  reliabilityScore: number;
  healthScore: number;
  overallScore: number;
  source: ProviderArenaCandidateSource;
  explanation: string[];
  fallbackRouteIds: string[];
  receipts: string[];
};

export type ProviderArenaReceipt = {
  id: string;
  kind: 'run-observatory' | 'route' | 'budget' | 'model-picker' | 'policy';
  source: string;
  detail: string;
  status: 'pending' | 'done' | 'failed';
  observatoryReceiptId?: string;
};

export type ProviderArenaSnapshot = {
  contractVersion: typeof PROVIDER_ARENA_CONTRACT_VERSION;
  source: 'ProviderArenaService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  summary: {
    candidateCount: number;
    readyCandidateCount: number;
    fallbackUsed: boolean;
    routeObserved: boolean;
    budgetObserved: boolean;
    observatoryReceiptCount: number;
    hasProviderEvidence: boolean;
    recommendedProviderLabel: string;
    recommendedModelLabel: string;
    recommendedFamilyId: string;
    decisionSource: ProviderArenaDecisionSource;
  };
  selected: {
    candidateId: string | null;
    providerLabel: string;
    modelLabel: string;
    routeId: string | null;
    source: ProviderArenaDecisionSource;
    explanation: string[];
  };
  candidates: ProviderArenaCandidate[];
  comparison: {
    recommendedCandidateId: string | null;
    configuredCandidateId: string | null;
    learnedCandidateId: string | null;
    fallbackCandidateIds: string[];
    decisionSource: ProviderArenaDecisionSource;
    explanation: string[];
  };
  receipts: ProviderArenaReceipt[];
  policy: {
    noProviderExecutionPerformed: true;
    usesRunObservatoryReceipts: boolean;
    comparesConfiguredAndObservedRoute: boolean;
    doesNotOverrideModelPicker: true;
    fallbackVisible: boolean;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    dashboardPath: string;
    arenaHint: string;
  };
  nextSafeAction: string;
};

export type ProviderArenaInput = {
  run: UniversalAgentRun;
  modelPickerContract?: ModelPickerContract | null;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = ''): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function listOrEmpty(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return Number(value.toFixed(2));
}

function averageScore(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return clampScore(values.reduce((total, value) => total + value, 0) / values.length);
}

function normalizeReadiness(value: unknown, ready?: boolean): ProviderArenaCandidate['readiness'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'ready' || raw === 'needs_config' || raw === 'needs_probe') {
    return raw;
  }
  return ready === true ? 'ready' : 'unknown';
}

function normalizeHealthStatus(value: unknown): ProviderArenaHealthStatus {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'healthy' || raw === 'unhealthy' || raw === 'unknown' || raw === 'not_applicable') {
    return raw;
  }
  if (raw === 'succeeded' || raw === 'success' || raw === 'ready') {
    return 'healthy';
  }
  if (raw === 'failed' || raw === 'skipped_unavailable' || raw === 'blocked') {
    return 'unhealthy';
  }
  return 'unknown';
}

function scoreHealth(status: ProviderArenaHealthStatus, ready: boolean): number {
  if (status === 'healthy') {
    return 1;
  }
  if (status === 'not_applicable') {
    return ready ? 0.7 : 0.45;
  }
  if (status === 'unhealthy') {
    return 0.15;
  }
  return ready ? 0.7 : 0.45;
}

function scoreCost(budget: LooseRecord | null): number {
  if (!budget) {
    return 0.55;
  }
  const estimated = numberOrNull(budget.estimatedCostUnits);
  const max = numberOrNull(budget.maxEstimatedCostUnits);
  if (estimated !== null && max !== null && max > 0) {
    return clampScore(1 - (estimated / max));
  }
  return budget.degraded === true ? 0.25 : 0.68;
}

function scoreLatencyFromAttempt(attempt: LooseRecord | null): number {
  if (!attempt) {
    return 0.5;
  }
  const durationMs = numberOrNull(attempt.durationMs ?? attempt.latencyMs ?? attempt.elapsedMs);
  if (durationMs === null) {
    return 0.5;
  }
  if (durationMs <= 800) {
    return 1;
  }
  if (durationMs >= 12000) {
    return 0.12;
  }
  return clampScore(1 - ((durationMs - 800) / 11200));
}

function scoreCapability(entry: {
  ready: boolean;
  capabilities?: unknown;
  supportsTools?: boolean;
  supportsVision?: boolean;
  source?: ProviderArenaCandidateSource;
}): number {
  const capabilities = listOrEmpty(entry.capabilities);
  const bonus = Math.min(capabilities.length * 0.04, 0.22)
    + (entry.supportsTools ? 0.08 : 0)
    + (entry.supportsVision ? 0.05 : 0);
  const base = entry.ready ? 0.62 : 0.38;
  return clampScore(base + bonus + (entry.source === 'learned' || entry.source === 'observed' ? 0.05 : 0));
}

function routeReceiptFromMetadata(metadata: LooseRecord): LooseRecord | null {
  return recordOrNull(metadata.llmRuntimeRoute)
    || recordOrNull(metadata.llmRoute)
    || recordOrNull(metadata.providerRoute)
    || recordOrNull(metadata.route);
}

function correlationFromMetadata(metadata: LooseRecord): LooseRecord | null {
  return recordOrNull(metadata.providerRouteBudgetCorrelation);
}

function selectionFromMetadata(metadata: LooseRecord, correlation: LooseRecord | null): LooseRecord | null {
  return recordOrNull(metadata.modelPickerSelection)
    || recordOrNull(correlation?.modelPicker);
}

function budgetFromMetadata(metadata: LooseRecord, correlation: LooseRecord | null): LooseRecord | null {
  return recordOrNull(metadata.runBudget)
    || recordOrNull(correlation?.budget);
}

function attemptsFromRoute(route: LooseRecord | null): LooseRecord[] {
  return Array.isArray(route?.attempts)
    ? route.attempts.map(recordOrNull).filter((entry): entry is LooseRecord => Boolean(entry))
    : [];
}

function findAttemptForProvider(route: LooseRecord | null, providerId: string): LooseRecord | null {
  const normalized = normalizeKey(providerId);
  return attemptsFromRoute(route).find((attempt) => normalizeKey(attempt.providerName) === normalized) || null;
}

function healthFromRoute(route: LooseRecord | null, providerId: string, fallbackHealth?: unknown): ProviderArenaHealthStatus {
  const attempt = findAttemptForProvider(route, providerId);
  if (attempt) {
    return normalizeHealthStatus(attempt.status);
  }
  return normalizeHealthStatus(fallbackHealth);
}

function scoreReliability(input: {
  route: LooseRecord | null;
  providerId: string;
  ready: boolean;
  fallbackUsed: boolean;
  healthStatus: ProviderArenaHealthStatus;
}): number {
  const attempt = findAttemptForProvider(input.route, input.providerId);
  const status = normalizeText(attempt?.status).toLowerCase();
  if (status === 'succeeded') {
    return input.fallbackUsed ? 0.78 : 1;
  }
  if (status === 'failed') {
    return 0.22;
  }
  if (status === 'skipped_unavailable') {
    return 0.12;
  }
  if (input.healthStatus === 'healthy') {
    return 0.82;
  }
  if (input.healthStatus === 'unhealthy') {
    return 0.18;
  }
  return input.ready ? 0.68 : 0.42;
}

function scoreOverall(candidate: Omit<ProviderArenaCandidate, 'overallScore'>): number {
  return clampScore(
    (candidate.capabilityScore * 0.24)
    + (candidate.costScore * 0.18)
    + (candidate.latencyScore * 0.16)
    + (candidate.reliabilityScore * 0.26)
    + (candidate.healthScore * 0.16),
  );
}

function createCandidate(input: Omit<ProviderArenaCandidate, 'overallScore'>): ProviderArenaCandidate {
  return {
    ...input,
    capabilityScore: clampScore(input.capabilityScore),
    costScore: clampScore(input.costScore),
    latencyScore: clampScore(input.latencyScore),
    reliabilityScore: clampScore(input.reliabilityScore),
    healthScore: clampScore(input.healthScore),
    overallScore: scoreOverall(input),
  };
}

function addCandidate(map: Map<string, ProviderArenaCandidate>, candidate: ProviderArenaCandidate): void {
  const key = candidate.id;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, candidate);
    return;
  }
  map.set(key, {
    ...existing,
    ready: existing.ready || candidate.ready,
    healthStatus: existing.healthStatus === 'unknown' ? candidate.healthStatus : existing.healthStatus,
    capabilityScore: Math.max(existing.capabilityScore, candidate.capabilityScore),
    costScore: Math.max(existing.costScore, candidate.costScore),
    latencyScore: Math.max(existing.latencyScore, candidate.latencyScore),
    reliabilityScore: Math.max(existing.reliabilityScore, candidate.reliabilityScore),
    healthScore: Math.max(existing.healthScore, candidate.healthScore),
    overallScore: Math.max(existing.overallScore, candidate.overallScore),
    explanation: Array.from(new Set([...existing.explanation, ...candidate.explanation])),
    fallbackRouteIds: Array.from(new Set([...existing.fallbackRouteIds, ...candidate.fallbackRouteIds])),
    receipts: Array.from(new Set([...existing.receipts, ...candidate.receipts])),
  });
}

function selectedCandidateId(selection: LooseRecord | null, run: UniversalAgentRun, route: LooseRecord | null): string {
  return normalizeKey(
    selection?.routeId
      ?? run.modelProfile.routeId
      ?? route?.providerName
      ?? run.modelProfile.providerLabel,
    'current-provider',
  );
}

function routeProviderLabel(value: unknown, fallback = 'provider nao informado'): string {
  const raw = normalizeText(value, fallback);
  if (raw.length <= 3) {
    return raw.toUpperCase();
  }
  return raw;
}

function buildCurrentCandidate(input: {
  run: UniversalAgentRun;
  selection: LooseRecord | null;
  correlation: LooseRecord | null;
  route: LooseRecord | null;
  budget: LooseRecord | null;
  observatoryReceiptIds: string[];
  decisionSource: ProviderArenaDecisionSource;
}): ProviderArenaCandidate {
  const id = selectedCandidateId(input.selection, input.run, input.route);
  const providerId = normalizeKey(
    input.selection?.providerId
      ?? input.selection?.providerName
      ?? input.route?.providerName
      ?? input.correlation?.providerName
      ?? input.run.modelProfile.providerLabel,
    id,
  );
  const ready = typeof input.selection?.ready === 'boolean'
    ? input.selection.ready as boolean
    : typeof input.run.modelProfile.ready === 'boolean'
      ? input.run.modelProfile.ready
      : Boolean(input.route?.providerName || input.correlation?.providerName);
  const healthStatus = healthFromRoute(input.route, providerId, input.selection?.healthStatus);
  const fallbackUsed = input.route?.fallbackUsed === true || input.correlation?.fallbackUsed === true;
  const attempt = findAttemptForProvider(input.route, providerId);
  const source = input.decisionSource === 'learned' ? 'learned' : input.decisionSource;
  const candidateWithoutOverall = {
    id,
    routeId: id,
    providerId,
    providerLabel: normalizeText(
      input.selection?.providerLabel
        ?? input.selection?.providerName
        ?? input.route?.providerName
        ?? input.correlation?.providerName,
      input.run.modelProfile.providerLabel,
    ),
    modelLabel: normalizeText(
      input.selection?.modelLabel
        ?? input.selection?.modelName
        ?? input.route?.modelName
        ?? input.correlation?.modelName,
      input.run.modelProfile.modelLabel,
    ),
    familyId: normalizeKey(input.selection?.familyId ?? input.run.modelProfile.familyId, providerId),
    routeKind: normalizeText(input.selection?.routeKind ?? input.correlation?.routingPolicy ?? input.run.modelProfile.routingPolicy, 'unknown'),
    readiness: normalizeReadiness(input.selection?.readiness ?? input.run.modelProfile.readiness, ready),
    ready,
    healthStatus,
    capabilityScore: scoreCapability({
      ready,
      capabilities: input.selection?.capabilities,
      supportsTools: input.run.modelProfile.supportsTools,
      supportsVision: input.run.modelProfile.supportsVision,
      source,
    }),
    costScore: scoreCost(input.budget),
    latencyScore: scoreLatencyFromAttempt(attempt),
    reliabilityScore: scoreReliability({
      route: input.route,
      providerId,
      ready,
      fallbackUsed,
      healthStatus,
    }),
    healthScore: scoreHealth(healthStatus, ready),
    source,
    explanation: [
      input.selection ? 'Model Picker forneceu a selecao configurada.' : 'Perfil atual do run foi usado como baseline.',
      input.route ? 'LlmRuntimeService forneceu a rota observada.' : '',
      input.budget ? 'RunBudgetPolicy forneceu custo estimado.' : '',
      fallbackUsed ? 'Fallback foi usado ou permitido nesta rota.' : '',
    ].filter(Boolean),
    fallbackRouteIds: listOrEmpty(input.selection?.fallbackOrder ?? input.run.modelProfile.fallbackOrder),
    receipts: input.observatoryReceiptIds,
  } satisfies Omit<ProviderArenaCandidate, 'overallScore'>;
  return createCandidate(candidateWithoutOverall);
}

function buildFallbackCandidates(input: {
  route: LooseRecord | null;
  selection: LooseRecord | null;
  budget: LooseRecord | null;
  selectedId: string;
  observatoryReceiptIds: string[];
}): ProviderArenaCandidate[] {
  const routeChain = listOrEmpty(input.route?.providerChain);
  const fallbackOrder = listOrEmpty(input.selection?.fallbackOrder);
  const ids = Array.from(new Set([...routeChain, ...fallbackOrder]))
    .map((entry) => normalizeKey(entry))
    .filter((entry) => entry && entry !== input.selectedId);

  return ids.slice(0, 10).map((id) => {
    const attempt = findAttemptForProvider(input.route, id);
    const healthStatus = healthFromRoute(input.route, id);
    const ready = normalizeText(attempt?.status).toLowerCase() === 'succeeded';
    const candidateWithoutOverall = {
      id,
      routeId: id,
      providerId: id,
      providerLabel: routeProviderLabel(attempt?.providerName, id),
      modelLabel: normalizeText(attempt?.modelName, normalizeText(input.selection?.modelLabel, 'modelo nao informado')),
      familyId: id,
      routeKind: 'fallback',
      readiness: ready ? 'ready' : 'needs_probe',
      ready,
      healthStatus,
      capabilityScore: scoreCapability({ ready, source: 'fallback' }),
      costScore: scoreCost(input.budget),
      latencyScore: scoreLatencyFromAttempt(attempt),
      reliabilityScore: scoreReliability({
        route: input.route,
        providerId: id,
        ready,
        fallbackUsed: true,
        healthStatus,
      }),
      healthScore: scoreHealth(healthStatus, ready),
      source: 'fallback' as const,
      explanation: [
        'Rota aparece na ordem de fallback.',
        attempt ? `Status observado: ${normalizeText(attempt.status, 'unknown')}.` : 'Ainda sem tentativa observada neste run.',
      ],
      fallbackRouteIds: [],
      receipts: input.observatoryReceiptIds,
    } satisfies Omit<ProviderArenaCandidate, 'overallScore'>;
    return createCandidate(candidateWithoutOverall);
  });
}

function buildCatalogCandidate(route: AccessRouteCatalogEntry, budget: LooseRecord | null): ProviderArenaCandidate {
  const healthStatus = normalizeHealthStatus(route.health?.status);
  const ready = route.ready === true;
  const candidateWithoutOverall = {
    id: normalizeKey(route.id, route.providerId),
    routeId: route.id,
    providerId: route.providerId,
    providerLabel: route.providerName,
    modelLabel: normalizeText(route.currentModelName, route.label),
    familyId: route.familyIds[0] || route.providerId,
    routeKind: route.routeKind,
    readiness: normalizeReadiness(route.readiness, ready),
    ready,
    healthStatus,
    capabilityScore: scoreCapability({
      ready,
      capabilities: route.capabilities,
      supportsTools: route.capabilities.includes('tool_use'),
      supportsVision: route.capabilities.includes('vision'),
      source: 'catalog',
    }),
    costScore: scoreCost(budget),
    latencyScore: 0.5,
    reliabilityScore: healthStatus === 'healthy' ? 0.82 : ready ? 0.68 : 0.42,
    healthScore: scoreHealth(healthStatus, ready),
    source: 'catalog' as const,
    explanation: [
      'Provider Mesh catalogou esta rota.',
      route.issue ? `Issue: ${route.issue}` : '',
      route.health?.message ? `Health: ${route.health.message}` : '',
    ].filter(Boolean),
    fallbackRouteIds: route.fallbackRouteIds,
    receipts: [],
  } satisfies Omit<ProviderArenaCandidate, 'overallScore'>;
  return createCandidate(candidateWithoutOverall);
}

function buildObservatoryReceipts(receipts: UniversalAgentRunObservatoryReceipt[]): ProviderArenaReceipt[] {
  return receipts
    .filter((receipt) => receipt.kind === 'model-route' || receipt.kind === 'budget')
    .slice(0, 8)
    .map((receipt) => ({
      id: `provider-arena:${receipt.id}`,
      kind: 'run-observatory' as const,
      source: receipt.source,
      detail: receipt.detail || receipt.title,
      status: receipt.status === 'failed' ? 'failed' : receipt.status === 'pending' ? 'pending' : 'done',
      observatoryReceiptId: receipt.id,
    }));
}

function buildReceipts(input: {
  run: UniversalAgentRun;
  observatory: ProviderArenaReceipt[];
  selection: LooseRecord | null;
  route: LooseRecord | null;
  budget: LooseRecord | null;
}): ProviderArenaReceipt[] {
  const receipts = [...input.observatory];
  if (input.route) {
    receipts.push({
      id: `provider-arena:${input.run.id}:route`,
      kind: 'route',
      source: normalizeText(input.route.source, 'LlmRuntimeService'),
      detail: `Rota efetiva: ${normalizeText(input.route.providerName, 'provider nao informado')}/${normalizeText(input.route.modelName, 'modelo nao informado')}.`,
      status: input.route.fallbackUsed === true ? 'pending' : 'done',
    });
  }
  if (input.budget) {
    receipts.push({
      id: `provider-arena:${input.run.id}:budget`,
      kind: 'budget',
      source: normalizeText(input.budget.source, 'RunBudgetPolicy'),
      detail: `Custo estimado: ${normalizeText(input.budget.estimatedCostUnits, '?')}/${normalizeText(input.budget.maxEstimatedCostUnits, '?')} unidades.`,
      status: input.budget.degraded === true ? 'failed' : 'done',
    });
  }
  if (input.selection) {
    receipts.push({
      id: `provider-arena:${input.run.id}:model-picker`,
      kind: 'model-picker',
      source: 'ModelPickerContract',
      detail: `Selecao ${normalizeText(input.selection.source, 'configured')}: ${normalizeText(input.selection.providerLabel ?? input.selection.providerName, 'provider')}/${normalizeText(input.selection.modelLabel ?? input.selection.modelName, 'modelo')}.`,
      status: input.selection.ready === false ? 'pending' : 'done',
    });
  }
  receipts.push({
    id: `provider-arena:${input.run.id}:policy`,
    kind: 'policy',
    source: 'ProviderArenaService',
    detail: 'Arena compara providers de forma read-only; nenhuma chamada de provider e nenhum secret sao serializados.',
    status: 'done',
  });
  return receipts;
}

function resolveDecisionSource(input: {
  selection: LooseRecord | null;
  route: LooseRecord | null;
  observatoryRouteReceiptCount: number;
}): ProviderArenaDecisionSource {
  if (input.route || input.observatoryRouteReceiptCount > 0) {
    return 'learned';
  }
  const source = normalizeText(input.selection?.source).toLowerCase();
  if (source === 'profile-selection') {
    return 'profile';
  }
  if (input.selection) {
    return 'configured';
  }
  return 'unknown';
}

function buildNextSafeAction(input: {
  recommended: ProviderArenaCandidate | null;
  selected: ProviderArenaCandidate | null;
  route: LooseRecord | null;
  budget: LooseRecord | null;
}): string {
  if (!input.recommended) {
    return 'Conectar Model Picker ou executar uma rota LLM para gerar evidencias da arena.';
  }
  if (input.budget?.degraded === true) {
    return 'Revisar budget antes de promover a rota recomendada.';
  }
  if (input.route?.fallbackUsed === true) {
    return 'Investigar provider primario e manter fallback visivel antes de fixar a rota.';
  }
  if (input.recommended.id !== input.selected?.id) {
    return `Comparar ${input.selected?.providerLabel || 'rota atual'} com ${input.recommended.providerLabel} antes de trocar a selecao.`;
  }
  return 'Manter a rota atual e continuar coletando receipts de custo, health e fallback.';
}

export class ProviderArenaService {
  private readonly now: () => Date;

  constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ProviderArenaInput): ProviderArenaSnapshot {
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const metadata = input.run.metadata || {};
    const correlation = correlationFromMetadata(metadata);
    const route = routeReceiptFromMetadata(metadata);
    const selection = selectionFromMetadata(metadata, correlation);
    const budget = budgetFromMetadata(metadata, correlation);
    const observatory = queryUniversalAgentRuns({
      runs: [input.run],
      query: {
        runId: input.run.id,
        limit: 1,
      },
      generatedAt,
    });
    const observatoryArenaReceipts = buildObservatoryReceipts(observatory.receipts);
    const observatoryReceiptIds = observatoryArenaReceipts
      .map((receipt) => receipt.observatoryReceiptId)
      .filter((id): id is string => Boolean(id));
    const decisionSource = resolveDecisionSource({
      selection,
      route,
      observatoryRouteReceiptCount: observatory.receipts.filter((receipt) => receipt.kind === 'model-route').length,
    });

    const candidates = new Map<string, ProviderArenaCandidate>();
    const currentCandidate = buildCurrentCandidate({
      run: input.run,
      selection,
      correlation,
      route,
      budget,
      observatoryReceiptIds,
      decisionSource,
    });
    addCandidate(candidates, currentCandidate);
    for (const candidate of buildFallbackCandidates({
      route,
      selection,
      budget,
      selectedId: currentCandidate.id,
      observatoryReceiptIds,
    })) {
      addCandidate(candidates, candidate);
    }
    for (const routeEntry of input.modelPickerContract?.routes.routes || []) {
      addCandidate(candidates, buildCatalogCandidate(routeEntry, budget));
    }

    const sortedCandidates = Array.from(candidates.values())
      .sort((a, b) => b.overallScore - a.overallScore || a.id.localeCompare(b.id))
      .slice(0, 16);
    const recommended = sortedCandidates[0] || null;
    const fallbackCandidateIds = sortedCandidates
      .filter((candidate) => candidate.source === 'fallback' || currentCandidate.fallbackRouteIds.includes(candidate.routeId))
      .map((candidate) => candidate.id);
    const receipts = buildReceipts({
      run: input.run,
      observatory: observatoryArenaReceipts,
      selection,
      route,
      budget,
    });
    const hasProviderEvidence = Boolean(
      selection
      || route
      || correlation
      || budget
      || input.modelPickerContract
      || observatoryArenaReceipts.length > 0,
    );

    return {
      contractVersion: PROVIDER_ARENA_CONTRACT_VERSION,
      source: 'ProviderArenaService',
      generatedAt,
      identifiers: {
        runId: input.run.id,
        traceId: input.run.traceId,
        requestId: input.run.requestId,
        sessionId: input.run.sessionId,
      },
      summary: {
        candidateCount: sortedCandidates.length,
        readyCandidateCount: sortedCandidates.filter((candidate) => candidate.ready).length,
        fallbackUsed: route?.fallbackUsed === true || correlation?.fallbackUsed === true,
        routeObserved: Boolean(route || correlation),
        budgetObserved: Boolean(budget),
        observatoryReceiptCount: observatoryArenaReceipts.length,
        hasProviderEvidence,
        recommendedProviderLabel: recommended?.providerLabel || 'provider nao informado',
        recommendedModelLabel: recommended?.modelLabel || 'modelo nao informado',
        recommendedFamilyId: recommended?.familyId || 'unknown',
        decisionSource,
      },
      selected: {
        candidateId: currentCandidate.id,
        providerLabel: currentCandidate.providerLabel,
        modelLabel: currentCandidate.modelLabel,
        routeId: currentCandidate.routeId,
        source: decisionSource,
        explanation: currentCandidate.explanation,
      },
      candidates: sortedCandidates,
      comparison: {
        recommendedCandidateId: recommended?.id || null,
        configuredCandidateId: currentCandidate.id,
        learnedCandidateId: route || observatoryArenaReceipts.length > 0 ? currentCandidate.id : null,
        fallbackCandidateIds,
        decisionSource,
        explanation: [
          `Fonte da decisao: ${decisionSource}.`,
          route ? 'Rota observada correlacionada com budget.' : 'Sem rota LLM observada neste snapshot.',
          input.modelPickerContract ? 'Provider Mesh disponivel para comparar rotas catalogadas.' : 'Provider Mesh completo nao foi fornecido a esta chamada.',
          recommended ? `Recomendacao atual: ${recommended.providerLabel}/${recommended.modelLabel} (${recommended.overallScore}).` : '',
        ].filter(Boolean),
      },
      receipts,
      policy: {
        noProviderExecutionPerformed: true,
        usesRunObservatoryReceipts: observatoryArenaReceipts.length > 0,
        comparesConfiguredAndObservedRoute: Boolean(selection && (route || correlation)),
        doesNotOverrideModelPicker: true,
        fallbackVisible: fallbackCandidateIds.length > 0 || route?.fallbackAllowed === true || correlation?.fallbackAllowed === true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth arena run ${input.run.id} --json`,
        dashboardPath: '/dashboard?sector=config',
        arenaHint: 'Use a arena para comparar rota configurada, rota observada, fallback, budget e health antes de trocar provider.',
      },
      nextSafeAction: buildNextSafeAction({
        recommended,
        selected: currentCandidate,
        route,
        budget,
      }),
    };
  }
}
