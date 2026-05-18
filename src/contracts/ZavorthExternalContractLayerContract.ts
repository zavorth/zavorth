import type {
  ZavorthExternalCapabilityInventoryProbeRuntimeId,
  ZavorthExternalCapabilityInventoryStatus,
} from './ZavorthExternalCapabilityInventoryContract.js';
import type {
  ZavorthExternalRuntimeNaturalFirstRoute,
} from './ZavorthExternalRuntimeBridgeContract.js';

export const ZAVORTH_EXTERNAL_CONTRACT_LAYER_VERSION =
  'zavorth-external-contract-layer/1' as const;

export type ZavorthExternalContractLayerStatus =
  | 'contract-layer-ready'
  | 'attention'
  | 'blocked';

export type ZavorthExternalRuntimeContractEnvelopeKind =
  | 'runtime'
  | 'capability'
  | 'skill'
  | 'tool'
  | 'channel'
  | 'session'
  | 'event'
  | 'artifact'
  | 'approval'
  | 'health'
  | 'worker';

export type ZavorthExternalRuntimeContractRisk =
  | 'low'
  | 'medium'
  | 'high'
  | 'blocked';

export type ZavorthExternalRuntimeContractTrustScope =
  | 'diagnostic-only'
  | 'quarantined-advisory'
  | 'policy-gated'
  | 'approval-gated';

export type ZavorthExternalRuntimeContractErrorCode =
  | 'missing_required_field'
  | 'unsupported_envelope_kind'
  | 'source_identity_leak'
  | 'raw_secret_value'
  | 'direct_tool_exposure'
  | 'live_execution_requested'
  | 'missing_provenance';

export type ZavorthExternalRuntimeExternalRuntimeDescriptor = {
  id: ZavorthExternalCapabilityInventoryProbeRuntimeId;
  diagnosticLabel: string;
  publicName: 'Zavorth';
  sourceNameQuarantined: true;
  role: 'architecture-reference' | 'acp-compatible-sidecar' | 'compatibility-fixture';
  trustScope: ZavorthExternalRuntimeContractTrustScope;
  enabledByDefault: false;
  liveExecutionAllowed: false;
  credentialPolicy: {
    secretRefsOnly: true;
    rawSecretValuesAccepted: false;
    credentialsStayBehindPorts: true;
  };
  ingressPolicy: {
    freeTextEntrypoint: 'ZavorthAgentGateway';
    noDirectLlmEntry: true;
    noDirectUserReply: true;
  };
};

export type ZavorthExternalRuntimeEnvelopeSchema = {
  kind: ZavorthExternalRuntimeContractEnvelopeKind;
  contractName: string;
  zavorthOwnerService: string;
  commandCenterProjection: string;
  requiredFields: string[];
  naturalFirstRoute: ZavorthExternalRuntimeNaturalFirstRoute;
  risk: ZavorthExternalRuntimeContractRisk;
  approvalRequiredForLive: boolean;
  provenanceRequired: boolean;
  invalidDataErrors: ZavorthExternalRuntimeContractErrorCode[];
};

export type ZavorthExternalRuntimeExternalEnvelopeInput = {
  kind?: string;
  sourceRuntimeId?: string;
  sourceRef?: string;
  sourcePath?: string | null;
  sourceLabel?: string | null;
  publicName?: string | null;
  title?: string | null;
  payload?: Record<string, unknown> | null;
  risk?: ZavorthExternalRuntimeContractRisk | null;
  requestedLiveAction?: boolean | null;
  directToolExposure?: boolean | null;
  rawSecretValue?: string | null;
  provenance?: {
    observedAt?: string | null;
    evidence?: string[] | null;
  } | null;
};

export type ZavorthExternalRuntimeNormalizedEnvelope = {
  envelopeId: string;
  kind: ZavorthExternalRuntimeContractEnvelopeKind;
  sourceRuntimeId: ZavorthExternalCapabilityInventoryProbeRuntimeId;
  sourceRef: string;
  sourcePath: string | null;
  diagnosticLabel: string;
  publicName: 'Zavorth';
  naturalFirstRoute: ZavorthExternalRuntimeNaturalFirstRoute;
  trustScope: ZavorthExternalRuntimeContractTrustScope;
  risk: ZavorthExternalRuntimeContractRisk;
  approvalRequiredForLive: boolean;
  payloadClassification: 'metadata-only' | 'advisory-data' | 'approval-gated-intent';
  provenance: {
    required: boolean;
    observedAt: string;
    evidence: string[];
  };
  policy: {
    noRuntimeMixing: true;
    noSourceRuntimeCodeExecution: true;
    noDirectToolExposure: true;
    noDirectUserReply: true;
    noRawSecrets: true;
    sourceNamesDiagnosticsOnly: true;
  };
};

export type ZavorthExternalRuntimeNormalizationError = {
  code: ZavorthExternalRuntimeContractErrorCode;
  severity: 'error' | 'warning';
  fieldPath: string;
  message: string;
  remediation: string;
};

export type ZavorthExternalRuntimeNormalizationReceipt = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_EXTERNAL_CONTRACT_LAYER_VERSION;
  status: 'normalized' | 'blocked';
  inputKind: string | null;
  envelope: ZavorthExternalRuntimeNormalizedEnvelope | null;
  errors: ZavorthExternalRuntimeNormalizationError[];
  warnings: ZavorthExternalRuntimeNormalizationError[];
  safety: {
    sourceRuntimeCodeExecuted: false;
    liveExecutionPerformed: false;
    directToolExposureAllowed: false;
    rawSecretSerialized: false;
    publicIdentityLeakAllowed: false;
  };
};

export type ZavorthExternalContractLayerSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_EXTERNAL_CONTRACT_LAYER_VERSION;
  status: ZavorthExternalContractLayerStatus;
  planId: '291 - Plano Zavorth External Runtime Absorption';
  phase: 'phase-1-contract-layer';
  previousInventoryStatus: ZavorthExternalCapabilityInventoryStatus;
  runtimeDescriptors: ZavorthExternalRuntimeExternalRuntimeDescriptor[];
  envelopeSchemas: ZavorthExternalRuntimeEnvelopeSchema[];
  normalizationFixtures: ZavorthExternalRuntimeNormalizationReceipt[];
  namingQuarantinePolicy: {
    publicAgentName: 'Zavorth';
    externalNamesDiagnosticsOnly: true;
    noSourceNameAsCanonicalField: true;
    commandCenterMayShowAdapterDetailsOnly: true;
    replyPipelineMayNotUseSourceIdentity: true;
  };
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    runtimeDescriptors: number;
    envelopeSchemas: number;
    normalizedFixtures: number;
    blockedFixtures: number;
    structuredErrors: number;
    approvalRequiredSchemas: number;
    publicIdentityLeaksAllowed: 0;
    liveExecutionPerformed: false;
    sourceRuntimeCodeExecuted: false;
  };
  safety: {
    sourceRuntimeCodeExecuted: false;
    liveExecutionPerformed: false;
    dependencyInstallPerformed: false;
    sidecarsStarted: false;
    toolsExposed: false;
    publicIdentityLeak: false;
  };
  commands: {
    inspect: 'npm run zavorth:external-contract-layer';
    inspectJson: 'npm run zavorth:external-contract-layer:json';
    check: 'npm run zavorth:external-contract-layer:check --silent';
    nextPhase: '291 Phase 2 - Native Engine Absorption';
  };
};
