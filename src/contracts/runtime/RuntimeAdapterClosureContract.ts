import type { ChannelMeshConsistencySnapshot } from '../ChannelMeshConsistencyContract.js';
import type { ReleaseCertificationSnapshot } from '../ReleaseCertificationContract.js';
import type { ProviderMeshReadinessSnapshot } from '../ProviderMeshReadinessContract.js';

export const ZAVORTH_RUNTIME_ADAPTER_CLOSURE_CONTRACT_VERSION = '2026-05-04.checkpoint-11';

export type RuntimeAdapterClosureStatus = 'closed' | 'attention';

export type RuntimeAdapterClosureSurface = 'provider.call' | 'channel.message';

export type RuntimeAdapterClosurePreviousTier =
  | 'p1-provider-template'
  | 'p1-channel-webhook-template'
  | 'p1-channel-bridge-template'
  | 'p1-channel-bot-template';

export type RuntimeAdapterClosureStrategy =
  | 'generic-provider-runtime'
  | 'local-provider-runtime'
  | 'anthropic-provider-runtime'
  | 'webhook-channel-runtime'
  | 'bot-api-channel-runtime'
  | 'local-bridge-channel-runtime';

export type RuntimeAdapterClosureEntry = {
  surface: RuntimeAdapterClosureSurface;
  id: string;
  previousTier: RuntimeAdapterClosurePreviousTier;
  closureStrategy: RuntimeAdapterClosureStrategy;
  status: 'generic-compatible' | 'adapter-backed';
  remainingTier: 'none';
  runtimeSupported: true;
  liveExternalCallRequired: false;
  liveChannelSendRequired: false;
  receipt: string;
};

export type RuntimeAdapterClosureSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_RUNTIME_ADAPTER_CLOSURE_CONTRACT_VERSION;
  status: RuntimeAdapterClosureStatus;
  summary: {
    providerTemplatesClosed: number;
    channelTemplatesClosed: number;
    remainingProviderTemplates: number;
    remainingProviderUnsupported: number;
    remainingChannelTemplates: number;
    remainingChannelUnsupported: number;
    certificationP1Gaps: number;
    certificationStatus: ReleaseCertificationSnapshot['status'];
    releaseReady: boolean;
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    secretValuesSerialized: false;
  };
  entries: RuntimeAdapterClosureEntry[];
  providerSnapshot: Pick<ProviderMeshReadinessSnapshot, 'contractVersion' | 'summary'>;
  channelSnapshot: Pick<ChannelMeshConsistencySnapshot, 'contractVersion' | 'summary'>;
  certification: Pick<ReleaseCertificationSnapshot, 'contractVersion' | 'profile' | 'status' | 'summary'>;
  commands: {
    check: string;
    providerConsistency: string;
    channelConsistency: string;
    certify: string;
    nextStage: 'Native Capability Closure';
  };
  policy: {
    closureIsRuntimeClassificationOnly: true;
    noProviderCalls: true;
    noLiveChannelSends: true;
    noSecretsSerialized: true;
    unsupportedChannelsStayVisible: true;
  };
};
