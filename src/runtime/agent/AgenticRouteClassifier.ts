import { config } from '../../config/index.js';
import type { NaturalFirstRunClassification } from './NaturalFirstRunClassifier.js';
import type { UniversalAgentRequest } from './UniversalAgentRuntimeTypes.js';

export type AgenticRouteKind = 'standard-llm' | 'llm-interactions' | 'remote-agent-preview';

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
  if (raw === 'off' || raw === 'disabled') {
    return 'off';
  }
  if (raw === 'ask' || raw === 'ask-first') {
    return 'ask-first';
  }
  return 'auto';
}

function hasGeminiInteractionsCredential(): boolean {
  return Boolean((config as any).geminiInteractionsApiKey || config.geminiApiKey || process.env.GEMINI_API_KEY);
}

function interactionsEnabled(): boolean {
  return Boolean(
    (config as any).geminiInteractionsEnabled || process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED === 'true',
  );
}

function managedAgentsEnabled(): boolean {
  return Boolean(
    (config as any).geminiManagedAgentsEnabled || process.env.ZAVORTH_GEMINI_MANAGED_AGENTS_ENABLED === 'true',
  );
}

export class AgenticRouteClassifier {
  public decide(params: {
    request: UniversalAgentRequest;
    naturalFirst: NaturalFirstRunClassification;
  }): AgenticRouteDecision {
    const mode = metadataMode(params.request);
    const signals = new Set<string>();
    const basePolicy = {
      noToolExecutionWithoutApproval: true,
      serverSideStore: false as const,
      previousInteractionAllowed: params.request.metadata?.allowServerSideInteractionContinuity === true,
      remoteExecutionAllowed: false,
    };

    if (mode === 'off') {
      return this.standard(mode, 'Agentic routing is disabled for this request.', ['agentic-off'], basePolicy);
    }

    // Structured route preference only — free-text never selects product agentic surfaces.
    const remoteCandidate = this.isRemoteManagedAgentCandidate(params.request, params.naturalFirst, signals);
    if (remoteCandidate) {
      if (!managedAgentsEnabled()) {
        return this.standard(
          mode,
          'A remote agent would help, but the route is disabled; keeping local governed preview.',
          [...signals, 'remote-managed-agent-disabled'],
          basePolicy,
        );
      }
      return {
        source: 'AgenticRouteClassifier',
        contractVersion: 'agentic-route-classifier/1',
        mode,
        selectedRoute: 'remote-agent-preview',
        capability: 'remote-managed-agent',
        providerRoute: 'gemini-managed-agent',
        requiresApproval: true,
        explanation:
          'Request appears to benefit from sandbox/remote agent; Zavorth opens preview and requests approval before any execution.',
        userFacingLabel: 'Isolated execution with approval',
        signals: Array.from(signals).concat('approval-required', 'store:false'),
        policy: {
          ...basePolicy,
          remoteExecutionAllowed: true,
        },
      };
    }

    const interactionsCandidate = this.isInteractionsCandidate(params.request, params.naturalFirst, signals);
    if (interactionsCandidate && interactionsEnabled() && hasGeminiInteractionsCredential()) {
      return {
        source: 'AgenticRouteClassifier',
        contractVersion: 'agentic-route-classifier/1',
        mode,
        selectedRoute: 'llm-interactions',
        capability: 'steps-timeline',
        providerRoute: 'gemini-interactions',
        requiresApproval: false,
        explanation:
          'complex request without sensitive mutation; staged reply improves timeline, receipts, and replay.',
        userFacingLabel: 'Staged analysis',
        signals: Array.from(signals).concat('interactions-enabled', 'store:false'),
        policy: basePolicy,
      };
    }

    if (interactionsCandidate) {
      signals.add('interactions-candidate');
      signals.add(interactionsEnabled() ? 'interactions-auth-missing' : 'interactions-disabled');
    }
    return this.standard(
      mode,
      'Default route kept; agentic routing was not needed or is not configured.',
      Array.from(signals),
      basePolicy,
    );
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
      userFacingLabel: 'Default response',
      signals: Array.from(new Set(signals)),
      policy,
    };
  }

  private isInteractionsCandidate(
    request: UniversalAgentRequest,
    naturalFirst: NaturalFirstRunClassification,
    signals: Set<string>,
  ): boolean {
    const metadata = request.metadata || {};
    const preferredRoute = normalizeSearchText(metadata.agenticRoute || metadata.preferredAgenticRoute);
    const preferInteractions =
      metadata.preferInteractions === true ||
      preferredRoute === 'llm-interactions' ||
      preferredRoute === 'interactions' ||
      preferredRoute === 'steps-timeline';
    const eligibleRoute =
      naturalFirst.route === 'llm-reply' ||
      naturalFirst.route === 'governed-execution' ||
      naturalFirst.route === 'memory-recall' ||
      naturalFirst.intent.primary === 'operational-work';
    if (preferInteractions) signals.add('structured-prefer-interactions');
    if (eligibleRoute) signals.add(`natural-route:${naturalFirst.route}`);
    if (naturalFirst.effort === 'heavy') signals.add('structured-heavy-effort');
    if (naturalFirst.requiresApproval) signals.add('approval-route-not-auto-interactions');
    // Structured prefer flag, or heavy effort from structured natural-first classification — never free-text keywords.
    return preferInteractions || (eligibleRoute && !naturalFirst.requiresApproval && naturalFirst.effort === 'heavy');
  }

  private isRemoteManagedAgentCandidate(
    request: UniversalAgentRequest,
    naturalFirst: NaturalFirstRunClassification,
    signals: Set<string>,
  ): boolean {
    const metadata = request.metadata || {};
    const preferredRoute = normalizeSearchText(metadata.agenticRoute || metadata.preferredAgenticRoute);
    const preferRemote =
      metadata.preferRemoteAgent === true ||
      metadata.preferManagedAgent === true ||
      metadata.managedAgent === true ||
      preferredRoute === 'remote-agent-preview' ||
      preferredRoute === 'remote-managed-agent' ||
      preferredRoute === 'managed-agent';
    if (preferRemote) signals.add('structured-prefer-remote-agent');
    if (naturalFirst.requiresApproval) signals.add('natural-approval-required');
    // Structured metadata only — free-text never selects remote managed agent product surface.
    return preferRemote;
  }
}
