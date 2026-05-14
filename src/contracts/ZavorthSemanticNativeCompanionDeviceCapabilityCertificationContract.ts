import type {
  ZavorthNativeCapabilityId,
  ZavorthNativeCapabilityStatus,
  ZavorthNativeCompanionDeviceSnapshot,
  ZavorthNativePermissionMode,
  ZavorthNativeRuntimeTarget,
} from './ZavorthNativeCompanionDeviceContract.js';

export const ZAVORTH_SEMANTIC_NATIVE_COMPANION_DEVICE_CAPABILITY_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.semantic-s6' as const;

export type ZavorthSemanticNativeCompanionDeviceCapabilityCertificationStatus =
  | 'passed'
  | 'failed';

export type ZavorthSemanticNativeCompanionDeviceCapabilityClaimKind =
  | 'target-coverage'
  | 'capability-coverage'
  | 'pwa-bridge'
  | 'desktop-bridge'
  | 'shared-device-runtime'
  | 'optional-runtime-policy'
  | 'wrapper-owner-gate'
  | 'permission-policy'
  | 'live-io-policy'
  | 'receipt-policy'
  | 'unsupported-native-api-policy'
  | 'no-app-code-copy-policy'
  | 'unsafe-native-policy';

export type ZavorthSemanticNativeCompanionDeviceCapabilityClaimStatus =
  | 'covered'
  | 'replaced'
  | 'owner-gated'
  | 'rejected'
  | 'gap';

export type ZavorthSemanticNativeCompanionDeviceCapabilityClaimPriority =
  | 'P0'
  | 'P1'
  | 'P2';

export type ZavorthSemanticNativeCompanionDeviceCapabilityClaim = {
  id: string;
  kind: ZavorthSemanticNativeCompanionDeviceCapabilityClaimKind;
  status: ZavorthSemanticNativeCompanionDeviceCapabilityClaimStatus;
  priority: ZavorthSemanticNativeCompanionDeviceCapabilityClaimPriority;
  target?: ZavorthNativeRuntimeTarget;
  capabilityId?: ZavorthNativeCapabilityId;
  capabilityStatus?: ZavorthNativeCapabilityStatus;
  permissionMode?: ZavorthNativePermissionMode;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds: string[];
  notes: string[];
};

export type ZavorthSemanticNativeCompanionDeviceCapabilityScenario = {
  id:
    | 'pwa-pairing-offline-queue'
    | 'sensitive-device-confirm-blocked-without-trust'
    | 'desktop-screen-clipboard-report-only'
    | 'optional-local-tts-blocked-without-approval';
  status: 'passed' | 'failed';
  evidence: string[];
  receiptIds: string[];
  liveExternalIoPerformed: false;
  processSpawned: false;
  secretValuesSerialized: false;
};

export type ZavorthSemanticNativeCompanionDeviceCapabilityCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SEMANTIC_NATIVE_COMPANION_DEVICE_CAPABILITY_CERTIFICATION_CONTRACT_VERSION;
  status: ZavorthSemanticNativeCompanionDeviceCapabilityCertificationStatus;
  semanticPhase: 'S6';
  statement: 'Native companion and device capability semantics are certified as browser-first, optional, permissioned and receipt-backed Zavorth runtimes.';
  packStatus: ZavorthNativeCompanionDeviceSnapshot['status'];
  packContractVersion: ZavorthNativeCompanionDeviceSnapshot['contractVersion'];
  runtime: ZavorthNativeCompanionDeviceSnapshot['runtime'];
  claims: ZavorthSemanticNativeCompanionDeviceCapabilityClaim[];
  scenarios: ZavorthSemanticNativeCompanionDeviceCapabilityScenario[];
  summary: {
    semanticClaims: number;
    covered: number;
    replaced: number;
    ownerGated: number;
    rejected: number;
    gaps: number;
    p0Claims: number;
    p1Claims: number;
    p2Claims: number;
    receiptBackedClaims: number;
    targetClaimsCertified: number;
    capabilityClaimsCertified: number;
    bridgeClaimsCertified: number;
    permissionPoliciesCertified: number;
    wrapperGateClaimsCertified: number;
    optionalRuntimeClaimsCertified: number;
    scenariosPassed: number;
    capabilityStatusCounts: Record<ZavorthNativeCapabilityStatus, number>;
    targetStatuses: Record<string, ZavorthNativeCompanionDeviceSnapshot['parity'][number]['status']>;
    liveExternalIoPerformed: false;
    enabledByDefault: false;
    processSpawnedByDefault: false;
    secretValuesSerialized: false;
    sourceCodeCopied: false;
  };
  policy: {
    semanticClaimRequiredForEveryNativeTarget: true;
    semanticClaimRequiredForEveryNativeCapability: true;
    browserPwaFirst: true;
    desktopCompanionOptional: true;
    androidIosMacosWrappersOwnerGated: true;
    mlxTtsNeverEnabledByDefault: true;
    cameraLocationRequirePermission: true;
    sensitiveDeviceConfirmRequiresTrust: true;
    screenClipboardReportOnlyWithoutApproval: true;
    shareSheetArtifactFirst: true;
    offlineQueueRequired: true;
    unsupportedNativeApisExplicit: true;
    localTtsRequiresApproval: true;
    noLiveIoDuringCertification: true;
    noSourceAppCodeCopy: true;
    artifactFirstReceipts: true;
    rawSecretValuesRejected: true;
    defaultNativeAccessRejected: true;
    gapsBlockRelease: true;
  };
  commands: {
    inspect: 'npm run semantic-native-companion-device-capability-certification --silent';
    inspectJson: 'npm run semantic-native-companion-device-capability-certification:json --silent';
    check: 'npm run semantic-native-companion-device-capability-certification:check --silent';
    qa: 'npm run qa:semantic-native-companion-device-capability-certification --silent';
    nextPhase: 'S7 - QA, Security And Release Certification Semantics';
  };
};
