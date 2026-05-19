export const ZAVORTH_SOURCE_PROVIDER_MESH_EXPANSION_CONTRACT_VERSION = '2026-05-05.checkpoint-3' as const;

export const SOURCE_PROVIDER_MESH_PACKAGES = [
  '@anthropic-ai/sdk',
  '@anthropic-ai/vertex-sdk',
  '@aws-sdk/client-bedrock-runtime',
  '@google/genai',
  'proxy-agent',
  'https-proxy-agent',
  'undici',
] as const;

export type SourceProviderMeshPackageName = typeof SOURCE_PROVIDER_MESH_PACKAGES[number];

export type SourceProviderRuntimeId =
  | 'anthropic-direct'
  | 'anthropic-vertex'
  | 'bedrock-claude'
  | 'google-genai'
  | 'provider-proxy-network'
  | 'local-openai-compatible';

export type SourceProviderRuntimeFamily =
  | 'anthropic-direct-sdk'
  | 'anthropic-vertex-sdk'
  | 'aws-bedrock-runtime'
  | 'google-genai-sdk'
  | 'proxy-network-runtime'
  | 'local-openai-compatible';

export type SourceProviderRuntimeStatus =
  | 'ready'
  | 'configured'
  | 'disabled'
  | 'missing'
  | 'owner_decision_required'
  | 'rejected';

export type SourceProviderRuntimeDecision =
  | 'implemented'
  | 'implemented-owner-gated'
  | 'replaced-by-existing-provider'
  | 'provider-mesh-only'
  | 'rejected-by-default';

export type SourceProviderCredentialRouteKind =
  | 'api-key'
  | 'vertex'
  | 'bedrock'
  | 'google-genai'
  | 'proxy'
  | 'local';

export type SourceProviderMeshSnapshotStatus =
  | 'passed'
  | 'failed';

export type ProviderRuntimeContract = {
  providerId: SourceProviderRuntimeId;
  family: SourceProviderRuntimeFamily;
  defaultModelName: string;
  routeKind: SourceProviderCredentialRouteKind;
  liveIoByDefault: false;
  explicitProviderSelectionRequired: true;
  secretValuesSerialized: false;
};

export type SourceProviderMeshPackageEvidence = {
  packageName: SourceProviderMeshPackageName;
  presentInSource: boolean;
  presentInZavorthPackageJson: boolean;
  presentInZavorthLockfile: boolean;
  sourceReferenceFiles: string[];
  zavorthReferenceFiles: string[];
};

export type SourceProviderCredentialRoute = {
  providerId: SourceProviderRuntimeId;
  routeKind: SourceProviderCredentialRouteKind;
  status: 'configured' | 'missing' | 'optional';
  requiredEnv: string[];
  optionalEnv: string[];
  secretEnv: string[];
  presentEnv: string[];
  missingEnv: string[];
  secretValuesSerialized: false;
  ownerApprovalRequired: boolean;
  reason: string;
};

export type SourceProviderRuntimeAdapterEntry = {
  providerId: SourceProviderRuntimeId;
  family: SourceProviderRuntimeFamily;
  status: SourceProviderRuntimeStatus;
  decision: SourceProviderRuntimeDecision;
  contract: ProviderRuntimeContract;
  adapterPath: string;
  providerFactoryName: string;
  defaultModelName: string;
  credentialRoute: SourceProviderCredentialRoute;
  packages: SourceProviderMeshPackageName[];
  configured: boolean;
  enabledByDefault: false;
  liveIoPerformed: false;
  explicitLiveCommandRequired: true;
  artifactReceipts: {
    required: true;
    kinds: string[];
  };
  policy: {
    noProviderImpersonation: true;
    noAnthropicApiSpoofing: true;
    noSecretSerialization: true;
    ownerApprovalRequiredForManagedCloudRoutes: boolean;
  };
  notes: string[];
};

export type SourceProviderMeshExpansionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SOURCE_PROVIDER_MESH_EXPANSION_CONTRACT_VERSION;
  status: SourceProviderMeshSnapshotStatus;
  phase: 3;
  statement: 'Source provider breadth is absorbed as explicit Zavorth Provider Mesh adapters, credential routes, local-provider alternatives and receipts.';
  sourceRoot: string;
  zavorthRoot: string;
  packageEvidence: SourceProviderMeshPackageEvidence[];
  adapters: SourceProviderRuntimeAdapterEntry[];
  summary: {
    packagesTracked: number;
    packagesPresentInSource: number;
    packagesImplementedInZavorth: number;
    adaptersReady: number;
    adaptersOwnerGated: number;
    adaptersConfigured: number;
    providerFactoryRoutes: number;
    liveIoPerformed: false;
    enabledByDefault: false;
    secretValuesSerialized: false;
  };
  localModelPolicy: {
    recommendation: 'Use Provider Mesh via Ollama, LM Studio, vLLM or OpenAI-compatible local providers.';
    noAnthropicApiImpersonationForLocalModels: true;
    openAiCompatibleRoutes: string[];
  };
  networkPolicy: {
    proxyEnvSupported: string[];
    proxyPackagesTracked: SourceProviderMeshPackageName[];
    noNetworkWithoutProviderSelection: true;
    noSecretValuesInReceipts: true;
  };
  policy: {
    noSourceSourceCopy: true;
    noAnthropicApiImpersonation: true;
    noProviderBypass: true;
    directAnthropicNeverEnabledByDefault: true;
    vertexNeverEnabledByDefault: true;
    bedrockNeverEnabledByDefault: true;
    googleGenAiNeverEnabledByDefault: true;
    artifactFirstReceipts: true;
  };
  commands: {
    inspect: 'npm run source-provider-mesh-expansion --silent';
    inspectJson: 'npm run source-provider-mesh-expansion:json --silent';
    check: 'npm run source-provider-mesh-expansion:check --silent';
    qa: 'npm run qa:source-provider-mesh-expansion --silent';
    liveSmoke: 'npm run source-provider-mesh-expansion -- --provider <provider> --confirm-live-io';
    nextStage: 'Connector registry - Channel Mesh Expansion Pack';
  };
};
