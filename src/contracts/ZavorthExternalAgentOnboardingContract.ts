export const ZAVORTH_EXTERNAL_AGENT_ONBOARDING_CONTRACT_VERSION =
  'zavorth-external-agent-onboarding/1' as const;

export type ZavorthExternalAgentOnboardingStatus =
  | 'needs-user-hint'
  | 'ready-for-review'
  | 'no-candidate-found'
  | 'blocked';

export type ZavorthExternalAgentOnboardingHintKind =
  | 'none'
  | 'exact-path'
  | 'approximate-path'
  | 'cli-command'
  | 'endpoint';

export type ZavorthExternalAgentOnboardingProtocol =
  | 'acp'
  | 'mcp'
  | 'cli'
  | 'http'
  | 'unknown';

export type ZavorthExternalAgentOnboardingAdapter =
  | 'acp'
  | 'mcp'
  | 'cli'
  | 'http'
  | 'manual-profile';

export type ZavorthExternalAgentOnboardingSignal = {
  id: string;
  label: string;
  weight: number;
  evidence: string;
};

export type ZavorthExternalAgentOnboardingCandidate = {
  id: string;
  label: string;
  confidence: 'low' | 'medium' | 'high';
  source: {
    kind: ZavorthExternalAgentOnboardingHintKind;
    value: string;
    inspectedPath: string | null;
  };
  protocols: ZavorthExternalAgentOnboardingProtocol[];
  suggestedAdapter: ZavorthExternalAgentOnboardingAdapter;
  signals: ZavorthExternalAgentOnboardingSignal[];
  nextAction: {
    label: string;
    command: string;
  };
  gatewayProfileDraft: {
    id: string;
    label: string;
    adapter: 'cli' | 'http' | 'acp' | 'mcp';
    root: string | null;
    command: string | null;
    args: string[];
    endpoint: string | null;
    promptMode: 'stdin' | 'arg' | 'json';
    isolation: 'local-supervised' | 'wsl' | 'docker';
    missingFields: string[];
    canRegisterAutomatically: boolean;
    requiresCommandConfirmation: boolean;
    recommendedRegistrationCommand: string;
  };
  registration: {
    status: 'candidate-only';
    requiresUserApproval: true;
    liveExecutionEnabled: false;
    dryRunAvailable: true;
  };
  safety: {
    readOnlyInspection: true;
    noProcessStarted: true;
    noNetworkProbe: true;
    noCredentialRead: true;
    noToolExposure: true;
    noDefaultRuntimeBinding: true;
  };
};

export type ZavorthExternalAgentOnboardingSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_EXTERNAL_AGENT_ONBOARDING_CONTRACT_VERSION;
  surface: 'external-agent-onboarding';
  status: ZavorthExternalAgentOnboardingStatus;
  headline: string;
  userPrompt: string;
  requestedBy: string;
  consent: {
    provided: boolean;
    mode: 'not-provided' | 'read-only-inspection';
    requiredBeforeInspection: true;
    scope: {
      kind: ZavorthExternalAgentOnboardingHintKind;
      value: string | null;
      maxDepth: number;
      exactOnly: boolean;
    };
  };
  inspection: {
    performed: boolean;
    inspectedRoots: string[];
    filesRead: string[];
    directoriesScanned: number;
    capped: boolean;
  };
  candidates: ZavorthExternalAgentOnboardingCandidate[];
  knownDiscoveryHints: Array<{
    kind: ZavorthExternalAgentOnboardingHintKind;
    example: string;
    safety: string;
  }>;
  policy: {
    automaticDiscoveryEnabled: false;
    userDeclaredHintsFirst: true;
    consentRequiredForDiskInspection: true;
    consentRequiredForPathSearch: true;
    consentRequiredForCliPathInspection: true;
    consentRequiredForEndpointProbe: true;
    discoveryDoesNotRegisterOrUseAgents: true;
    liveUseRequiresSeparateApproval: true;
  };
  safety: {
    noFilesystemScanWithoutConsent: true;
    noProcessListInspection: true;
    noPortScan: true;
    noWslScanWithoutUserPath: true;
    noDockerScan: true;
    noExternalRuntimeExecution: true;
    noCredentialSerialization: true;
    noLiveToolBinding: true;
  };
  commands: {
    ask: 'zavorth external-agent-onboarding';
    inspectPath: 'zavorth external-agent-onboarding --path <path> --consent';
    inspectApproximatePath: 'zavorth external-agent-onboarding --approx-path <path> --consent';
    inspectCli: 'zavorth external-agent-onboarding --command <cli> --consent';
    inspectEndpoint: 'zavorth external-agent-onboarding --endpoint <url> --consent';
    json: 'npm run zavorth:external-agent-onboarding:json';
    check: 'npm run zavorth:external-agent-onboarding:check --silent';
  };
};
