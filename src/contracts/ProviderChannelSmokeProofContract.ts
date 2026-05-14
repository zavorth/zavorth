import type { ChannelMeshParitySnapshot } from './ChannelMeshParityContract.js';
import type { ProviderMeshParitySnapshot } from './ProviderMeshParityContract.js';

export const ZAVORTH_PROVIDER_CHANNEL_SMOKE_PROOF_CONTRACT_VERSION = '2026-05-04.worker-5' as const;

export type ProviderChannelSmokeProofStatus =
  | 'closed'
  | 'attention'
  | 'blocked';

export type ProviderChannelSmokeProofMode =
  | 'mock-live-harness'
  | 'operator-live-ready';

export type ProviderChannelSmokeProofSurface =
  | 'provider.call'
  | 'channel.message';

export type ProviderChannelSmokeStepKind =
  | 'runtime-target-resolution'
  | 'credential-policy-redaction'
  | 'provider-request-envelope'
  | 'provider-artifact-receipt'
  | 'channel-inbound-normalization'
  | 'channel-outbound-plan'
  | 'channel-delivery-receipt';

export type ProviderChannelSmokeStep = {
  id: string;
  kind: ProviderChannelSmokeStepKind;
  status: 'passed' | 'blocked';
  command: string;
  evidence: string;
  liveExternalCallRequired: false;
  liveChannelSendRequired: false;
  secretValuesSerialized: false;
};

export type ProviderChannelSmokeReceipt = {
  id: string;
  surface: ProviderChannelSmokeProofSurface;
  sourceName: string;
  status: 'passed' | 'blocked';
  summary: string;
  artifactKind: string;
  receiptKind: string;
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type ProviderSmokeProof = {
  sourceName: string;
  normalizedSourceName: string;
  status: 'mock-proven' | 'blocked';
  adapterStrategy: string;
  runtimeAdapter: string;
  routeKind: string;
  credentialRefs: string[];
  requestEnvelope: {
    providerId: string;
    routeId: string;
    modelId: string | null;
    capabilities: string[];
    modalities: string[];
    dryRun: true;
  };
  steps: ProviderChannelSmokeStep[];
  receipt: ProviderChannelSmokeReceipt;
};

export type ChannelSmokeProof = {
  sourceName: string;
  normalizedSourceName: string;
  canonicalChannelId: string;
  status: 'mock-proven' | 'blocked';
  transportStrategy: string;
  credentialRefs: string[];
  inboundEnvelope: {
    channelId: string;
    sessionId: string;
    userId: string;
    normalized: boolean;
    dryRun: true;
  };
  outboundEnvelope: {
    channelId: string;
    recipients: string[];
    dryRun: true;
    attachmentsSupported: boolean;
  };
  steps: ProviderChannelSmokeStep[];
  receipt: ProviderChannelSmokeReceipt;
};

export type ProviderChannelSmokeProofSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PROVIDER_CHANNEL_SMOKE_PROOF_CONTRACT_VERSION;
  status: ProviderChannelSmokeProofStatus;
  mode: ProviderChannelSmokeProofMode;
  summary: {
    providers: number;
    providerSmokeProofs: number;
    providerBlocked: number;
    channels: number;
    channelSmokeProofs: number;
    channelBlocked: number;
    receipts: number;
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    secretValuesSerialized: false;
  };
  providerProofs: ProviderSmokeProof[];
  channelProofs: ChannelSmokeProof[];
  receipts: ProviderChannelSmokeReceipt[];
  providerSnapshot: Pick<ProviderMeshParitySnapshot, 'contractVersion' | 'summary'>;
  channelSnapshot: Pick<ChannelMeshParitySnapshot, 'contractVersion' | 'summary'>;
  policy: {
    noProviderNetworkCalls: true;
    noLiveChannelSends: true;
    noSecretsSerialized: true;
    mockHarnessIsDeterministic: true;
    liveModeRequiresOperatorApproval: true;
    artifactsAndReceiptsRequired: true;
  };
  commands: {
    check: 'npm run provider-channel-smoke-proof:check --silent';
    providerParity: 'npm run provider-mesh-parity:check --silent';
    channelParity: 'npm run channel-mesh-parity:check --silent';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextWorker: 'Worker 6 - media/voice/web/docs diagnostics closure';
  };
};

