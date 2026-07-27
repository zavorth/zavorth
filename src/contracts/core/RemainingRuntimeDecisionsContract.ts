import type { ChannelMeshConsistencySnapshot } from '../ChannelMeshConsistencyContract.js';
import type { MemoryArtifactConsistencySnapshot } from '../MemoryArtifactConsistencyContract.js';
import type { ReleaseCertificationSnapshot } from '../ReleaseCertificationContract.js';
import type { SatelliteAppConsistencySnapshot } from '../SatelliteAppConsistencyContract.js';

export const ZAVORTH_REMAINING_RUNTIME_DECISIONS_CONTRACT_VERSION = '2026-05-04.gate-13';

export type RemainingRuntimeDecisionStatus = 'closed' | 'attention';

export type RemainingRuntimeDecisionEntry = {
  id:
    | 'tlon-local-bridge'
    | 'memory-wiki-runtime'
    | 'satellite-pwa-first'
    | 'memory-vector-store-backend';
  previousGap: 'channel-unsupported-routes' | 'memory-wiki-template' | 'satellite-native-wrapper-decision' | 'memory-vector-backend-choice';
  surface: 'channel.message' | 'memory.wiki' | 'satellite.native-wrapper' | 'memory.vector.backend';
  decision: string;
  resultingStatus: 'adapter-backed' | 'backend-ready';
  receipt: string;
  remainingTier: 'none';
  liveExternalCallRequired: false;
  liveChannelSendRequired: false;
  liveDeviceRequired: false;
  liveMemoryWriteRequired: false;
  secretValuesSerialized: false;
};

export type RemainingRuntimeDecisionsSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMAINING_RUNTIME_DECISIONS_CONTRACT_VERSION;
  status: RemainingRuntimeDecisionStatus;
  summary: {
    closedDecisions: number;
    remainingChannelUnsupported: number;
    remainingSatelliteDecisions: number;
    remainingMemoryTemplates: number;
    remainingMemoryDecisions: number;
    certificationOpenGaps: number;
    certificationStatus: ReleaseCertificationSnapshot['status'];
    releaseReady: boolean;
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    liveDeviceRequired: false;
    liveMemoryWriteRequired: false;
    secretValuesSerialized: false;
  };
  entries: RemainingRuntimeDecisionEntry[];
  channelSnapshot: Pick<ChannelMeshConsistencySnapshot, 'contractVersion' | 'summary'>;
  satelliteSnapshot: Pick<SatelliteAppConsistencySnapshot, 'contractVersion' | 'summary' | 'nativeWrapperDecision'>;
  memorySnapshot: Pick<MemoryArtifactConsistencySnapshot, 'contractVersion' | 'summary'>;
  certification: Pick<ReleaseCertificationSnapshot, 'contractVersion' | 'profile' | 'status' | 'summary'>;
  commands: {
    check: string;
    certify: string;
    nextAction: 'Release certification profile hardening';
  };
  policy: {
    decisionsAreRuntimeScoped: true;
    noExternalCalls: true;
    noLiveChannelSends: true;
    noLiveDeviceAccess: true;
    noMemoryWrites: true;
    noSecretsSerialized: true;
  };
};
