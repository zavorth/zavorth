import type { CapabilityImportManifest, CapabilityImportSnapshot } from './CapabilityImportContract.js';
import type { CapabilityHubItem } from './CapabilityHubContract.js';
import type { CapabilityPackReadinessSnapshot } from './CapabilityPackReadinessContract.js';
import type { NaturalSetupAssistantSnapshot } from '../NaturalSetupAssistantContract.js';

export const CAPABILITY_ACTIVATION_FLOW_CONTRACT_VERSION = 'zavorth-capability-activation-flow/v1';

export type CapabilityActivationFlowStatus =
  | 'blocked'
  | 'waiting_target'
  | 'waiting_secret_input'
  | 'waiting_readiness'
  | 'waiting_approval'
  | 'ready_for_controlled_activation';

export type CapabilityActivationFlowStep = {
  id: string;
  label: string;
  status: 'done' | 'next' | 'pending' | 'blocked';
  summary: string;
};

export type CapabilityActivationFlowReceipt = {
  id: string;
  source: 'importer' | 'natural-setup' | 'governance' | 'activation-flow';
  summary: string;
  targetItemId: string | null;
};

export type CapabilityActivationFlowInput = {
  text?: string | null;
  targetItemId?: string | null;
  packId?: string | null;
  actorLabel?: string | null;
  approvalId?: string | null;
  providedSecrets?: Record<string, string | null | undefined>;
  availableSecretRefs?: string[];
  availableEnvKeys?: string[];
  availableBinaries?: string[];
  completedManualSteps?: string[];
  completedReadinessChecks?: string[];
  localRoutes?: Record<string, boolean>;
  manifest?: CapabilityImportManifest | null;
  manifests?: CapabilityImportManifest[];
  rawJson?: string | null;
  sourceLabel?: string | null;
};

export type CapabilityActivationFlowSnapshot = {
  contractVersion: typeof CAPABILITY_ACTIVATION_FLOW_CONTRACT_VERSION;
  generatedAt: string;
  status: CapabilityActivationFlowStatus;
  target: CapabilityHubItem | null;
  importSnapshot: CapabilityImportSnapshot;
  packReadinessSnapshot: CapabilityPackReadinessSnapshot | null;
  setupSnapshot: NaturalSetupAssistantSnapshot | null;
  steps: CapabilityActivationFlowStep[];
  receipts: CapabilityActivationFlowReceipt[];
  activation: {
    dryRunOnly: true;
    liveActivationApplied: false;
    approvalId: string | null;
    nextCommand: string | null;
  };
  policy: {
    canonicalRootOnly: true;
    importedCapabilitiesAllowed: true;
    externalRootsAllowed: false;
    secretsSerialized: false;
    ownerApprovalBeforeLive: true;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
