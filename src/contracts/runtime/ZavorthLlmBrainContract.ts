export const ZAVORTH_LLM_BRAIN_CONTRACT_VERSION =
  '2026-05-25.llm-brain-maturity' as const;

export type ZavorthLlmBrainStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthLlmBrainStreamKind =
  | 'lifecycle'
  | 'assistant'
  | 'tool'
  | 'approval'
  | 'evidence'
  | 'adapter'
  | 'learning';

export type ZavorthLlmBrainStreamPhase =
  | 'start'
  | 'progress'
  | 'end'
  | 'deferred'
  | 'blocked'
  | 'failed';

export type ZavorthLlmBrainStreamEvent = {
  id: string;
  kind: ZavorthLlmBrainStreamKind;
  phase: ZavorthLlmBrainStreamPhase;
  title: string;
  summary: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  createdAt: string;
  sourceEventId: string | null;
};

export type ZavorthLlmBrainToolAgency = {
  nativeToolLoopEnabled: boolean;
  llmRequestedTools: boolean;
  toolsExposed: string[];
  requested: number;
  executed: number;
  denied: number;
  failed: number;
  safeObservations: number;
  sideEffectsDeferred: number;
  effectBoundaryDenied: number;
  harnessRole: 'serve-and-govern' | 'observe-and-route' | 'blocked';
};

export type ZavorthLlmBrainSkillEvolution = {
  status: 'candidate-ready' | 'needs-more-signal' | 'quarantined';
  candidateKind: 'auto-skill' | 'skill-improvement' | 'procedure' | 'none';
  summary: string;
  approvalRequired: true;
  canModifySecurityPolicy: false;
  suggestedCommand: string | null;
};

export type ZavorthLlmBrainAdapterCoverage = {
  channel: string;
  provider: string;
  route: string;
  fallbackUsed: boolean;
  longTailFamilies: Array<'webhook' | 'bot-http' | 'relay-http' | 'local-bridge' | 'apple-bridge'>;
  liveProofRequiredForClaim: true;
  readyWhenConfigured: true;
};

export type ZavorthLlmBrainProviderNativeCapability = {
  enabled: boolean;
  used: boolean;
  fallbackRecommended: boolean;
  fallbackUsed: boolean;
  summary: string;
};

export type ZavorthLlmBrainHarnessRuntime = {
  mode: 'sandbox-first-governed' | 'observation-only' | 'needs-live-proof';
  mutableHostDirectExecution: false;
  sideEffectsDeferred: number;
  speculativeSandboxRuns: number;
  terminalBackendPlans: number;
  preferredMutationBackend: 'docker-first' | 'configured-backend' | 'local-copy-fallback';
  connectedBackends: Array<'local' | 'docker' | 'ssh' | 'wsl' | 'vercel-sandbox' | 'modal' | 'daytona'>;
  receiptsRequiredBeforeCommit: true;
  approvalRequiredBeforeHostMutation: true;
  summary: string;
};

export type ZavorthLlmBrainQaCheck = {
  id:
    | 'session-stream'
    | 'native-tool-loop'
    | 'effect-boundary'
    | 'sandbox-first-mutation'
    | 'terminal-backends'
    | 'provider-fallback'
    | 'skill-evolution'
    | 'long-tail-adapters'
    | 'human-live-proof';
  status: ZavorthLlmBrainStatus;
  summary: string;
};

export type ZavorthLlmBrainSnapshot = {
  contractVersion: typeof ZAVORTH_LLM_BRAIN_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthLlmBrainService';
  status: ZavorthLlmBrainStatus;
  brainMode:
    | 'llm-first-governed-tool-loop'
    | 'llm-first-no-tools-needed'
    | 'fallback-no-llm';
  summary: string;
  session: {
    sessionId: string;
    runId: string;
    channel: string;
    longSessionReady: boolean;
    serializedEvents: number;
  };
  streaming: {
    model: 'lifecycle-assistant-tool';
    events: ZavorthLlmBrainStreamEvent[];
    visualStreamingReady: boolean;
    rawChainOfThoughtExposed: false;
  };
  toolAgency: ZavorthLlmBrainToolAgency;
  providerNativeCapabilities: ZavorthLlmBrainProviderNativeCapability;
  harnessRuntime: ZavorthLlmBrainHarnessRuntime;
  skillEvolution: ZavorthLlmBrainSkillEvolution;
  adapterCoverage: ZavorthLlmBrainAdapterCoverage;
  qa: {
    checks: ZavorthLlmBrainQaCheck[];
    requiresHumanLiveQa: boolean;
    nextSafeAction: string;
  };
  invariants: {
    llmStaysDecisionMaker: true;
    harnessServesWithToolsMemoryAndPolicy: true;
    sideEffectsGoThroughEffectBoundary: true;
    learningCannotModifySecurityPolicy: true;
    longTailAdaptersNeedLiveProofBeforeClaim: true;
    rawSecretsSerialized: false;
    rawChainOfThoughtSerialized: false;
  };
};
