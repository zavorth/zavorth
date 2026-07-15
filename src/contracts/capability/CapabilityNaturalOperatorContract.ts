import type { CapabilityConsoleSnapshot } from './CapabilityConsoleContract.js';
import type { NaturalSetupAssistantSnapshot } from '../NaturalSetupAssistantContract.js';
import type { CapabilitySetupQueueTicket } from './CapabilitySetupQueueContract.js';
import type { CapabilitySetupExecutorResult } from './CapabilitySetupExecutorContract.js';

export const CAPABILITY_NATURAL_OPERATOR_CONTRACT_VERSION = 'zavorth-capability-natural-operator/v1';

export type CapabilityNaturalOperatorAction =
  | 'show_console'
  | 'show_queue'
  | 'run_readiness'
  | 'create_setup_ticket'
  | 'prepare_activation_request'
  | 'blocked';

export type CapabilityNaturalOperatorInput = {
  text: string;
  /** Structured action only — free text never keyword-selects product actions. */
  action?: CapabilityNaturalOperatorAction | null;
  actorLabel?: string | null;
  packId?: string | null;
  targetItemId?: string | null;
  ticketId?: string | null;
  ownerApprovalId?: string | null;
  confirmOwnerControlledActivation?: boolean;
  execute?: boolean;
  createTicket?: boolean;
  availableSecretRefs?: string[];
  availableEnvKeys?: string[];
  availableBinaries?: string[];
  completedManualSteps?: string[];
  completedReadinessChecks?: string[];
  localRoutes?: Record<string, boolean>;
};

export type CapabilityNaturalOperatorDecision = {
  action: CapabilityNaturalOperatorAction;
  confidence: number;
  reason: string;
  targetItemId: string | null;
  packId: string | null;
  ticketId: string | null;
};

export type CapabilityNaturalOperatorResult = {
  contractVersion: typeof CAPABILITY_NATURAL_OPERATOR_CONTRACT_VERSION;
  generatedAt: string;
  decision: CapabilityNaturalOperatorDecision;
  naturalSetup: NaturalSetupAssistantSnapshot;
  console: CapabilityConsoleSnapshot;
  createdTicket: CapabilitySetupQueueTicket | null;
  executorResult: CapabilitySetupExecutorResult | null;
  safety: {
    rawSecretsSerialized: false;
    liveActivationApplied: false;
    ownerApprovalBeforeLive: true;
    naturalLanguageMayOnlyPlan: true;
  };
  reply: {
    headline: string;
    body: string;
    nextAction: string;
  };
};
