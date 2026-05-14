import type { CapabilityActivationFlowStatus } from './CapabilityActivationFlowContract.js';
import type { CapabilitySetupQueueTicket } from './CapabilitySetupQueueContract.js';

export const CAPABILITY_SETUP_EXECUTOR_CONTRACT_VERSION = 'zavorth-capability-setup-executor/v1';

export type CapabilitySetupExecutorStatus =
  | 'ticket_missing'
  | 'blocked_not_ready'
  | 'waiting_owner_approval'
  | 'dry_run_ready'
  | 'activation_request_created'
  | 'already_processed';

export type CapabilitySetupExecutorInput = {
  ticketId: string;
  actorLabel?: string | null;
  ownerApprovalId?: string | null;
  confirmOwnerControlledActivation?: boolean;
  dryRun?: boolean;
};

export type CapabilitySetupActivationRequest = {
  id: string;
  createdAt: string;
  ticketId: string;
  packId: string | null;
  targetItemId: string | null;
  actorLabel: string | null;
  ownerApprovalId: string;
  activationFlowStatus: CapabilityActivationFlowStatus;
  command: string;
  queueEventIds: string[];
  flowReceiptIds: string[];
  gates: {
    ticketReady: true;
    ownerApprovalPresent: true;
    ownerConfirmationPresent: true;
    dryRunOnly: true;
  };
  policy: {
    ownerApprovalBeforeLive: true;
    rawSecretsSerialized: false;
    liveActivationApplied: false;
    externalRootsAllowed: false;
    queueConsumed: true;
  };
};

export type CapabilitySetupExecutorReceipt = {
  id: string;
  at: string;
  ticketId: string;
  action:
    | 'ticket-missing'
    | 'ticket-not-ready'
    | 'owner-approval-required'
    | 'activation-request-planned'
    | 'activation-request-created'
    | 'already-processed';
  summary: string;
};

export type CapabilitySetupExecutorResult = {
  contractVersion: typeof CAPABILITY_SETUP_EXECUTOR_CONTRACT_VERSION;
  generatedAt: string;
  status: CapabilitySetupExecutorStatus;
  dryRun: boolean;
  ticket: CapabilitySetupQueueTicket | null;
  activationRequest: CapabilitySetupActivationRequest | null;
  receipt: CapabilitySetupExecutorReceipt;
  safety: {
    ownerApprovalBeforeLive: true;
    rawSecretsSerialized: false;
    liveActivationApplied: false;
    externalRootsAllowed: false;
    queueExecutorOnly: true;
  };
  narrative: {
    headline: string;
    nextAction: string;
  };
};

export type CapabilitySetupExecutorSnapshot = {
  contractVersion: typeof CAPABILITY_SETUP_EXECUTOR_CONTRACT_VERSION;
  generatedAt: string;
  policy: {
    requestLedgerAppendOnly: true;
    ownerApprovalBeforeLive: true;
    rawSecretsSerialized: false;
    liveActivationApplied: false;
    externalRootsAllowed: false;
    requestLedgerPath: string;
  };
  summary: {
    totalRequests: number;
    latestRequestId: string | null;
  };
  requests: CapabilitySetupActivationRequest[];
};

