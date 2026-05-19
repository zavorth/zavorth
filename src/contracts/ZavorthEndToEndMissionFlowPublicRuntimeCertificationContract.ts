import type {
  CanonicalApprovalsDTO,
  CanonicalChannelMeshDTO,
  CanonicalChatPreviewDTO,
  CanonicalMissionsDTO,
  CanonicalProviderMeshDTO,
  CanonicalReceiptsDTO,
  CanonicalRuntimeHealthDTO,
  CanonicalRuntimeStatusDTO,
} from './public/rest/runtime-api-v1-dto.js';
import type { PublicRuntimeEvent } from './public/events/sse.js';
import type { ZavorthSchedulerPerceptionDeviceLiveCompletionSnapshot } from './ZavorthSchedulerPerceptionDeviceLiveCompletionContract.js';
import type { ZavorthSubagentSkillLiveCompletionSnapshot } from './ZavorthSubagentSkillLiveCompletionContract.js';

export const ZAVORTH_END_TO_END_MISSION_FLOW_PUBLIC_RUNTIME_CERTIFICATION_CONTRACT_VERSION =
  '2026-05-14.checkpoint-8-end-to-end-mission-flow-public-runtime-certification' as const;

export type ZavorthEndToEndMissionFlowCertificationStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthEndToEndMissionFlowCertificationEntry = {
  id: string;
  label: string;
  status: ZavorthEndToEndMissionFlowCertificationStatus;
  surface: 'runtime-api' | 'mission' | 'approval' | 'receipt' | 'provider' | 'channel' | 'subagent-skill' | 'scheduler-perception-device' | 'events' | 'safety';
  evidence: string[];
  userVisible: boolean;
  commandCenterCanExecute: false;
  nextAction: string | null;
};

export type ZavorthEndToEndMissionFlowPublicRuntimeCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_END_TO_END_MISSION_FLOW_PUBLIC_RUNTIME_CERTIFICATION_CONTRACT_VERSION;
  source: 'ZavorthEndToEndMissionFlowPublicRuntimeCertificationService';
  status: ZavorthEndToEndMissionFlowCertificationStatus;
  request: string;
  runtime: {
    status: CanonicalRuntimeStatusDTO;
    health: CanonicalRuntimeHealthDTO;
    providers: CanonicalProviderMeshDTO;
    channels: CanonicalChannelMeshDTO;
    approvals: CanonicalApprovalsDTO;
    receipts: CanonicalReceiptsDTO;
    missions: CanonicalMissionsDTO;
    chat: CanonicalChatPreviewDTO;
    events: {
      schemaVersion: 1;
      surface: 'runtime-events-v1';
      generatedAt: string;
      sessionId: string;
      data: PublicRuntimeEvent[];
      streaming: {
        ssePath: string;
        canonicalEventTypes: PublicRuntimeEvent['type'][];
      };
      safety: {
        commandCenterCanExecute: false;
        policyBrokerRequiredForMutableActions: true;
        rawSecretsSerialized: false;
      };
    };
  };
  subagentSkillCompletion: ZavorthSubagentSkillLiveCompletionSnapshot;
  schedulerPerceptionDeviceCompletion: ZavorthSchedulerPerceptionDeviceLiveCompletionSnapshot;
  entries: ZavorthEndToEndMissionFlowCertificationEntry[];
  summary: {
    entries: number;
    passed: number;
    attention: number;
    blocked: number;
    previewFirst: boolean;
    approvalRequestVisible: boolean;
    receiptReady: boolean;
    missionTraceable: boolean;
    providerReadinessHonest: boolean;
    channelReadinessHonest: boolean;
    subagentSkillReady: boolean;
    schedulerPerceptionDeviceReady: boolean;
    publicRuntimeCanBypassPolicy: false;
    commandCenterCanExecute: false;
    rawSecretsSerialized: false;
    workspaceMutationPerformed: false;
    externalIoPerformed: false;
  };
  dailyUseCertification: {
    userCanAskNaturally: boolean;
    userGetsMissionPreview: boolean;
    userGetsApprovalRequestWhenNeeded: boolean;
    userGetsReceiptEvidence: boolean;
    userCanInspectProvidersAndChannels: boolean;
    liveMutationRequiresApprovalAndReadiness: true;
    dashboardIsProjectionOnly: true;
    cliAndApiShareRuntimeTruth: true;
  };
  safety: {
    policyBrokerRequired: true;
    previewBeforeLiveExecution: true;
    approvalDoesNotExecuteTargetAction: true;
    receiptsRequiredForTrustDecisions: true;
    noRawSecretsSerialized: true;
    noWorkspaceMutationDuringCertification: true;
    noExternalIoDuringCertification: true;
    noRuntimeBypassFromPublicSurfaces: true;
  };
  commands: {
    inspect: 'npm run zavorth:end-to-end-mission-flow-public-runtime-certification';
    inspectJson: 'npm run zavorth:end-to-end-mission-flow-public-runtime-certification:json';
    check: 'npm run zavorth:end-to-end-mission-flow-public-runtime-certification:check --silent';
    nextStage: 'Certification matrix - Live Readiness Evidence and Channel Provider Proof Pack';
  };
};
