import type { ChannelMeshParitySnapshot } from './ChannelMeshParityContract.js';
import type { ParityCertificationSnapshot } from './ParityCertificationContract.js';
import type { ProviderMeshParitySnapshot } from './ProviderMeshParityContract.js';

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
    certificationStatus: ParityCertificationSnapshot['status'];
    releaseReady: boolean;
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    secretValuesSerialized: false;
  };
  entries: RuntimeAdapterClosureEntry[];
  providerSnapshot: Pick<ProviderMeshParitySnapshot, 'contractVersion' | 'summary'>;
  channelSnapshot: Pick<ChannelMeshParitySnapshot, 'contractVersion' | 'summary'>;
  certification: Pick<ParityCertificationSnapshot, 'contractVersion' | 'profile' | 'status' | 'summary'>;
  commands: {
    check: string;
    providerParity: string;
    channelParity: string;
    certify: string;
    nextStage: 'Etapa 12 - Native Capability Closure';
  };
  policy: {
    closureIsRuntimeClassificationOnly: true;
    noProviderCalls: true;
    noLiveChannelSends: true;
    noSecretsSerialized: true;
    unsupportedChannelsStayVisible: true;
  };
};
