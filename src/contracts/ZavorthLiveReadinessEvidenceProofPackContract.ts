import type { ChannelMeshSnapshot } from './ChannelMeshContract.js';
import type { ProviderChannelSmokeProofSnapshot } from './ProviderChannelSmokeProofContract.js';
import type { ZavorthProviderReadinessMatrixSnapshot } from './ZavorthProviderReadinessMatrixContract.js';

export const ZAVORTH_LIVE_READINESS_EVIDENCE_PROOF_PACK_CONTRACT_VERSION =
  '2026-05-14.phase-9-live-readiness-evidence-proof-pack' as const;

export type ZavorthLiveReadinessEvidenceStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthLiveReadinessEvidenceEntry = {
  id: string;
  label: string;
  kind: 'provider' | 'channel' | 'smoke-proof' | 'policy';
  status: ZavorthLiveReadinessEvidenceStatus;
  total: number;
  liveReady: number;
  defaultRouteAllowed: number;
  catalogReadyButNotLive: number;
  blocked: number;
  evidence: string[];
  operatorAction: string | null;
};

export type ZavorthLiveReadinessEvidenceProofPackSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_LIVE_READINESS_EVIDENCE_PROOF_PACK_CONTRACT_VERSION;
  source: 'ZavorthLiveReadinessEvidenceProofPackService';
  status: ZavorthLiveReadinessEvidenceStatus;
  mode: 'safe-proof-pack';
  providerMatrix: ZavorthProviderReadinessMatrixSnapshot;
  channelMesh: ChannelMeshSnapshot;
  smokeProof: ProviderChannelSmokeProofSnapshot;
  entries: ZavorthLiveReadinessEvidenceEntry[];
  summary: {
    entries: number;
    passed: number;
    attention: number;
    blocked: number;
    providerTotal: number;
    providerLiveReady: number;
    providerDefaultRouteAllowed: number;
    channelTotal: number;
    channelLiveReady: number;
    channelDefaultRouteAllowed: number;
    catalogReadyButNotLive: number;
    smokeProofReceipts: number;
    rawSecretsSerialized: false;
    providerNetworkUsed: false;
    liveChannelSendPerformed: false;
  };
  policy: {
    catalogSupportIsNotLiveProof: true;
    defaultRoutingRequiresLiveProof: true;
    liveProviderProbeRequiresExplicitOperatorAction: true;
    liveChannelActionRequiresPolicyBroker: true;
    smokeProofDoesNotUseExternalIo: true;
    dashboardCanExecute: false;
    rawSecretsSerialized: false;
  };
  commands: {
    inspect: 'npm run zavorth:live-readiness-evidence-proof-pack';
    inspectJson: 'npm run zavorth:live-readiness-evidence-proof-pack:json';
    check: 'npm run zavorth:live-readiness-evidence-proof-pack:check --silent';
    providerMatrix: 'npm run zavorth:provider-live-matrix --silent';
    channelMesh: 'npm run channels:mesh --silent';
    smokeProof: 'npm run provider-channel-smoke-proof:check --silent';
    nextPhase: 'Phase 10 - Final Daily Runtime Closure and Release Gate';
  };
};
