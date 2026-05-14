import type {
  CapabilityNormalizationSnapshot,
  CapabilityPrimitiveDefinition,
  CapabilitySourceMapping,
} from './CapabilityNormalizationContract.js';
import type { ParityCertificationSnapshot } from './ParityCertificationContract.js';

export const ZAVORTH_NATIVE_CAPABILITY_CLOSURE_CONTRACT_VERSION = '2026-05-04.phase-12';

export type NativeCapabilityClosureStatus = 'closed' | 'attention';

export type NativeCapabilityClosureStrategy =
  | 'native-speech-contract'
  | 'native-voice-session-contract'
  | 'native-memory-wiki-contract'
  | 'native-file-transfer-contract'
  | 'native-document-extract-contract'
  | 'native-diagnostics-contract'
  | 'native-migration-contract';

export type NativeCapabilityClosureEntry = {
  sourceName: string;
  primitiveId: string;
  family: CapabilityPrimitiveDefinition['family'];
  previousStatus: 'needs-review';
  currentStatus: CapabilitySourceMapping['status'];
  runtimeStatus: CapabilityPrimitiveDefinition['runtimeStatus'];
  closureStrategy: NativeCapabilityClosureStrategy;
  contractTarget: string;
  serviceTarget: string;
  artifactKinds: string[];
  receiptKinds: string[];
  remainingTier: 'none';
  liveExternalCallRequired: false;
  filesystemWriteRequired: false;
  receipt: string;
};

export type NativeCapabilityClosureSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_NATIVE_CAPABILITY_CLOSURE_CONTRACT_VERSION;
  status: NativeCapabilityClosureStatus;
  summary: {
    closedSourceModules: number;
    closedPrimitives: number;
    remainingCapabilityNeedsReview: number;
    remainingCapabilityUnmapped: number;
    certificationP1Gaps: number;
    certificationStatus: ParityCertificationSnapshot['status'];
    releaseReady: boolean;
    liveExternalCallRequired: false;
    filesystemWriteRequired: false;
    secretValuesSerialized: false;
  };
  entries: NativeCapabilityClosureEntry[];
  capabilitySnapshot: Pick<CapabilityNormalizationSnapshot, 'contractVersion' | 'summary'>;
  certification: Pick<ParityCertificationSnapshot, 'contractVersion' | 'profile' | 'status' | 'summary'>;
  commands: {
    check: string;
    capabilityNormalization: string;
    certify: string;
    nextPhase: 'Fase 13 - Remaining Runtime Decisions';
  };
  policy: {
    closureIsContractDeclarationOnly: true;
    noExternalCalls: true;
    noFilesystemWrites: true;
    noSecretsSerialized: true;
    runtimeGapsStayVisible: true;
  };
};
