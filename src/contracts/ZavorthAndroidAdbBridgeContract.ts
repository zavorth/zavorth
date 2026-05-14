import type {
  ZavorthVisionControlPlaneSnapshot,
  ZavorthVisionPolicyDecision,
} from './ZavorthVisionControlPlaneContract.js';

export const ZAVORTH_ANDROID_ADB_BRIDGE_CONTRACT_VERSION =
  '2026-05-11.android-adb-bridge-phase-4' as const;

export type ZavorthAndroidAdbAction =
  | 'device.status'
  | 'device.list'
  | 'device.doctor'
  | 'device.observe'
  | 'device.screenshot'
  | 'device.ui_dump'
  | 'device.logcat'
  | 'device.plan'
  | 'device.approve'
  | 'device.cancel';

export type ZavorthAndroidAdbStatus =
  | 'ready'
  | 'attention'
  | 'adb-unavailable'
  | 'no-device'
  | 'unauthorized'
  | 'redacted'
  | 'approval-required'
  | 'blocked';

export type ZavorthAndroidDeviceState =
  | 'authorized'
  | 'unauthorized'
  | 'offline'
  | 'unknown';

export type ZavorthAndroidAdbPlanStepKind =
  | 'observe-screen'
  | 'capture-screenshot'
  | 'dump-ui'
  | 'read-current-activity'
  | 'read-logcat'
  | 'tap'
  | 'swipe'
  | 'type-text'
  | 'keyevent'
  | 'start-intent'
  | 'install'
  | 'uninstall'
  | 'cancel';

export type ZavorthAndroidAdbRiskKind =
  | 'adb-unavailable'
  | 'device-missing'
  | 'device-unauthorized'
  | 'screen-locked-or-sensitive'
  | 'credential-or-mfa-screen'
  | 'banking-or-payment'
  | 'wallet-or-seed'
  | 'destructive-adb'
  | 'install-uninstall'
  | 'raw-log-secret';

export type ZavorthAndroidAdbInput = {
  action?: ZavorthAndroidAdbAction;
  deviceSerial?: string | null;
  objective?: string | null;
  packageName?: string | null;
  activityName?: string | null;
  screenText?: string | null;
  uiXml?: string | null;
  logcatText?: string | null;
  targetText?: string | null;
  payload?: string | null;
  planId?: string | null;
  approvalId?: string | null;
  runId?: string | null;
  sourceSurface?: string | null;
  actorId?: string | null;
  live?: boolean;
  maxLogLines?: number | null;
  artifactRoot?: string | null;
};

export type ZavorthAndroidDeviceInfo = {
  serial: string;
  state: ZavorthAndroidDeviceState;
  model: string | null;
  product: string | null;
  transportId: string | null;
  selected: boolean;
};

export type ZavorthAndroidAdbArtifactRef = {
  id: string;
  kind: 'screenshot' | 'ui-dump' | 'logcat' | 'activity';
  path: string | null;
  mime: string;
  displayName: string;
  hash: string | null;
  rawContentSerialized: false;
  redactedBeforeProvider: true;
};

export type ZavorthAndroidAdbPlanStep = {
  id: string;
  kind: ZavorthAndroidAdbPlanStepKind;
  label: string;
  adbArgsPreview: string[];
  targetText: string | null;
  payloadPreview: string | null;
  mutation: boolean;
  requiresApproval: boolean;
  blockedByDefault: boolean;
  risk: 'low' | 'medium' | 'high' | 'forbidden';
};

export type ZavorthAndroidAdbReceipt = {
  id: string;
  kind: 'policy' | 'adb' | 'device' | 'doctor' | 'vision' | 'plan' | 'approval' | 'artifact' | 'block' | 'cancel';
  status: ZavorthVisionPolicyDecision | 'done' | 'blocked' | 'approval-required' | 'skipped' | 'attention';
  reason: string;
  rawSecretSerialized: false;
};

export type ZavorthAndroidAdbSnapshot = {
  contractVersion: typeof ZAVORTH_ANDROID_ADB_BRIDGE_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthAndroidAdbBridgeService';
  status: ZavorthAndroidAdbStatus;
  action: ZavorthAndroidAdbAction;
  adb: {
    binary: string;
    available: boolean;
    liveRequested: boolean;
    readOnlyCommandsExecuted: number;
    mutationCommandsExecuted: 0;
    lastError: string | null;
  };
  device: {
    selectedSerial: string | null;
    state: ZavorthAndroidDeviceState;
    connected: boolean;
    authorized: boolean;
    devices: ZavorthAndroidDeviceInfo[];
    packageName: string | null;
    activityName: string | null;
    screenState: 'unknown' | 'available' | 'locked-or-sensitive';
  };
  doctor: {
    adbAvailable: boolean;
    deviceConnected: boolean;
    authorization: 'authorized' | 'unauthorized' | 'missing' | 'unknown';
    screenReadable: boolean;
    packageVisible: boolean;
    activityVisible: boolean;
  };
  evidence: {
    screenshot: ZavorthAndroidAdbArtifactRef | null;
    uiDump: ZavorthAndroidAdbArtifactRef | null;
    logcat: ZavorthAndroidAdbArtifactRef | null;
    currentActivity: string | null;
    preferredSource: 'provided' | 'adb-ui-dump' | 'adb-logcat' | 'adb-screenshot' | 'none';
    redactionCount: number;
  };
  plan: {
    id: string | null;
    status: 'none' | 'planned' | 'approval-required' | 'approved-preview' | 'blocked' | 'cancelled-preview';
    steps: ZavorthAndroidAdbPlanStep[];
    mutationRequested: boolean;
    approvalRequired: boolean;
    approvalId: string | null;
  };
  policy: {
    decision: ZavorthVisionPolicyDecision;
    profile: 'android-adb-phase-4';
    reason: string;
    mutationAllowed: false;
    providerPayloadMinimized: true;
  };
  hardBlocks: {
    matched: boolean;
    risks: ZavorthAndroidAdbRiskKind[];
    reason: string | null;
  };
  safety: {
    readOnlyAdbOnlyWithoutApproval: true;
    tapSwipeTextKeyRequireApproval: true;
    intentRequiresApproval: true;
    installUninstallBlockedByDefault: true;
    destructiveAdbBlocked: true;
    screenshotArtifactRefOnly: true;
    uiDumpRedacted: true;
    logcatFilteredRedacted: true;
    noRawImageSerialized: true;
    rawSecretSerialized: false;
    liveMutationPerformed: false;
  };
  vision: ZavorthVisionControlPlaneSnapshot;
  receipts: ZavorthAndroidAdbReceipt[];
  commands: {
    status: '/device status';
    doctor: '/device android doctor';
    screenshot: '/device screenshot';
    inspect: '/device inspect';
    plan: '/device plan';
    approve: '/device approve <plan>';
    cancel: '/device cancel';
    nextPhase: 'Phase 5 - Natural Agent Use And Subagent Perception';
  };
  nextSafeAction: string;
};
