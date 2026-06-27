import type {
  CapabilityHubItem,
  CapabilityHubItemKind,
  CapabilityHubRiskLevel,
} from '../CapabilityHubContract.js';

export const GOVERNANCE_RECIPE_CONTRACT_VERSION = 'zavorth-governance-recipes/v1';

export type GovernanceRecipeStatus = 'ready' | 'needs_setup' | 'approval_required' | 'blocked';
export type GovernanceRecipeExecutionStatus =
  | 'dry_run_completed'
  | 'waiting_approval'
  | 'blocked'
  | 'ready_for_live_execution';

export type GovernanceRecipeDefinition = {
  id: string;
  label: string;
  summary: string;
  targetKinds: CapabilityHubItemKind[];
  tags: string[];
  defaultScope: {
    filesystem: 'none' | 'read_only' | 'workspace_write';
    network: 'none' | 'allowlisted' | 'external_policy';
    secrets: 'none' | 'required_refs_only';
    tools: 'none' | 'read_only' | 'approved_only';
  };
  defaultBudget: {
    maxUsd: number;
    maxToolCalls: number;
    maxRuntimeMinutes: number;
  };
  approval: {
    requiredBeforeLive: boolean;
    requiredForWrites: boolean;
    requiredForExternalNetwork: boolean;
    ownerOnly: boolean;
  };
  sandbox: {
    required: boolean;
    tier: 'none' | 'local-jail' | 'container' | 'microvm';
  };
  rollback: {
    strategy: 'none' | 'disable_capability' | 'restore_previous_config' | 'manual_runbook';
    runbook: string[];
  };
  receiptKinds: string[];
};

export type GovernanceRecipePlanStep = {
  id: string;
  label: string;
  kind: 'readiness' | 'permission' | 'budget' | 'sandbox' | 'receipt' | 'rollback' | 'activation';
  status: 'done' | 'next' | 'pending' | 'blocked';
  summary: string;
};

export type GovernanceRecipePermissionDecision = {
  approvalRequired: boolean;
  approvalReason: string;
  allowedToolPolicy: 'none' | 'read_only' | 'approved_only';
  liveExecutionAllowed: boolean;
};

export type GovernanceRecipeBudgetDecision = {
  maxUsd: number;
  maxToolCalls: number;
  maxRuntimeMinutes: number;
  estimatedRisk: CapabilityHubRiskLevel;
  withinDefaultBudget: boolean;
};

export type GovernanceRecipeRollbackPlan = {
  available: boolean;
  strategy: GovernanceRecipeDefinition['rollback']['strategy'];
  runbook: string[];
  requiresExplicitCommand: boolean;
};

export type GovernanceRecipePlan = {
  contractVersion: typeof GOVERNANCE_RECIPE_CONTRACT_VERSION;
  generatedAt: string;
  recipeId: string;
  targetItemId: string;
  status: GovernanceRecipeStatus;
  dryRunOnly: boolean;
  recipe: GovernanceRecipeDefinition;
  target: CapabilityHubItem;
  permissions: GovernanceRecipePermissionDecision;
  budget: GovernanceRecipeBudgetDecision;
  sandbox: GovernanceRecipeDefinition['sandbox'];
  rollback: GovernanceRecipeRollbackPlan;
  receipts: Array<{
    id: string;
    kind: string;
    summary: string;
    required: boolean;
  }>;
  steps: GovernanceRecipePlanStep[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export type GovernanceRecipeExecutionReceipt = {
  contractVersion: typeof GOVERNANCE_RECIPE_CONTRACT_VERSION;
  generatedAt: string;
  executionId: string;
  recipeId: string;
  targetItemId: string;
  status: GovernanceRecipeExecutionStatus;
  dryRun: boolean;
  approvalId: string | null;
  receiptIds: string[];
  rollback: GovernanceRecipeRollbackPlan;
  summary: string;
};

export type GovernanceRecipeSnapshot = {
  contractVersion: typeof GOVERNANCE_RECIPE_CONTRACT_VERSION;
  generatedAt: string;
  summary: {
    recipes: number;
    readyTargets: number;
    approvalGatedTargets: number;
    dryRunOnly: boolean;
  };
  recipes: GovernanceRecipeDefinition[];
  plans: GovernanceRecipePlan[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};
