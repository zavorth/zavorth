import { config } from '../../config/index.js';
import type { NaturalFirstRunClassification } from './NaturalFirstRunClassifier.js';
import type { UniversalAgentRequest } from './UniversalAgentRuntimeTypes.js';

export type AgenticRouteKind =
  | 'standard-llm'
  | 'llm-interactions'
  | 'remote-agent-preview';

export type AgenticRouteDecision = {
  source: 'AgenticRouteClassifier';
  contractVersion: 'agentic-route-classifier/1';
  mode: 'auto' | 'off' | 'ask-first';
  selectedRoute: AgenticRouteKind;
  capability: 'standard' | 'steps-timeline' | 'remote-managed-agent';
  providerRoute: string | null;
  requiresApproval: boolean;
  explanation: string;
  userFacingLabel: string;
  signals: string[];
  policy: {
    noToolExecutionWithoutApproval: boolean;
    serverSideStore: false;
    previousInteractionAllowed: boolean;
    remoteExecutionAllowed: boolean;
  };
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function metadataMode(request: UniversalAgentRequest): AgenticRouteDecision['mode'] {
  const raw = normalizeSearchText(request.metadata?.agenticMode || request.metadata?.agenticRouting || 'auto');
  if (raw === 'off' || raw === 'disabled' || raw === 'desligado') {
    return 'off';
  }
  if (raw === 'ask' || raw === 'ask-first' || raw === 'perguntar') {
    return 'ask-first';
  }
  return 'auto';
}

function hasGeminiInteractionsCredential(): boolean {
  return Boolean((config as any).geminiInteractionsApiKey || config.geminiApiKey || process.env.GEMINI_API_KEY);
}

function interactionsEnabled(): boolean {
  return Boolean((config as any).geminiInteractionsEnabled || process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED === 'true');
}

function managedAgentsEnabled(): boolean {
  return Boolean((config as any).geminiManagedAgentsEnabled || process.env.ZAVORTH_GEMINI_MANAGED_AGENTS_ENABLED === 'true');
}

export class AgenticRouteClassifier {
  public decide(params: {
    request: UniversalAgentRequest;
    naturalFirst: NaturalFirstRunClassification;
  }): AgenticRouteDecision {
    const mode = metadataMode(params.request);
    const text = normalizeSearchText(params.request.text);
    const signals = new Set<string>();
    const basePolicy = {
      noToolExecutionWithoutApproval: true,
      serverSideStore: false as const,
      previousInteractionAllowed: params.request.metadata?.allowServerSideInteractionContinuity === true,
      remoteExecutionAllowed: false,
    };

    if (mode === 'off') {
      return this.standard(mode, 'Roteamento agentic desligado para este pedido.', ['agentic-off'], basePolicy);
    }

    const remoteCandidate = this.isRemoteManagedAgentCandidate(text, params.naturalFirst, signals);
    if (remoteCandidate) {
      if (!managedAgentsEnabled()) {
        return this.standard(mode, 'A remote agent would help, but the route is disabled; keeping local governed preview.', [
          ...signals,
          'remote-managed-agent-disabled',
        ], basePolicy);
      }
      return {
        source: 'AgenticRouteClassifier',
        contractVersion: 'agentic-route-classifier/1',
        mode,
        selectedRoute: 'remote-agent-preview',
        capability: 'remote-managed-agent',
        providerRoute: 'gemini-managed-agent',
        requiresApproval: true,
        explanation: 'Pedido parece se beneficiar de sandbox/agente remoto; o Zavorth abre preview e pede approval antes de qualquer execucao.',
        userFacingLabel: 'Execucao isolada com aprovacao',
        signals: Array.from(signals).concat('approval-required', 'store:false'),
        policy: {
          ...basePolicy,
          remoteExecutionAllowed: true,
        },
      };
    }

    const interactionsCandidate = this.isInteractionsCandidate(text, params.naturalFirst, signals);
    if (interactionsCandidate && interactionsEnabled() && hasGeminiInteractionsCredential()) {
      return {
        source: 'AgenticRouteClassifier',
        contractVersion: 'agentic-route-classifier/1',
        mode,
        selectedRoute: 'llm-interactions',
        capability: 'steps-timeline',
        providerRoute: 'gemini-interactions',
        requiresApproval: false,
        explanation: 'Pedido complexo sem mutacao sensivel; usar resposta por etapas melhora timeline, receipts e replay.',
        userFacingLabel: 'Analise por etapas',
        signals: Array.from(signals).concat('interactions-enabled', 'store:false'),
        policy: basePolicy,
      };
    }

    if (interactionsCandidate) {
      signals.add('interactions-candidate');
      signals.add(interactionsEnabled() ? 'interactions-auth-missing' : 'interactions-disabled');
    }
    return this.standard(mode, 'Rota padrao mantida; agentic routing nao foi necessario ou nao esta configurado.', Array.from(signals), basePolicy);
  }

  private standard(
    mode: AgenticRouteDecision['mode'],
    explanation: string,
    signals: Iterable<string>,
    policy: AgenticRouteDecision['policy'],
  ): AgenticRouteDecision {
    return {
      source: 'AgenticRouteClassifier',
      contractVersion: 'agentic-route-classifier/1',
      mode,
      selectedRoute: 'standard-llm',
      capability: 'standard',
      providerRoute: null,
      requiresApproval: false,
      explanation,
      userFacingLabel: 'Resposta padrao',
      signals: Array.from(new Set(signals)),
      policy,
    };
  }

  private isInteractionsCandidate(
    text: string,
    naturalFirst: NaturalFirstRunClassification,
    signals: Set<string>,
  ): boolean {
    const complexAnalysis = /\b(analise|analisar|investigue|debug|audite|revise|compare|diagnostique|explique|plano|arquitetura|erro|falha|vulnerabilidade)\b/.test(text);
    const multiStep = /\b(passos|etapas|timeline|raciocinio|por que|porque|evidencias|receipts?|auditoria)\b/.test(text);
    const eligibleRoute = naturalFirst.route === 'llm-reply'
      || naturalFirst.route === 'governed-execution'
      || naturalFirst.route === 'memory-recall'
      || naturalFirst.intent.primary === 'operational-work';
    if (complexAnalysis) signals.add('complex-analysis');
    if (multiStep) signals.add('stepwise-answer-helpful');
    if (eligibleRoute) signals.add(`natural-route:${naturalFirst.route}`);
    if (naturalFirst.requiresApproval) signals.add('approval-route-not-auto-interactions');
    return eligibleRoute && !naturalFirst.requiresApproval && (complexAnalysis || multiStep || naturalFirst.effort === 'heavy');
  }

  private isRemoteManagedAgentCandidate(
    text: string,
    naturalFirst: NaturalFirstRunClassification,
    signals: Set<string>,
  ): boolean {
    const isolated = /\b(isolad|sandbox|remot|sem tocar|sem mexer|fora do meu pc|ambiente separado)\b/.test(text);
    const suspicious = /\b(suspeit|malware|pacote desconhecido|nao confiavel|untrusted|perigoso|arquivo estranho)\b/.test(text);
    const runUnknown = /\b(rode|execute|test(e|ar)|instale|npm install|pip install|script)\b/.test(text)
      && /\b(pacote|repo|repositorio|script|arquivo|zip|download)\b/.test(text);
    if (isolated) signals.add('isolation-requested');
    if (suspicious) signals.add('untrusted-content-risk');
    if (runUnknown) signals.add('unknown-package-execution-risk');
    if (naturalFirst.requiresApproval) signals.add('natural-approval-required');
    return isolated || suspicious || (runUnknown && naturalFirst.risk.level !== 'safe');
  }
}
