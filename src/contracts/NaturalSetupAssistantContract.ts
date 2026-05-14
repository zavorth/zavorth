import type { CapabilityHubItem } from './CapabilityHubContract.js';
import type {
  GovernanceRecipeExecutionReceipt,
  GovernanceRecipePlan,
} from './GovernanceRecipeContract.js';

export const NATURAL_SETUP_ASSISTANT_CONTRACT_VERSION = 'zavorth-natural-setup-assistant/v1';

export type NaturalSetupIntentAction =
  | 'connect'
  | 'configure'
  | 'validate'
  | 'inspect'
  | 'unknown';

export type NaturalSetupReadinessStatus =
  | 'ready_for_preview'
  | 'needs_secret_input'
  | 'needs_manual_choice'
  | 'blocked'
  | 'unknown';

export type NaturalSetupSecretInput = {
  field: string;
  valuePreview: string;
  source: 'text' | 'providedSecrets';
  secretRef: string | null;
  acceptedForPersistence: false;
};

export type NaturalSetupAssistantInput = {
  text: string;
  actorLabel?: string | null;
  locale?: string | null;
  providedSecrets?: Record<string, string | null | undefined>;
  preferredCapabilityId?: string | null;
  approvalId?: string | null;
  persistSecrets?: boolean;
};

export type NaturalSetupDetectedIntent = {
  action: NaturalSetupIntentAction;
  confidence: number;
  targetText: string | null;
  matchedAliases: string[];
};

export type NaturalSetupSecretPlan = {
  requiredRefs: string[];
  missingRefs: string[];
  providedRefs: string[];
  detectedSecretInputs: NaturalSetupSecretInput[];
  rawSecretValuesSerialized: false;
  persistenceMode: 'disabled' | 'explicit-only';
};

export type NaturalSetupReadinessCheck = {
  id: string;
  status: 'passed' | 'next' | 'missing' | 'blocked';
  summary: string;
};

export type NaturalSetupReadiness = {
  status: NaturalSetupReadinessStatus;
  checks: NaturalSetupReadinessCheck[];
  blockers: string[];
  nextSafeAction: string;
};

export type NaturalSetupConversation = {
  headline: string;
  explanation: string;
  questions: string[];
  simpleSteps: string[];
};

export type NaturalSetupSafety = {
  previewOnly: true;
  liveActivation: false;
  secretsSerialized: false;
  approvalRequired: boolean;
  ownerApprovalRequired: boolean;
  jargonHidden: boolean;
};

export type NaturalSetupAssistantSnapshot = {
  contractVersion: typeof NATURAL_SETUP_ASSISTANT_CONTRACT_VERSION;
  generatedAt: string;
  request: {
    inputText: string;
    redactedText: string;
    actorLabel: string | null;
  };
  detectedIntent: NaturalSetupDetectedIntent;
  selectedCapability: CapabilityHubItem | null;
  governancePlan: GovernanceRecipePlan | null;
  dryRunReceipt: GovernanceRecipeExecutionReceipt | null;
  secretPlan: NaturalSetupSecretPlan;
  readiness: NaturalSetupReadiness;
  conversation: NaturalSetupConversation;
  safety: NaturalSetupSafety;
};
