import type {
  ZavorthAgentGatewayHandoffSnapshot,
  ZavorthAgentGatewayPlaneId,
} from '../contracts/ZavorthAgentGatewayHandoffContract.js';
import type {
  ZavorthAgentGatewaySnapshot,
  UniversalAgentRun,
} from '../runtime/agent/index.js';
import type {
  GatewayControlApiOperationDescriptor,
  ZavorthGatewayRuntimeSnapshot,
} from './ZavorthGatewayRuntimeService.js';

export type AIGatewayNativeConvergenceStatus = 'ready' | 'partial' | 'blocked';

export type AIGatewayNativeConvergenceItemId =
  | 'gateway-handoff-to-agent-gateway'
  | 'provider-plane-model-picker'
  | 'control-plane-real-snapshots'
  | 'proxy-sse-adapter-boundary'
  | 'budget-provider-health-correlation'
  | 'run-observatory-integration';

export type AIGatewayNativeConvergenceItem = {
  id: AIGatewayNativeConvergenceItemId;
  label: string;
  status: AIGatewayNativeConvergenceStatus;
  owner: 'ai-gateway' | 'agent-runtime' | 'shared';
  evidence: string[];
  blockers: string[];
};

export type AIGatewayDeforkCompatibilityBoundary = {
  id: string;
  status: 'adapter' | 'canonical';
  source: string;
  rule: string;
};

export type AIGatewayNativeConvergenceAcceptance = {
  aiGatewayNotIsland: boolean;
  externalCompatibilityContinues: boolean;
  internalContractsZavorthNative: boolean;
  legacyResidueNotCanonical: boolean;
  providerHealthCorrelatesWithRun: boolean;
  observabilityUsesRunObservatory: boolean;
};

export type AIGatewayNativeConvergenceSnapshot = {
  schemaVersion: 1;
  phase: 'C8';
  generatedAt: string;
  status: AIGatewayNativeConvergenceStatus;
  activeRunId: string | null;
  activeTraceId: string | null;
  handoffPhase: ZavorthAgentGatewayHandoffSnapshot['phase'] | null;
  items: AIGatewayNativeConvergenceItem[];
  acceptance: AIGatewayNativeConvergenceAcceptance;
  compatibilityBoundaries: AIGatewayDeforkCompatibilityBoundary[];
  externalCompatibility: {
    transports: Array<'http' | 'sse' | 'ws'>;
    routes: string[];
    operations: string[];
  };
  blockers: string[];
  explanation: string[];
};

export type AIGatewayNativeConvergenceInput = {
  runtimeSnapshot?: ZavorthGatewayRuntimeSnapshot | null;
  agentGatewaySnapshot?: ZavorthAgentGatewaySnapshot | null;
  handoffSnapshot?: ZavorthAgentGatewayHandoffSnapshot | null;
};

