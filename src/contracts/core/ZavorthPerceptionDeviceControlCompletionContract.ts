import type { ZavorthNativeCompanionDeviceSnapshot } from '../ZavorthNativeCompanionDeviceContract.js';
import type { ZavorthPerceptionCrossSurfaceCertificationSnapshot } from './ZavorthPerceptionCrossSurfaceCertificationContract.js';

export const ZAVORTH_PERCEPTION_DEVICE_CONTROL_COMPLETION_CONTRACT_VERSION =
  '2026-05-14.gate-10-perception-device-control-completion' as const;

export type ZavorthPerceptionDeviceControlCompletionStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthPerceptionDeviceControlCompletionEntry = {
  id: string;
  label: string;
  kind: 'pc' | 'browser' | 'android' | 'natural-command' | 'artifact' | 'safety';
  status: ZavorthPerceptionDeviceControlCompletionStatus;
  readyForDailyUse: boolean;
  liveReadyWhenHostConfigured: boolean;
  requiresApprovalForMutation: boolean;
  evidence: string[];
  blockers: string[];
};

export type ZavorthPerceptionDeviceControlCompletionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PERCEPTION_DEVICE_CONTROL_COMPLETION_CONTRACT_VERSION;
  source: 'ZavorthPerceptionDeviceControlCompletionService';
  status: ZavorthPerceptionDeviceControlCompletionStatus;
  perception: ZavorthPerceptionCrossSurfaceCertificationSnapshot;
  device: ZavorthNativeCompanionDeviceSnapshot;
  entries: ZavorthPerceptionDeviceControlCompletionEntry[];
  naturalCommands: Array<{
    utterance: string;
    route: 'pc-vision' | 'browser-vision' | 'browser-control' | 'android-observe' | 'android-control';
    defaultMode: 'read-only' | 'preview' | 'approval-required';
    commandHint: string;
  }>;
  summary: {
    entries: number;
    passed: number;
    attention: number;
    blocked: number;
    pcScreenshotReadOnlyReady: boolean;
    browserViewReady: boolean;
    browserControlPolicyGated: boolean;
    androidObserveReady: boolean;
    androidControlPolicyGated: boolean;
    naturalRoutingReady: boolean;
    visualArtifactsInReceipts: boolean;
    rawSecretsSerialized: false;
    workspaceMutationPerformed: false;
    externalIoPerformed: false;
  };
  safety: {
    policyBrokerRequired: true;
    pcObservationReadOnlyByDefault: true;
    browserControlRequiresReadinessAndApproval: true;
    androidTapTypeInstallRequiresApproval: true;
    adbRequiresOwnerAuthorizedDevice: true;
    terminalAutomationBypassBlocked: boolean;
    secretScreenAutomationBlocked: boolean;
    visualArtifactsRedacted: boolean;
    noLiveDeviceMutationDuringCertification: true;
    rawSecretsSerialized: false;
  };
  commands: {
    inspect: 'npm run zavorth:perception-device-control-completion';
    inspectJson: 'npm run zavorth:perception-device-control-completion:json';
    check: 'npm run zavorth:perception-device-control-completion:check --silent';
    nextAction: 'ZavorthControl Final Product Polish';
  };
};
