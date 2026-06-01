import type { CanonicalChannelPlatform } from '../channels/contracts/ChannelMessageContract.js';

export type ChannelPolicyDecision = 'allowed' | 'requires_approval' | 'blocked';

export type ChannelIntentEnvelope = {
  contractVersion: 'channel-intent-envelope/1';
  id: string;
  createdAt: string;
  channel: CanonicalChannelPlatform;
  sender: {
    userId: string;
    chatId: string;
    messageId: string | null;
  };
  normalizedIntent: {
    text: string;
    kind: 'chat' | 'command' | 'mutation_request' | 'outbound_request';
    requestedTools: string[];
    promptInjectionSignals: string[];
    actionCandidates?: Array<{
      actionId: string;
      risk: 'safe' | 'attention' | 'danger' | 'unknown';
      requiresPreview: boolean;
      requiresApproval: boolean;
      score: number;
    }>;
  };
  policyDecision: {
    decision: ChannelPolicyDecision;
    reason: string;
    approvalRequired: boolean;
    recipientPreviewRequired: boolean;
  };
  receipt: {
    id: string;
    status: 'created' | 'blocked' | 'waiting_approval';
  };
  safety: {
    inboundNeverExecutesDirectly: true;
    outboundRequiresPolicy: true;
    shellExecutionBlocked: true;
    secretsRedacted: true;
  };
};