type AIGatewayNativeConvergenceRuntime = {
  now?: () => Date;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasRecord(value: unknown): boolean {
  return Boolean(recordOrNull(value));
}

export class AIGatewayNativeConvergenceService {
  private readonly now: () => Date;

  constructor(runtime: AIGatewayNativeConvergenceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: AIGatewayNativeConvergenceInput = {}): AIGatewayNativeConvergenceSnapshot {
    const activeRun = input.agentGatewaySnapshot?.activeRun || null;
    const items = [
      this.buildGatewayHandoffItem(input),
      this.buildProviderPlaneItem(input),
      this.buildControlPlaneItem(input),
      this.buildProxySseBoundaryItem(input),
      this.buildBudgetProviderHealthItem(input, activeRun),
      this.buildRunObservatoryItem(input, activeRun),
    ];
    const acceptance = this.buildAcceptance(input, items, activeRun);
    const blockers = unique([
      ...items.flatMap((item) => item.blockers),
      ...(input.handoffSnapshot?.blockers || []),
    ]);
    const status = this.resolveStatus(items, acceptance, blockers);

    return {
      schemaVersion: 1,
      phase: 'C8',
      generatedAt: this.now().toISOString(),
      status,
      activeRunId: activeRun?.id || null,
      activeTraceId: activeRun?.traceId || null,
      handoffPhase: input.handoffSnapshot?.phase || null,
      items,
      acceptance,
      compatibilityBoundaries: this.buildCompatibilityBoundaries(input),
      externalCompatibility: this.buildExternalCompatibility(input.runtimeSnapshot),
      blockers,
      explanation: [
        'C8 valida que ai-gateway opera como surface/adapter do Zavorth Agent Gateway.',
        'Provider plane, control plane, transportes, budget e observabilidade usam contratos Zavorth-native.',
        'Compatibilidade externa continua em rotas e transportes, mas nao vira canone interno novo.',
      ],
    };
  }

  private buildGatewayHandoffItem(input: AIGatewayNativeConvergenceInput): AIGatewayNativeConvergenceItem {
    const agentGatewayReady = input.agentGatewaySnapshot?.source.kind === 'universal-agent-runtime';
    const handoffReady = this.hasHandoffPlane(input.handoffSnapshot, 'gateway-core')
      && this.hasHandoffPlane(input.handoffSnapshot, 'legacy-pass-through-plane');
    const runtimeGatewayReady = input.runtimeSnapshot?.health.gatewayAvailable === true;
    const status = agentGatewayReady && handoffReady && runtimeGatewayReady
      ? 'ready'
      : agentGatewayReady || handoffReady || runtimeGatewayReady
        ? 'partial'
        : 'blocked';

    return {
      id: 'gateway-handoff-to-agent-gateway',
      label: 'Handoff do AI Gateway para ZavorthAgentGateway',
      status,
      owner: 'shared',
      evidence: [
        agentGatewayReady ? 'ZavorthAgentGatewaySnapshot.source.kind=universal-agent-runtime.' : '',
        handoffReady ? 'Handoff possui gateway-core e legacy-pass-through-plane prontos.' : '',
        runtimeGatewayReady ? 'ZavorthGatewayRuntimeSnapshot.health.gatewayAvailable=true.' : '',
      ].filter(Boolean),
      blockers: status === 'ready' ? [] : [
        ...(!agentGatewayReady ? ['Snapshot real do ZavorthAgentGateway nao foi anexado.'] : []),
        ...(!handoffReady ? ['Handoff gateway-core/legacy-pass-through ainda nao esta completo.'] : []),
        ...(!runtimeGatewayReady ? ['Gateway runtime ainda nao esta disponivel.'] : []),
      ],
    };
  }

  private buildProviderPlaneItem(input: AIGatewayNativeConvergenceInput): AIGatewayNativeConvergenceItem {
    const controlApi = input.runtimeSnapshot?.gatewayControlApi || null;
    const providerPlaneReady = controlApi?.providers.source === 'provider-control-plane';
    const modelPickerReady = controlApi?.modelPicker?.schemaVersion === 1 && Boolean(controlApi.modelPicker.selected);
    const status = providerPlaneReady && modelPickerReady
      ? 'ready'
      : providerPlaneReady || modelPickerReady
        ? 'partial'
        : 'blocked';

    return {
      id: 'provider-plane-model-picker',
      label: 'Provider plane consumido pelo Model Picker canonico',
      status,
      owner: 'shared',
      evidence: [
        providerPlaneReady ? 'gatewayControlApi.providers.source=provider-control-plane.' : '',
        modelPickerReady ? 'gatewayControlApi.modelPicker.schemaVersion=1 com selected profile.' : '',
        controlApi ? `Providers catalogados: ${controlApi.providers.summary.total}.` : '',
      ].filter(Boolean),
      blockers: status === 'ready' ? [] : [
        ...(!providerPlaneReady ? ['Provider plane nao vem do ProviderControlPlaneService.'] : []),
        ...(!modelPickerReady ? ['ModelPickerContract nao esta visivel no Gateway Control API.'] : []),
      ],
    };
  }

  private buildControlPlaneItem(input: AIGatewayNativeConvergenceInput): AIGatewayNativeConvergenceItem {
    const runtime = input.runtimeSnapshot || null;
    const hasRuntime = Boolean(runtime);
    const hasGatewaySnapshot = Boolean(runtime?.gateway);
    const hasAgentSnapshot = Boolean(input.agentGatewaySnapshot?.runObservatory);
    const status = hasRuntime && hasGatewaySnapshot && hasAgentSnapshot
      ? 'ready'
      : hasRuntime || hasGatewaySnapshot || hasAgentSnapshot
        ? 'partial'
        : 'blocked';

    return {
      id: 'control-plane-real-snapshots',
      label: 'Control plane consumindo snapshots reais',
      status,
      owner: 'ai-gateway',
      evidence: [
        hasRuntime ? 'ZavorthGatewayRuntimeSnapshot recebido.' : '',
        hasGatewaySnapshot ? 'runtime.gateway contem snapshot real/shell do gateway.' : '',
        hasAgentSnapshot ? 'ZavorthAgentGatewaySnapshot inclui Run Observatory.' : '',
      ].filter(Boolean),
      blockers: status === 'ready' ? [] : [
        ...(!hasRuntime ? ['Runtime snapshot canonico ausente.'] : []),
        ...(!hasGatewaySnapshot ? ['Control plane nao recebeu snapshot real do gateway.'] : []),
        ...(!hasAgentSnapshot ? ['Control plane nao recebeu snapshot real do agent loop.'] : []),
      ],
    };
  }

  private buildProxySseBoundaryItem(input: AIGatewayNativeConvergenceInput): AIGatewayNativeConvergenceItem {
    const transports = input.runtimeSnapshot?.controlPlane.availableTransports || [];
    const hasSse = transports.includes('sse');
    const hasWs = transports.includes('ws');
    const hasHttp = transports.includes('http');
    const boundaryReady = this.hasHandoffPlane(input.handoffSnapshot, 'proxy-transport-plane');
    const status = hasSse && hasWs && hasHttp && boundaryReady
      ? 'ready'
      : hasSse || hasWs || hasHttp || boundaryReady
        ? 'partial'
        : 'blocked';

    return {
      id: 'proxy-sse-adapter-boundary',
      label: 'Proxy/SSE como adapter, nao core',
      status,
      owner: 'ai-gateway',
      evidence: [
        transports.length > 0 ? `Transportes: ${transports.join(', ')}.` : '',
        boundaryReady ? 'Handoff proxy-transport-plane esta pronto.' : '',
      ].filter(Boolean),
      blockers: status === 'ready' ? [] : [
        ...(!hasHttp ? ['Transporte HTTP nao declarado no runtime.'] : []),
        ...(!hasSse ? ['Transporte SSE nao declarado no runtime.'] : []),
        ...(!hasWs ? ['Transporte websocket nao declarado no runtime.'] : []),
        ...(!boundaryReady ? ['Boundary proxy/SSE nao esta marcado como adapter no handoff.'] : []),
      ],
    };
  }

  private buildBudgetProviderHealthItem(
    input: AIGatewayNativeConvergenceInput,
    activeRun: UniversalAgentRun | null,
  ): AIGatewayNativeConvergenceItem {
    const metadata = recordOrNull(activeRun?.metadata);
    const hasBudget = hasRecord(metadata?.runBudget);
    const hasCorrelation = hasRecord(metadata?.providerRouteBudgetCorrelation);
    const hasRoute = hasRecord(metadata?.llmRuntimeRoute) || hasRecord(metadata?.providerRouteBudgetCorrelation);
    const providerHealthVisible = Boolean(input.runtimeSnapshot?.gatewayControlApi.health);
    const status = hasBudget && hasCorrelation && hasRoute && providerHealthVisible
      ? 'ready'
      : hasBudget || hasCorrelation || hasRoute || providerHealthVisible
        ? 'partial'
        : 'blocked';

    return {
      id: 'budget-provider-health-correlation',
      label: 'Budget e provider health correlacionados ao run',
      status,
      owner: 'agent-runtime',
      evidence: [
        hasBudget ? 'run.metadata.runBudget presente.' : '',
        hasCorrelation ? 'run.metadata.providerRouteBudgetCorrelation presente.' : '',
        hasRoute ? 'Rota LLM do run esta registrada.' : '',
        providerHealthVisible ? `Gateway health: ${input.runtimeSnapshot?.gatewayControlApi.health.status}.` : '',
      ].filter(Boolean),
      blockers: status === 'ready' ? [] : [
        ...(!activeRun ? ['Nenhum activeRun anexado para correlacao.'] : []),
        ...(!hasBudget ? ['run.metadata.runBudget ausente.'] : []),
        ...(!hasCorrelation ? ['run.metadata.providerRouteBudgetCorrelation ausente.'] : []),
        ...(!hasRoute ? ['Rota LLM do run nao esta registrada.'] : []),
        ...(!providerHealthVisible ? ['Provider health do Gateway Control API ausente.'] : []),
      ],
    };
  }

  private buildRunObservatoryItem(
    input: AIGatewayNativeConvergenceInput,
    activeRun: UniversalAgentRun | null,
  ): AIGatewayNativeConvergenceItem {
    const observatory = input.agentGatewaySnapshot?.runObservatory || null;
    const hasObservatory = Boolean(observatory);
    const runIndexed = Boolean(
      activeRun
      && observatory?.indexes.runIds.includes(activeRun.id)
      && observatory?.indexes.traceIds.includes(activeRun.traceId),
    );
    const status = hasObservatory && runIndexed
      ? 'ready'
      : hasObservatory
        ? 'partial'
        : 'blocked';

    return {
      id: 'run-observatory-integration',
      label: 'Observability integrada ao Run Observatory',
      status,
      owner: 'agent-runtime',
      evidence: [
        hasObservatory ? `Run Observatory indexa ${observatory?.totalRuns || 0} run(s).` : '',
        runIndexed ? `Run ativo ${activeRun?.id} indexado por runId e traceId.` : '',
      ].filter(Boolean),
      blockers: status === 'ready' ? [] : [
        ...(!hasObservatory ? ['Run Observatory snapshot ausente.'] : []),
        ...(hasObservatory && !runIndexed ? ['Run ativo nao esta indexado no Run Observatory por runId/traceId.'] : []),
      ],
    };
  }

  private buildAcceptance(
    input: AIGatewayNativeConvergenceInput,
    items: AIGatewayNativeConvergenceItem[],
    activeRun: UniversalAgentRun | null,
  ): AIGatewayNativeConvergenceAcceptance {
    const ready = (id: AIGatewayNativeConvergenceItemId) => this.itemStatus(items, id) === 'ready';
    const controlApi = input.runtimeSnapshot?.gatewayControlApi || null;
    const transportReady = ready('proxy-sse-adapter-boundary');
    const operations = controlApi?.operations || [];
    const nativeRun = input.agentGatewaySnapshot?.source.kind === 'universal-agent-runtime'
      && activeRun?.metadata?.adapterSource === 'universal-agent-runtime';

    return {
      aiGatewayNotIsland: ready('gateway-handoff-to-agent-gateway') && ready('control-plane-real-snapshots'),
      externalCompatibilityContinues: transportReady && this.hasExternalRoutes(input.runtimeSnapshot) && operations.length > 0,
      internalContractsZavorthNative: nativeRun && ready('provider-plane-model-picker'),
      legacyResidueNotCanonical: this.buildCompatibilityBoundaries(input).every((boundary) => boundary.status === 'adapter'),
      providerHealthCorrelatesWithRun: ready('budget-provider-health-correlation'),
      observabilityUsesRunObservatory: ready('run-observatory-integration'),
    };
  }

  private resolveStatus(
    items: AIGatewayNativeConvergenceItem[],
    acceptance: AIGatewayNativeConvergenceAcceptance,
    blockers: string[],
  ): AIGatewayNativeConvergenceStatus {
    const allAccepted = Object.values(acceptance).every((value) => value === true);
    if (allAccepted && blockers.length === 0 && items.every((item) => item.status === 'ready')) {
      return 'ready';
    }
    if (items.some((item) => item.status === 'ready' || item.status === 'partial')) {
      return 'partial';
    }
    return 'blocked';
  }

  private buildCompatibilityBoundaries(
    input: AIGatewayNativeConvergenceInput,
  ): AIGatewayDeforkCompatibilityBoundary[] {
    const handoffBoundaries = (input.handoffSnapshot?.planes || [])
      .filter((plane) => normalizeText(plane.compatibilityBoundary))
      .map((plane) => ({
        id: plane.id,
        status: 'adapter' as const,
        source: plane.sourceFiles[0] || 'handoff-plane',
        rule: normalizeText(plane.compatibilityBoundary),
      }));
    return [
      ...handoffBoundaries,
      {
        id: 'gateway-control-api',
        status: 'adapter',
        source: 'src/services/ZavorthGatewayRuntimeService.ts',
        rule: 'External Gateway Control routes stay compatible aliases; internal state is ZavorthGatewayRuntimeSnapshot.',
      },
      {
        id: 'provider-plane',
        status: 'adapter',
        source: 'src/services/providers/catalog/ModelPickerService.ts',
        rule: 'Provider DTOs converge through ModelPickerContract before they reach product surfaces.',
      },
    ];
  }

  private buildExternalCompatibility(
    runtimeSnapshot: ZavorthGatewayRuntimeSnapshot | null | undefined,
  ): AIGatewayNativeConvergenceSnapshot['externalCompatibility'] {
    const controlPlane = runtimeSnapshot?.controlPlane || null;
    const operations = runtimeSnapshot?.gatewayControlApi.operations || [];
    return {
      transports: controlPlane?.availableTransports ? [...controlPlane.availableTransports] : [],
      routes: unique([
        controlPlane?.statePath || '',
        controlPlane?.historyPath || '',
        controlPlane?.sendPath || '',
        controlPlane?.spawnPath || '',
        controlPlane?.ssePath || '',
        controlPlane?.websocketPath || '',
      ]),
      operations: operations.map((operation: GatewayControlApiOperationDescriptor) => operation.id),
    };
  }

  private hasExternalRoutes(runtimeSnapshot: ZavorthGatewayRuntimeSnapshot | null | undefined): boolean {
    const compatibility = this.buildExternalCompatibility(runtimeSnapshot);
    return compatibility.routes.length >= 4
      && compatibility.transports.includes('http')
      && compatibility.transports.includes('sse')
      && compatibility.transports.includes('ws');
  }

  private hasHandoffPlane(
    handoff: ZavorthAgentGatewayHandoffSnapshot | null | undefined,
    planeId: ZavorthAgentGatewayPlaneId,
  ): boolean {
    return handoff?.planes.some((plane) => plane.id === planeId && plane.status === 'ready') === true;
  }

  private itemStatus(
    items: AIGatewayNativeConvergenceItem[],
    id: AIGatewayNativeConvergenceItemId,
  ): AIGatewayNativeConvergenceStatus {
    return items.find((item) => item.id === id)?.status || 'blocked';
  }
}
