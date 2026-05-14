import type { ZavorthNativeCompanionDeviceSnapshot } from './ZavorthNativeCompanionDeviceContract.js';
import type { ZavorthPerceptionCrossSurfaceCertificationSnapshot } from './ZavorthPerceptionCrossSurfaceCertificationContract.js';
import type { ZavorthScheduledTaskDailyOpsReadinessSnapshot } from './ZavorthScheduledTaskDailyOpsReadinessContract.js';

export const ZAVORTH_SCHEDULER_PERCEPTION_DEVICE_LIVE_COMPLETION_CONTRACT_VERSION =
  '2026-05-14.phase-7-scheduler-perception-device-live-completion' as const;

export type ZavorthSchedulerPerceptionDeviceCompletionStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthSchedulerPerceptionDeviceCompletionEntry = {
  id: string;
  label: string;
  kind: 'scheduler' | 'perception' | 'device' | 'safety';
  status: ZavorthSchedulerPerceptionDeviceCompletionStatus;
  dailyUseReady: boolean;
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  hostDependency: string | null;
  defaultBlockReason: string | null;
  evidence: string[];
};

export type ZavorthSchedulerPerceptionDeviceLiveCompletionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SCHEDULER_PERCEPTION_DEVICE_LIVE_COMPLETION_CONTRACT_VERSION;
  source: 'ZavorthSchedulerPerceptionDeviceLiveCompletionService';
  status: ZavorthSchedulerPerceptionDeviceCompletionStatus;
  scheduler: ZavorthScheduledTaskDailyOpsReadinessSnapshot;
  perception: ZavorthPerceptionCrossSurfaceCertificationSnapshot;
  device: ZavorthNativeCompanionDeviceSnapshot;
  entries: ZavorthSchedulerPerceptionDeviceCompletionEntry[];
  summary: {
    entries: number;
    passed: number;
    attention: number;
    blocked: number;
    schedulerDailyUseReady: boolean;
    perceptionReadOnlyReady: boolean;
    deviceCompanionReady: boolean;
    hostSpecificLiveChecksRequired: boolean;
    rawSecretsSerialized: false;
    workspaceMutationPerformed: false;
    externalIoPerformed: false;
  };
  liveCompletion: {
    scheduledTasksCanOperateDaily: boolean;
    scheduledLiveTicksUseGateway: boolean;
    perceptionCanRouteNaturally: boolean;
    pcBrowserAndroidReadOnlyCertified: boolean;
    deviceCompanionBridgeCertified: boolean;
    androidAdbRequiresHostAuthorization: true;
    browserLiveRequiresSidecarReadiness: true;
    computerMutationRequiresApproval: true;
    defaultRouteRequiresReadinessProof: true;
  };
  safety: {
    policyBrokerRequired: true;
    noDirectSchedulerDispatch: boolean;
    noUnapprovedComputerMutation: boolean;
    noSecretScreenAutomation: boolean;
    noTerminalAutomationBypass: boolean;
    visualArtifactsRedacted: boolean;
    deviceActionsOwnerGated: boolean;
    rawSecretsSerialized: false;
  };
  commands: {
    inspect: 'npm run zavorth:scheduler-perception-device-live-completion';
    inspectJson: 'npm run zavorth:scheduler-perception-device-live-completion:json';
    check: 'npm run zavorth:scheduler-perception-device-live-completion:check --silent';
    nextPhase: 'Phase 8 - End-to-End Mission Flow and Public Runtime Certification';
  };
};
