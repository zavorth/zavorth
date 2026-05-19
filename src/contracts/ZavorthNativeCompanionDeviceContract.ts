export const ZAVORTH_NATIVE_COMPANION_DEVICE_CONTRACT_VERSION = '2026-05-05.checkpoint-6' as const;

export type ZavorthNativeRuntimeTarget =
  | 'satellite-pwa'
  | 'desktop-companion'
  | 'android-wrapper'
  | 'ios-wrapper'
  | 'macos-wrapper'
  | 'macos-local-tts'
  | 'shared-device-runtime';

export type ZavorthNativeCapabilityId =
  | 'camera.capture'
  | 'location.read'
  | 'notifications.send'
  | 'device.confirm'
  | 'share.invoke'
  | 'offline.queue'
  | 'haptics.vibrate'
  | 'desktop.clipboard'
  | 'desktop.screen'
  | 'desktop.notification'
  | 'local.tts.mlx'
  | 'device.profile'
  | 'device.pairing';

export type ZavorthNativeCapabilityStatus =
  | 'available'
  | 'simulated'
  | 'owner-gated'
  | 'unsupported'
  | 'blocked';

export type ZavorthNativeDecision =
  | 'implemented'
  | 'implemented-browser-first'
  | 'implemented-desktop-bridge'
  | 'implemented-optional-runtime'
  | 'owner-gated'
  | 'waived';

export type ZavorthNativePermissionMode =
  | 'not-required'
  | 'browser-permission'
  | 'device-trust-required'
  | 'operator-approval-required'
  | 'owner-decision-required';

export type ZavorthNativeCapabilityReceipt = {
  id: string;
  target: ZavorthNativeRuntimeTarget;
  capabilityId: ZavorthNativeCapabilityId;
  status: ZavorthNativeCapabilityStatus;
  permissionMode: ZavorthNativePermissionMode;
  artifactFirst: true;
  liveExternalIoPerformed: false;
  localProofPerformed: boolean;
  enabledByDefault: boolean;
  secretValuesSerialized: false;
  reason: string;
};

export type ZavorthNativeParityEntry = {
  target: ZavorthNativeRuntimeTarget;
  decision: ZavorthNativeDecision;
  capabilities: ZavorthNativeCapabilityId[];
  status: 'covered' | 'owner-gated' | 'waived' | 'blocked';
  bridge: 'satellite-capability-bridge' | 'desktop-companion-bridge' | 'mlx-tts-runtime-adapter' | 'owner-scope-ledger';
  enabledByDefault: false;
  ownerDecisionRequired: boolean;
  receipts: ZavorthNativeCapabilityReceipt[];
  notes: string[];
};

export type ZavorthSatelliteCapabilityBridgeProof = {
  status: 'passed' | 'failed';
  nodeId: string;
  pairingClaimed: boolean;
  heartbeatAccepted: boolean;
  queuedInvocationIds: string[];
  claimedAssignmentIds: string[];
  completedCapabilityIds: string[];
  cameraArtifactPath: string | null;
  sensitiveApprovalBlocked: boolean;
  offlineQueueDelivered: boolean;
  deviceDoctorOk: boolean;
  unsupportedNativeApisExplicit: true;
  secretValuesSerialized: false;
  receipt: {
    id: string;
    artifactFirst: true;
    liveExternalIoPerformed: false;
    localProofPerformed: true;
    secretValuesSerialized: false;
  };
};

export type ZavorthDesktopCompanionBridgeProof = {
  status: 'passed' | 'attention';
  platform: NodeJS.Platform;
  profileId: string;
  availableCapabilities: ZavorthNativeCapabilityId[];
  gatedCapabilities: ZavorthNativeCapabilityId[];
  receipts: ZavorthNativeCapabilityReceipt[];
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthMlxTtsRuntimeReceipt = {
  id: string;
  status: 'available' | 'owner-gated' | 'unsupported' | 'blocked';
  platform: NodeJS.Platform;
  commandRef: string | null;
  approvalRequired: boolean;
  processSpawned: false;
  enabledByDefault: false;
  artifactFirst: true;
  secretValuesSerialized: false;
  reason: string;
};

export type ZavorthNativeCompanionDeviceSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_NATIVE_COMPANION_DEVICE_CONTRACT_VERSION;
  status: 'passed' | 'failed';
  phase: 6;
  statement: 'Zavorth native companion and device capabilities are exposed through browser-first, desktop and optional runtime bridges with artifact-first receipts.';
  runtime: {
    platform: NodeJS.Platform;
    arch: string;
    nodeVersion: string;
    cwd: string;
  };
  parity: ZavorthNativeParityEntry[];
  satellite: ZavorthSatelliteCapabilityBridgeProof;
  desktop: ZavorthDesktopCompanionBridgeProof;
  mlxTts: ZavorthMlxTtsRuntimeReceipt;
  summary: {
    targets: number;
    targetsCovered: number;
    targetsOwnerGated: number;
    capabilitiesReported: number;
    capabilityReceipts: number;
    pwaBridgeFunctional: boolean;
    desktopBridgeFunctional: boolean;
    mlxTtsOptionalRuntime: boolean;
    nativeWrappersOwnerGated: boolean;
    liveExternalIoPerformed: false;
    enabledByDefault: false;
    secretValuesSerialized: false;
  };
  policy: {
    noSourceAppCodeCopy: true;
    browserPwaFirst: true;
    desktopCompanionOptional: true;
    androidIosMacosWrappersOwnerGated: true;
    mlxTtsNeverEnabledByDefault: true;
    cameraLocationRequirePermission: true;
    biometricOrDeviceConfirmRequiresTrust: true;
    shareSheetArtifactFirst: true;
    offlineQueueRequired: true;
    unsupportedNativeApisExplicit: true;
  };
  commands: {
    inspect: 'npm run zavorth-native-companion-device-pack --silent';
    inspectJson: 'npm run zavorth-native-companion-device-pack:json --silent';
    check: 'npm run zavorth-native-companion-device-pack:check --silent';
    qa: 'npm run qa:zavorth-native-companion-device-pack --silent';
    liveMlxTts: 'npm run zavorth-native-companion-device-pack -- --mlx-tts "hello" --approval-id <id>';
    nextStage: 'Surface controls - QA, Security And Release Certification Pack';
  };
};
