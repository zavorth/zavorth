import type {
  CapabilitySetupAudience,
  CapabilitySetupConversationInput,
  CapabilitySetupConversationStatus,
  CapabilitySetupSecureRequest,
  CapabilitySetupTask,
} from './CapabilitySetupConversationContract.js';

export const CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION = 'zavorth-capability-setup-queue/v1';

export type CapabilitySetupQueueTicketStatus =
  | CapabilitySetupConversationStatus
  | 'approved'
  | 'rejected'
  | 'archived';

export type CapabilitySetupQueuePriority = 'low' | 'normal' | 'high';

export type CapabilitySetupQueueEventAction =
  | 'ticket-created'
  | 'refreshed'
  | 'secret-ref-attached'
  | 'manual-step-completed'
  | 'readiness-check-completed'
  | 'approval-attached'
  | 'approved'
  | 'rejected'
  | 'archived';

export type CapabilitySetupQueueInputState = {
  text: string | null;
  packId: string | null;
  targetItemId: string | null;
  actorLabel: string | null;
  audience: CapabilitySetupAudience;
  approvalId: string | null;
  providedSecretRefs: string[];
  availableSecretRefs: string[];
  availableEnvKeys: string[];
  availableBinaries: string[];
  completedManualSteps: string[];
  completedReadinessChecks: string[];
  localRoutes: Record<string, boolean>;
};

export type CapabilitySetupQueueCreateInput = CapabilitySetupConversationInput & {
  ticketId?: string | null;
  priority?: CapabilitySetupQueuePriority;
};

export type CapabilitySetupQueueUpdateInput = {
  ticketId: string;
  action:
    | 'refresh'
    | 'attach-secret-ref'
    | 'complete-manual-step'
    | 'complete-readiness-check'
    | 'attach-approval'
    | 'approve'
    | 'reject'
    | 'archive';
  actorLabel?: string | null;
  reason?: string | null;
  secretRef?: string | null;
  manualStep?: string | null;
  readinessCheck?: string | null;
  approvalId?: string | null;
};

export type CapabilitySetupQueueReceipt = {
  id: string;
  ticketId: string;
  action: CapabilitySetupQueueEventAction;
  at: string;
  actorLabel: string | null;
  summary: string;
};

export type CapabilitySetupQueueTicket = {
  id: string;
  createdAt: string;
  updatedAt: string;
  priority: CapabilitySetupQueuePriority;
  status: CapabilitySetupQueueTicketStatus;
  conversationStatus: CapabilitySetupConversationStatus;
  packId: string | null;
  targetItemId: string | null;
  actorLabel: string | null;
  audience: CapabilitySetupAudience;
  redactedText: string | null;
  headline: string;
  nextQuestion: string;
  tasks: CapabilitySetupTask[];
  secureRequests: CapabilitySetupSecureRequest[];
  approvalId: string | null;
  flowStatus: string;
  flowReceiptIds: string[];
  inputState: CapabilitySetupQueueInputState;
  events: CapabilitySetupQueueReceipt[];
  safety: {
    persistentQueue: true;
    rawSecretsSerialized: false;
    liveActivationApplied: false;
    ownerApprovalBeforeLive: true;
  };
};

export type CapabilitySetupQueueSnapshot = {
  contractVersion: typeof CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION;
  generatedAt: string;
  policy: {
    persistentQueue: true;
    appendOnlyLedger: true;
    rawSecretsSerialized: false;
    liveActivationApplied: false;
    ownerApprovalBeforeLive: true;
    statePath: string;
    ledgerPath: string;
  };
  summary: {
    total: number;
    open: number;
    waitingSecrets: number;
    waitingReadiness: number;
    waitingApproval: number;
    readyForOwner: number;
    closed: number;
  };
  tickets: CapabilitySetupQueueTicket[];
  narrative: {
    headline: string;
    nextAction: string;
  };
};
