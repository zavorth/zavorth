import type {
  CapabilityNormalizationFamily,
  CapabilityPrimitiveRuntimeStatus,
} from '../CapabilityNormalizationContract.js';

export const ZAVORTH_RUNTIME_FAMILY_CLOSURE_CONTRACT_VERSION = '2026-05-04.worker-6' as const;

export type RuntimeFamilyClosureStatus =
  | 'closed'
  | 'attention'
  | 'blocked';

export type RuntimeFamilyClosureItem =
  | 'C6-media'
  | 'C7-voice'
  | 'C8-web'
  | 'C9-docs-diagnostics-migration';

export type RuntimeFamilyProofStepKind =
  | 'contract-boundary'
  | 'service-path'
  | 'adapter-boundary'
  | 'policy-gate'
  | 'mode-coverage'
  | 'artifact-receipt'
  | 'dry-run-harness';

export type RuntimeFamilyProofStep = {
  kind: RuntimeFamilyProofStepKind;
  status: 'passed' | 'blocked';
  evidence: string;
};

export type RuntimeFamilyClosureReceipt = {
  id: string;
  closureItem: RuntimeFamilyClosureItem;
  primitiveId: string;
  status: 'passed' | 'blocked';
  artifactKinds: string[];
  receiptKinds: string[];
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type RuntimeFamilyClosureEntry = {
  closureItem: RuntimeFamilyClosureItem;
  family: CapabilityNormalizationFamily;
  primitiveId: string;
  status: 'runtime-proof' | 'blocked';
  runtimeStatus: CapabilityPrimitiveRuntimeStatus;
  sourceModules: string[];
  modes: string[];
  contractTarget: string;
  serviceTarget: string;
  adapterTarget: string;
  artifactKinds: string[];
  receiptKinds: string[];
  steps: RuntimeFamilyProofStep[];
  receipt: RuntimeFamilyClosureReceipt;
};

export type RuntimeFamilyClosureSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_RUNTIME_FAMILY_CLOSURE_CONTRACT_VERSION;
  status: RuntimeFamilyClosureStatus;
  summary: {
    closureItems: number;
    primitives: number;
    sourceModules: number;
    modeProofs: number;
    runtimeProofs: number;
    blocked: number;
    receipts: number;
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    liveDeviceRequired: false;
    filesystemWriteRequired: false;
    artifactBodyReadRequired: false;
    secretValuesSerialized: false;
  };
  entries: RuntimeFamilyClosureEntry[];
  receipts: RuntimeFamilyClosureReceipt[];
  policy: {
    noLiveProviderCalls: true;
    noLiveVoiceCalls: true;
    noLiveBrowserNetwork: true;
    noFilesystemWrites: true;
    artifactFirst: true;
    receiptRequired: true;
    unsupportedModesMustBeExplicit: true;
  };
  commands: {
    check: 'npm run runtime-family-closure:check --silent';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextWorker: 'Worker 7 - final certification and documentation';
  };
};

