import type { LiveReadinessStatus } from './LiveReadinessContract.js';
import type {
  ProviderLongTailChatSmokeReceipt,
  ProviderLongTailEmbeddingSmokeReceipt,
} from '../adapters/providers/ProviderLongTailLiveClients.js';

export const ZAVORTH_PROVIDER_LONG_TAIL_ACTIVATION_CONTRACT_VERSION = '2026-05-04.live-checkpoint-5' as const;

export type ProviderLongTailActivationId =
  | 'alibaba'
  | 'amazon-bedrock'
  | 'amazon-bedrock-mantle'
  | 'anthropic-vertex'
  | 'arcee'
  | 'cerebras'
  | 'chutes'
  | 'cloudflare-ai-gateway'
  | 'copilot-proxy'
  | 'github-copilot'
  | 'gradium'
  | 'kilocode'
  | 'kimi-coding'
  | 'litellm'
  | 'microsoft'
  | 'microsoft-foundry'
  | 'moonshot'
  | 'nvidia'
  | 'opencode'
  | 'opencode-go'
  | 'qianfan'
  | 'sglang'
  | 'stepfun'
  | 'tencent'
  | 'tokenjuice'
  | 'venice'
  | 'voyage'
  | 'xiaomi'
  | 'zai';

export type ProviderLongTailActivationStatus =
  | 'compatible-live'
  | 'managed-gateway-live'
  | 'local-live'
  | 'embedding-live'
  | 'blocked';

export type ProviderLongTailActivationAdapterFamily =
  | 'openai-compatible'
  | 'managed-gateway-compatible'
  | 'local-openai-compatible'
  | 'embedding-compatible';

export type ProviderLongTailActivationGateKind =
  | 'named-manifest'
  | 'config-schema'
  | 'provider-factory-route'
  | 'family-adapter'
  | 'model-fallback'
  | 'chat-smoke'
  | 'embedding-smoke'
  | 'error-normalization'
  | 'usage-receipt'
  | 'redacted-receipt'
  | 'staging-live-smoke';

export type ProviderLongTailActivationGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type ProviderLongTailActivationConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  secretEnv: string[];
  secretValuesSerialized: false;
};

export type ProviderLongTailActivationGate = {
  kind: ProviderLongTailActivationGateKind;
  status: ProviderLongTailActivationGateStatus;
  evidence: string;
  command: string | null;
};

export type ProviderLongTailActivationReceipt = {
  id: string;
  providerId: ProviderLongTailActivationId;
  status: ProviderLongTailActivationStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  family: ProviderLongTailActivationAdapterFamily;
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  secretValuesSerialized: false;
};

export type ProviderLongTailConfiguredDoctorReceipt = {
  id: string;
  providerId: ProviderLongTailActivationId;
  family: ProviderLongTailActivationAdapterFamily;
  status: 'configured' | 'missing-config';
  configured: boolean;
  missingRequiredEnv: string[];
  missingRuntimeConfig: string[];
  requiredEnvChecked: string[];
  optionalEnvChecked: string[];
  secretEnvChecked: string[];
  defaultModelName: string;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  liveIoPerformed: false;
  secretValuesSerialized: false;
};

export type ProviderLongTailStagingLiveReceipt = {
  id: string;
  providerId: ProviderLongTailActivationId;
  family: ProviderLongTailActivationAdapterFamily;
  status: 'passed' | 'blocked';
  confirmed: boolean;
  blockedReason: string | null;
  doctor: ProviderLongTailConfiguredDoctorReceipt;
  smokeReceipt: ProviderLongTailChatSmokeReceipt | ProviderLongTailEmbeddingSmokeReceipt | null;
  liveIoPerformed: boolean;
  secretValuesSerialized: false;
};

export type ProviderLongTailActivationEntry = {
  providerId: ProviderLongTailActivationId;
  status: ProviderLongTailActivationStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  previousStatus: LiveReadinessStatus;
  adapterFamily: ProviderLongTailActivationAdapterFamily;
  runtimeAdapter: string;
  providerFactoryTarget: string;
  adapterTarget: string;
  defaultModelName: string;
  configSchema: ProviderLongTailActivationConfigSchema;
  gates: ProviderLongTailActivationGate[];
  gaps: string[];
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  receipt: ProviderLongTailActivationReceipt;
};

export type ProviderLongTailActivationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PROVIDER_LONG_TAIL_ACTIVATION_CONTRACT_VERSION;
  phase: 'Credential vault - Provider Runtime Activation Long Tail';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    providers: 29;
    compatibleLive: number;
    managedGatewayLive: number;
    localLive: number;
    embeddingLive: number;
    blocked: number;
    generatedProviderManifestsRemainingLongTail: false;
    generatedProviderManifestsRemainingTotal: false;
    configSchemas: number;
    providerFactoryRoutes: number;
    smokeCommands: number;
    chatSmokeCommands: number;
    embeddingSmokeCommands: number;
    redactedReceipts: number;
    liveIoRequiredByStage5Check: false;
    secretValuesSerialized: false;
  };
  entries: ProviderLongTailActivationEntry[];
  receipts: ProviderLongTailActivationReceipt[];
  policy: {
    noLiveIoDuringStage5Check: true;
    namedManifestsRequiredForEveryLongTailProvider: true;
    providerFactoryRoutesMustResolveWithoutFallback: true;
    managedGatewaysRequireOperatorBaseUrl: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    noSecretsSerialized: true;
    receiptsRequiredBeforeProductionCertification: true;
  };
  commands: {
    check: 'npm run provider-long-tail-activation:check --silent';
    doctor: 'npm run provider-long-tail-activation -- --profile configured';
    stagingLiveSmoke: 'npm run provider-long-tail-activation -- --profile staging-live --provider <provider> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextStage: 'Intent model3 - Live Consistency Certification';
  };
};
