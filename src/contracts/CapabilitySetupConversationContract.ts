import type {
  CapabilityActivationFlowInput,
  CapabilityActivationFlowSnapshot,
} from './CapabilityActivationFlowContract.js';
import type { CapabilityPackReadinessCheckKind } from './CapabilityPackReadinessContract.js';

export const CAPABILITY_SETUP_CONVERSATION_CONTRACT_VERSION = 'zavorth-capability-setup-conversation/v1';

export type CapabilitySetupAudience = 'everyday' | 'technical' | 'owner';

export type CapabilitySetupConversationStatus =
  | 'needs_choice'
  | 'needs_secret'
  | 'needs_readiness'
  | 'needs_approval'
  | 'ready_for_owner'
  | 'blocked';

export type CapabilitySetupTask = {
  id: string;
  label: string;
  status: 'done' | 'next' | 'later' | 'blocked';
  plainSummary: string;
  whyItMatters: string;
};

export type CapabilitySetupSecureRequest = {
  id: string;
  label: string;
  inputMode: 'secure-secret-entry' | 'confirmation' | 'local-check';
  rawValueAcceptedInChat: false;
  plainPrompt: string;
};

export type CapabilitySetupExplanationCard = {
  id: string;
  kind: CapabilityPackReadinessCheckKind | 'approval' | 'target' | 'general';
  title: string;
  plainText: string;
};

export type CapabilitySetupConversationInput = CapabilityActivationFlowInput & {
  audience?: CapabilitySetupAudience;
};

export type CapabilitySetupConversationSnapshot = {
  contractVersion: typeof CAPABILITY_SETUP_CONVERSATION_CONTRACT_VERSION;
  generatedAt: string;
  audience: CapabilitySetupAudience;
  status: CapabilitySetupConversationStatus;
  request: {
    redactedText: string | null;
    packId: string | null;
    targetItemId: string | null;
  };
  reply: {
    headline: string;
    body: string;
    nextQuestion: string;
    reassurance: string;
  };
  tasks: CapabilitySetupTask[];
  secureRequests: CapabilitySetupSecureRequest[];
  explanationCards: CapabilitySetupExplanationCard[];
  flowSnapshot: CapabilityActivationFlowSnapshot;
  safety: {
    noJargonByDefault: true;
    rawSecretsSerialized: false;
    liveActivationApplied: false;
    approvalStillRequired: boolean;
    receiptsAvailable: boolean;
  };
};
