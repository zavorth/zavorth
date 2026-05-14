import type { LiveReadinessStatus } from './LiveReadinessContract.js';

export const ZAVORTH_PROVIDER_RUNTIME_ACTIVATION_CONTRACT_VERSION = '2026-05-04.live-phase-4' as const;

export type ProviderRuntimeActivationP0Id =
  | 'openai'
  | 'google'
  | 'deepseek'
  | 'qwen'
  | 'openrouter'
  | 'ollama'
  | 'anthropic'
  | 'mistral'
  | 'groq'
  | 'together'
  | 'perplexity'
  | 'xai'
  | 'huggingface'
  | 'fireworks'
  | 'deepinfra'
  | 'lmstudio'
  | 'vllm'
  | 'vercel-ai-gateway';

export type ProviderRuntimeActivationStatus =
  | 'first-class-live'
  | 'compatible-live'
  | 'local-live'
  | 'gateway-live'
  | 'blocked';

export type ProviderRuntimeActivationAdapterFamily =
  | 'bespoke'
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'gemini-rest'
  | 'local-openai-compatible'
  | 'gateway-openai-compatible';

export type ProviderRuntimeActivationGateKind =
  | 'config-schema'
  | 'provider-factory-route'
  | 'runtime-adapter'
  | 'model-fallback'
  | 'chat-smoke'
  | 'error-normalization'
  | 'usage-receipt'
  | 'redacted-receipt'
  | 'staging-live-smoke';

export type ProviderRuntimeActivationGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type ProviderRuntimeActivationConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  secretEnv: string[];
  secretValuesSerialized: false;
};

export type ProviderRuntimeActivationGate = {
  kind: ProviderRuntimeActivationGateKind;
  status: ProviderRuntimeActivationGateStatus;
  evidence: string;
  command: string | null;
};

export type ProviderRuntimeActivationReceipt = {
  id: string;
  providerId: ProviderRuntimeActivationP0Id;
  status: ProviderRuntimeActivationStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  family: ProviderRuntimeActivationAdapterFamily;
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  secretValuesSerialized: false;
};

export type ProviderRuntimeActivationEntry = {
  providerId: ProviderRuntimeActivationP0Id;
  status: ProviderRuntimeActivationStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  previousStatus: LiveReadinessStatus;
  adapterFamily: ProviderRuntimeActivationAdapterFamily;
  runtimeAdapter: string;
  providerFactoryTarget: string;
  adapterTarget: string;
  defaultModelName: string;
  configSchema: ProviderRuntimeActivationConfigSchema;
  gates: ProviderRuntimeActivationGate[];
  gaps: string[];
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  receipt: ProviderRuntimeActivationReceipt;
};

export type ProviderRuntimeActivationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PROVIDER_RUNTIME_ACTIVATION_CONTRACT_VERSION;
  phase: 'Phase 4 - Provider Runtime Activation P0';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    providers: 18;
    firstClassLive: number;
    compatibleLive: number;
    localLive: number;
    gatewayLive: number;
    blocked: number;
    generatedProviderManifestsRemainingP0: false;
    configSchemas: number;
    providerFactoryRoutes: number;
    chatSmokeCommands: number;
    redactedReceipts: number;
    liveIoRequiredByPhase4Check: false;
    secretValuesSerialized: false;
  };
  entries: ProviderRuntimeActivationEntry[];
  receipts: ProviderRuntimeActivationReceipt[];
  policy: {
    noLiveIoDuringPhase4Check: true;
    providerFactoryRoutesMustResolveWithoutFallback: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    noSecretsSerialized: true;
    compatibleProvidersNeedConfigBeforeLiveSmoke: true;
    receiptsRequiredBeforeProductionCertification: true;
  };
  commands: {
    check: 'npm run provider-runtime-activation:check --silent';
    doctor: 'npm run provider-runtime-activation -- --profile configured';
    stagingLiveSmoke: 'npm run provider-runtime-activation -- --profile staging-live --provider <provider> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextPhase: 'Phase 6 - Media Generation Live Plane';
  };
};
