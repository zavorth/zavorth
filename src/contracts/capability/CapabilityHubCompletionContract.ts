import type { CapabilityNaturalOperatorResult } from './CapabilityNaturalOperatorContract.js';

export const CAPABILITY_HUB_COMPLETION_CONTRACT_VERSION = 'zavorth-capability-hub-completion/v1';

export type CapabilityHubCompletionStatus = 'passed' | 'failed';

export type CapabilityHubCompletionStage = {
  id: string;
  title: string;
  status: CapabilityHubCompletionStatus;
  requiredFiles: string[];
  missingFiles: string[];
  gate: string;
};

export type CapabilityHubCompletionCheckpoint = CapabilityHubCompletionStage;

export type CapabilityHubCompletionJourney = {
  id: string;
  prompt: string;
  expectedAction: string;
  status: CapabilityHubCompletionStatus;
  naturalResult: CapabilityNaturalOperatorResult;
  assertions: {
    expectedActionMatched: boolean;
    rawSecretsSerialized: boolean;
    liveActivationApplied: boolean;
    ownerApprovalBeforeLive: boolean;
    approvalRequiredWhenExecuting: boolean;
  };
};

export type CapabilityHubCompletionSnapshot = {
  contractVersion: typeof CAPABILITY_HUB_COMPLETION_CONTRACT_VERSION;
  generatedAt: string;
  status: CapabilityHubCompletionStatus;
  policy: {
    canonicalRoot: 'zavorth-core/Zavorth';
    directWorkspaceGate: true;
    publicScriptBudgetPreserved: true;
    rawSecretsSerialized: false;
    liveActivationApplied: false;
    ownerApprovalBeforeLive: true;
  };
  summary: {
    stages: number;
    stagesPassed: number;
    journeys: number;
    journeysPassed: number;
    liveViolations: number;
    secretSerializationViolations: number;
  };
  stages: CapabilityHubCompletionStage[];
  journeys: CapabilityHubCompletionJourney[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
