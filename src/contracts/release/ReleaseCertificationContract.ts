import type {
  OperationalReadinessGate,
  OperationalReadinessGap,
  OperationalReadinessSnapshot,
} from '../OperationalReadinessToolingContract.js';

export const ZAVORTH_RELEASE_CERTIFICATION_CONTRACT_VERSION = '2026-05-04.checkpoint-9';

export type ReleaseCertificationProfile =
  | 'private-absorption'
  | 'release-candidate'
  | 'public-launch';

export type ReleaseCertificationStatus = 'certified' | 'conditional' | 'blocked';

export type ReleaseCertificationGateStatus = 'pass' | 'warn' | 'fail' | 'waived';

export type ReleaseCertificationGateSeverity = 'blocking' | 'required' | 'advisory';

export type ReleaseCertificationGateKind =
  | 'snapshot'
  | 'phase'
  | 'gap-budget'
  | 'plugin-registry'
  | 'safety-policy'
  | 'command'
  | 'documentation';

export type ReleaseCertificationWaiver = {
  id: string;
  gateId: string;
  approved: boolean;
  reason: string;
  acceptedBy: string;
  expiresAt: string | null;
};

export type ReleaseCertificationGate = {
  id: string;
  kind: ReleaseCertificationGateKind;
  severity: ReleaseCertificationGateSeverity;
  status: ReleaseCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  reason: string;
  nextAction: string;
  sourceCommand: string | null;
  sourceGaps: string[];
  waiver: ReleaseCertificationWaiver | null;
};

export type ReleaseCertificationNextPhase =
  | 'P0 Gap Closure'
  | 'P1 Provider Adapter Runtime'
  | 'Native Capability Closure'
  | 'Remaining Runtime Decisions'
  | 'Release certification profile hardening';

export type ReleaseCertificationReceipt = {
  id: string;
  gateId: string;
  generatedAt: string;
  status: ReleaseCertificationGateStatus;
  command: string | null;
  evidence: string;
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type ReleaseCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_RELEASE_CERTIFICATION_CONTRACT_VERSION;
  profile: ReleaseCertificationProfile;
  status: ReleaseCertificationStatus;
  summary: {
    gates: number;
    passed: number;
    warned: number;
    failed: number;
    waived: number;
    blockingFailures: number;
    requiredWarnings: number;
    releaseReady: boolean;
    sourceOperationalStatus: OperationalReadinessSnapshot['status'];
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
    operationalContractVersion: OperationalReadinessSnapshot['contractVersion'];
    operationalGeneratedAt: string;
    doctorCommand: string;
    doctorJsonCommand: string;
    staticGateCommand: string;
    typecheckCommand: string;
  };
  gates: ReleaseCertificationGate[];
  receipts: ReleaseCertificationReceipt[];
  blockers: ReleaseCertificationGate[];
  warnings: ReleaseCertificationGate[];
  waivers: ReleaseCertificationWaiver[];
  sourceGaps: OperationalReadinessGap[];
  sourceGates: OperationalReadinessGate[];
  recommendations: {
    nextStage: ReleaseCertificationNextPhase;
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
    nextStage: ReleaseCertificationNextPhase;
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
