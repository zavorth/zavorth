export const ZAVORTH_SUPREMACY_PARITY_PACK_CONTRACT_VERSION =
  'zavorth-supremacy-parity-pack/1' as const;

export type ZavorthSupremacyParityStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthSupremacyParityPhaseId =
  | 'freeze-baseline'
  | 'provider-parity'
  | 'cli-tui-premium'
  | 'gateway-multichannel'
  | 'execution-backends'
  | 'skill-ecosystem'
  | 'skill-curator'
  | 'dashboard-polish'
  | 'final-certification';

export type ZavorthSupremacyParityPhase = {
  id: ZavorthSupremacyParityPhaseId;
  label: string;
  status: ZavorthSupremacyParityStatus;
  evidence: string[];
  command: string;
};

export type ZavorthGatewayMatrixChannel = {
  id: 'cli' | 'web' | 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'signal' | 'email' | 'api';
  label: string;
  status: 'live' | 'configured' | 'configurable';
  naturalFirst: boolean;
  smartCommands: boolean;
  approvalIntentResolver: boolean;
  receipts: boolean;
  redaction: boolean;
  richActions: boolean;
  nextCommand: string;
};

export type ZavorthExecutionBackendMatrixEntry = {
  id: 'local-supervised' | 'docker' | 'wsl' | 'ssh' | 'vercel-sandbox' | 'daytona' | 'generic-container';
  label: string;
  status: 'available' | 'configurable' | 'not-configured';
  isolation: 'process' | 'container' | 'vm' | 'remote-container' | 'remote-shell';
  approvalRequiredForHighRisk: true;
  allowedCwdRequired: true;
  timeoutRequired: true;
  envAllowlistRequired: true;
  noSecretDump: true;
  receiptRequired: true;
  liveByDefault: false;
  nextCommand: string;
};

export type ZavorthSkillEcosystemNativeCategory = {
  id:
    | 'dev'
    | 'research'
    | 'ops'
    | 'security'
    | 'browser'
    | 'files-docs'
    | 'data'
    | 'communication'
    | 'finance-transaction-safe'
    | 'media';
  skillId: string;
  title: string;
  risk: 'low' | 'medium' | 'high';
  requiredApproval: 'none' | 'tool-preview' | 'owner-approval';
};

export type ZavorthSupremacyParitySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SUPREMACY_PARITY_PACK_CONTRACT_VERSION;
  surface: 'supremacy-parity-pack';
  status: ZavorthSupremacyParityStatus;
  summary: {
    phases: number;
    passed: number;
    attention: number;
    blocked: number;
    providerRoutes: number;
    requiredProviderParityRoutes: number;
    missingProviderParityRoutes: string[];
    gatewayChannels: number;
    executionBackends: number;
    nativeSkillCategories: number;
    conceptualExternalReferenceLeaks: number;
    securityReady: boolean;
  };
  phases: ZavorthSupremacyParityPhase[];
  providerParity: {
    requiredRoutes: string[];
    missingRoutes: string[];
    routeCount: number;
    catalogOnlyUntilLiveProof: true;
    noRawSecretsSerialized: true;
  };
  gatewayMatrix: {
    channels: ZavorthGatewayMatrixChannel[];
    safety: {
      allChannelsUseNaturalFirstContract: boolean;
      allSensitiveActionsUseApprovalResolver: boolean;
      notConfiguredIsExplicit: true;
    };
  };
  executionBackends: {
    entries: ZavorthExecutionBackendMatrixEntry[];
    safety: {
      noBackendLiveByDefault: true;
      highRiskRequiresApproval: true;
      receiptRequired: true;
      secretDumpBlocked: true;
    };
  };
  skillEcosystem: {
    nativeCategories: ZavorthSkillEcosystemNativeCategory[];
    draftImportsOnly: true;
    noExternalCodeCopy: true;
    mutationRequiresApproval: true;
  };
  commands: {
    baseline: 'zavorth supremacy-parity --json';
    providers: 'zavorth providers parity';
    tui: 'zavorth tui';
    gatewayMatrix: 'zavorth gateway matrix';
    executionBackends: 'zavorth execution-backends';
    skillEcosystem: 'zavorth skill-ecosystem';
    skillCurator: 'zavorth skill-curator';
    check: 'npm run zavorth:supremacy-parity:check --silent';
  };
  safety: {
    noConceptualExternalReferences: boolean;
    officialModelNamesMayRemain: true;
    noLiveProviderClaimWithoutProof: true;
    noSkillMutationWithoutApproval: true;
    noExternalBackendLiveWithoutExplicitConfig: true;
    noDashboardStyleFork: true;
  };
};
