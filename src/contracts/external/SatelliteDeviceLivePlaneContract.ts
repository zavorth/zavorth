import type { LiveReadinessStatus } from '../LiveReadinessContract.js';

export const ZAVORTH_SATELLITE_DEVICE_LIVE_PLANE_CONTRACT_VERSION = '2026-05-05.live-gate-11' as const;

export type SatelliteDeviceLiveTargetId =
  | 'device-pair'
  | 'phone-control'
  | 'bonjour'
  | 'satellite-pwa'
  | 'satellite-backend';

export type SatelliteDeviceLiveCapability =
  | 'device.invoke'
  | 'device.info'
  | 'camera.capture'
  | 'location.read'
  | 'notifications.send'
  | 'device.confirm'
  | 'haptics.vibrate';

export type SatelliteDeviceLiveMode =
  | 'pairing-claim'
  | 'heartbeat'
  | 'camera-capture'
  | 'geolocation'
  | 'notifications'
  | 'haptic'
  | 'webauthn-confirmation'
  | 'offline-queue'
  | 'device-doctor'
  | 'native-wrapper-decision'
  | 'bonjour-discovery';

export type SatelliteDeviceLiveStatus =
  | 'device-pair-live'
  | 'phone-control-live'
  | 'bonjour-decision-live'
  | 'satellite-pwa-live'
  | 'satellite-backend-live'
  | 'blocked';

export type SatelliteDeviceLiveAdapterFamily =
  | 'node-mesh-pairing'
  | 'satellite-phone-control'
  | 'bonjour-discovery-decision'
  | 'satellite-pwa-host'
  | 'satellite-backend-queue';

export type SatelliteDeviceLiveGateKind =
  | 'pairing-claim'
  | 'heartbeat'
  | 'camera-capture'
  | 'geolocation'
  | 'notifications'
  | 'haptic'
  | 'webauthn-confirmation'
  | 'offline-queue'
  | 'device-doctor'
  | 'bonjour-discovery'
  | 'native-wrapper-decision'
  | 'sensitive-approval'
  | 'unsupported-native-explicit'
  | 'artifact-receipt'
  | 'configured-doctor'
  | 'dry-smoke'
  | 'staging-live-smoke'
  | 'redacted-receipt';

export type SatelliteDeviceLiveGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type SatelliteDeviceLiveConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  secretEnv: string[];
  artifactEnv: string[];
  secretValuesSerialized: false;
};

export type SatelliteDeviceLiveGate = {
  kind: SatelliteDeviceLiveGateKind;
  status: SatelliteDeviceLiveGateStatus;
  evidence: string;
  command: string | null;
};

export type SatelliteDeviceLiveReceipt = {
  id: string;
  targetId: SatelliteDeviceLiveTargetId;
  status: SatelliteDeviceLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: SatelliteDeviceLiveCapability[];
  adapterFamily: SatelliteDeviceLiveAdapterFamily;
  modes: SatelliteDeviceLiveMode[];
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  artifactFirst: true;
  sensitiveCommandsRequireApproval: true;
  unsupportedNativeApisExplicit: true;
  secretValuesSerialized: false;
};

export type SatelliteDeviceLiveEntry = {
  targetId: SatelliteDeviceLiveTargetId;
  status: SatelliteDeviceLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: SatelliteDeviceLiveCapability[];
  adapterFamily: SatelliteDeviceLiveAdapterFamily;
  modes: SatelliteDeviceLiveMode[];
  adapterTarget: string;
  serviceTargets: string[];
  configSchema: SatelliteDeviceLiveConfigSchema;
  gates: SatelliteDeviceLiveGate[];
  gaps: string[];
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  receipt: SatelliteDeviceLiveReceipt;
};

export type SatelliteDeviceLivePlaneSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SATELLITE_DEVICE_LIVE_PLANE_CONTRACT_VERSION;
  gate: 'satellite-device-live-plane';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    targets: 5;
    pairingTargets: number;
    heartbeatTargets: number;
    cameraTargets: number;
    geolocationTargets: number;
    notificationTargets: number;
    hapticTargets: number;
    webAuthnTargets: number;
    offlineQueueTargets: number;
    deviceDoctorTargets: number;
    bonjourDecisionTargets: number;
    nativeWrapperDecisionTargets: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    blocked: number;
    deviceMarkedLiveWithoutPairing: false;
    sensitiveInvokeBypassesTrust: false;
    unsupportedNativeApisHidden: false;
    liveIoRequiredByActivationReviewCheck: false;
    secretValuesSerialized: false;
  };
  entries: SatelliteDeviceLiveEntry[];
  receipts: SatelliteDeviceLiveReceipt[];
  policy: {
    noLiveIoDuringActivationReviewCheck: true;
    pairingClaimRequired: true;
    heartbeatRequired: true;
    sensitiveCommandsRequireDeviceTrust: true;
    cameraLocationConfirmationSmokeRequired: true;
    unsupportedNativeApisMustBeExplicit: true;
    offlineQueueRequired: true;
    deviceDoctorRequired: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    noSecretsSerialized: true;
  };
  commands: {
    check: 'npm run satellite-device-live-plane:check --silent';
    doctor: 'npm run satellite-device-live-plane -- --profile configured';
    stagingLiveSmoke: 'npm run satellite-device-live-plane -- --profile staging-live --target <target> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextAction: 'Memory, Artifacts And Runtime Executor Live Closure';
  };
};
