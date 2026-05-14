import type {
  OperationalParityGate,
  OperationalParityGap,
  OperationalParitySnapshot,
} from './OperationalParityToolingContract.js';

export const ZAVORTH_PARITY_CERTIFICATION_CONTRACT_VERSION = '2026-05-04.phase-9';

export type ParityCertificationProfile =
  | 'private-absorption'
  | 'release-candidate'
  | 'public-launch';

export type ParityCertificationStatus = 'certified' | 'conditional' | 'blocked';

export type ParityCertificationGateStatus = 'pass' | 'warn' | 'fail' | 'waived';

export type ParityCertificationGateSeverity = 'blocking' | 'required' | 'advisory';

export type ParityCertificationGateKind =
  | 'snapshot'
  | 'phase'
  | 'gap-budget'
  | 'plugin-registry'
  | 'safety-policy'
  | 'command'
  | 'documentation';

export type ParityCertificationWaiver = {
  id: string;
  gateId: string;
  approved: boolean;
  reason: string;
  acceptedBy: string;
  expiresAt: string | null;
};

export type ParityCertificationGate = {
  id: string;
  kind: ParityCertificationGateKind;
  severity: ParityCertificationGateSeverity;
  status: ParityCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  reason: string;
  nextAction: string;
  sourceCommand: string | null;
  sourceGaps: string[];
  waiver: ParityCertificationWaiver | null;
};

export type ParityCertificationNextPhase =
  | 'Fase 10 - P0 Gap Closure'
  | 'Fase 11 - P1 Provider Adapter Runtime'
  | 'Fase 12 - Native Capability Closure'
  | 'Fase 13 - Remaining Runtime Decisions'
  | 'Release certification profile hardening';

export type ParityCertificationReceipt = {
  id: string;
  gateId: string;
  generatedAt: string;
  status: ParityCertificationGateStatus;
  command: string | null;
  evidence: string;
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type ParityCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PARITY_CERTIFICATION_CONTRACT_VERSION;
  profile: ParityCertificationProfile;
  status: ParityCertificationStatus;
  summary: {
    gates: number;
    passed: number;
    warned: number;
    failed: number;
    waived: number;
    blockingFailures: number;
    requiredWarnings: number;
    releaseReady: boolean;
    sourceOperationalStatus: OperationalParitySnapshot['status'];
    sourceOpenGaps: number;
    sourceP0Gaps: number;
    sourceP1Gaps: number;
    sourceP2Gaps: number;
    generatedPluginManifests: number;
    pluginCapabilities: number;
    receipts: number;
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    liveDeviceRequired: false;
    liveMemoryWriteRequired: false;
    filesystemReadRequired: false;
    secretValuesSerialized: false;
  };
  source: {
    operationalContractVersion: OperationalParitySnapshot['contractVersion'];
    operationalGeneratedAt: string;
    doctorCommand: string;
    doctorJsonCommand: string;
    staticGateCommand: string;
    typecheckCommand: string;
  };
  gates: ParityCertificationGate[];
  receipts: ParityCertificationReceipt[];
  blockers: ParityCertificationGate[];
  warnings: ParityCertificationGate[];
  waivers: ParityCertificationWaiver[];
  sourceGaps: OperationalParityGap[];
  sourceGates: OperationalParityGate[];
  recommendations: {
    nextPhase: ParityCertificationNextPhase;
    minimumAction: string;
    releaseDecision: string;
  };
  commands: {
    certify: string;
    certifyJson: string;
    staticGate: string;
    sourceDoctor: string;
    focusedTests: string[];
    typecheck: string;
    nextPhase: ParityCertificationNextPhase;
  };
  policy: {
    certificationOnly: true;
    consumesOperationalSnapshot: true;
    noExternalCalls: true;
    noLiveSends: true;
    noDeviceAccess: true;
    noMemoryWrites: true;
    noArtifactBodyReads: true;
    waiversMustBeExplicit: true;
    secretsSerialized: false;
  };
};
