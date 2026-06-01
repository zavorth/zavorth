export const ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION =
  'zavorth-external-agent-gateway/1' as const;

export type ZavorthExternalAgentAdapterKind = 'cli' | 'http' | 'acp' | 'mcp';
export type ZavorthExternalAgentIsolationKind = 'local-supervised' | 'wsl' | 'docker';
export type ZavorthExternalAgentNetworkMode = 'disabled' | 'local-only' | 'profile';
export type ZavorthExternalAgentProfileStatus = 'enabled' | 'disabled';
export type ZavorthExternalAgentInvocationStatus =
  | 'preview'
  | 'registered'
  | 'approval-required'
  | 'completed'
  | 'blocked'
  | 'failed';

export type ZavorthExternalAgentProfile = {
  id: string;
  label: string;
  adapter: ZavorthExternalAgentAdapterKind;
  status: ZavorthExternalAgentProfileStatus;
  root: string | null;
  command: string | null;
  args: string[];
  endpoint: string | null;
  acp: {
    serverId: string | null;
    transport: 'mock-jsonrpc' | 'stdio-jsonrpc' | 'acp-sdk-stdio' | null;
  };
  promptMode: 'stdin' | 'arg' | 'json';
  allowedCapabilities: string[];
  liveExecutionEnabled: boolean;
  allowRemoteNetwork: boolean;
  isolation: {
    kind: ZavorthExternalAgentIsolationKind;
    required: boolean;
    strongBoundary: boolean;
    image: string | null;
    distro: string | null;
    workspaceMount: string | null;
    workingDirectory: string | null;
    network: ZavorthExternalAgentNetworkMode;
    readOnlyRoot: boolean;
    notes: string[];
  };
  createdAt: string;
  updatedAt: string;
  provenance: {
    source: 'manual' | 'onboarding-candidate' | 'api' | 'telegram';
    onboardingCandidateId: string | null;
  };
  safety: {
    requiresApprovalPerInvocation: true;
    noDefaultRuntimeBinding: true;
    secretsPassedThroughEnv: false;
    toolExposureByDefault: false;
    strongIsolationAvailable: boolean;
    localCliIsNotOsSandbox: boolean;
  };
};

export type ZavorthExternalAgentGatewayRegistrySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION;
  surface: 'external-agent-gateway';
  status: 'empty' | 'ready';
  registryFile: string;
  profiles: ZavorthExternalAgentProfile[];
  summary: {
    total: number;
    enabled: number;
    liveEnabled: number;
    cli: number;
    http: number;
    acp: number;
    mcp: number;
    stronglyIsolated: number;
  };
  safety: {
    noAgentUsedDuringRegistryRead: true;
    noToolExposure: true;
    noCredentialSerialization: true;
    liveUseRequiresApproval: true;
    strongIsolationAvailable: true;
    localCliDeclaredNonSandboxed: true;
  };
};

export type ZavorthExternalAgentGatewayDashboardSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION;
  surface: 'external-agent-dashboard';
  registry: ZavorthExternalAgentGatewayRegistrySnapshot;
  latestReceipt: ZavorthExternalAgentGatewayReceipt | null;
  summary: {
    profiles: number;
    liveEnabled: number;
    stronglyIsolated: number;
    latestReceiptStatus: ZavorthExternalAgentInvocationStatus | 'none';
  };
  safety: {
    noAgentUsedDuringDashboardRead: true;
    liveUseRequiresApproval: true;
    localCliDeclaredNonSandboxed: true;
    rawSecretsSerialized: false;
  };
};

export type ZavorthExternalAgentGatewayReceipt = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION;
  surface: 'external-agent-gateway';
  kind: 'profile-registration' | 'agent-invocation';
  status: ZavorthExternalAgentInvocationStatus;
  profile: ZavorthExternalAgentProfile | null;
  request: {
    requestedBy: string;
    promptHash: string | null;
    promptPreview: string | null;
    approvalProvided: boolean;
    dryRun: boolean;
  };
  execution: {
    adapterInvoked: boolean;
    adapter: ZavorthExternalAgentAdapterKind | null;
    command: string | null;
    args: string[];
    cwd: string | null;
    endpoint: string | null;
    exitCode: number | null;
    durationMs: number;
    timedOut: boolean;
    isolationKind: ZavorthExternalAgentIsolationKind | null;
    isolationStrongBoundary: boolean;
    sandboxCommand: string | null;
    liveExecutionPerformed: boolean;
    liveNetworkPerformed: boolean;
  };
  output: {
    text: string;
    stdout: string | null;
    stderr: string | null;
  };
  nextAction: {
    label: string;
    command: string | null;
  };
  safety: {
    approvalRequired: true;
    approvalBypassAllowed: false;
    noShellInterpolation: true;
    rawSecretsSerialized: false;
    profileOnlyNoDefaultBinding: true;
    filesystemSandboxClaimed: boolean;
    localCliIsNotOsSandbox: boolean;
    strongIsolationRequiredForUntrustedCli: true;
  };
};
