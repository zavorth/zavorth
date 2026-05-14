export const INTELLIGENCE_FABRIC_CONTRACT_VERSION = 'zavorth-intelligence-fabric/v1' as const;

export type IntelligenceTaskKind =
  | 'casual_chat'
  | 'coding'
  | 'architecture'
  | 'debugging'
  | 'security_review'
  | 'research'
  | 'file_operation'
  | 'shell_operation'
  | 'agent_building'
  | 'capability_setup'
  | 'unknown';

export type IntelligenceTaskComplexity = 'trivial' | 'simple' | 'medium' | 'hard' | 'expert';

export type IntelligenceRiskLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type IntelligenceTrustMode =
  | 'locked_down'
  | 'balanced'
  | 'local_owner'
  | 'developer_fast'
  | 'enterprise';

export type IntelligenceLegacyTrustMode = 'protected' | 'collaborator' | 'overlord';

export type IntelligenceTrustResolutionSource =
  | 'explicit'
  | 'surface_policy'
  | 'owner_local_default'
  | 'config_default';

export type IntelligenceRecommendedMode =
  | 'direct_answer'
  | 'plan_only'
  | 'draft_patch'
  | 'simulate'
  | 'ask_approval'
  | 'execute_sandboxed'
  | 'capability_builder'
  | 'blocked';

export type IntelligenceProposedActionKind =
  | 'read'
  | 'write'
  | 'edit'
  | 'exec'
  | 'network'
  | 'install'
  | 'delete'
  | 'send'
  | 'deploy'
  | 'secret_access'
  | 'capability_draft'
  | 'answer';

export type IntelligenceProposedAction = {
  id: string;
  kind: IntelligenceProposedActionKind;
  target: string;
  description: string;
  reversible: boolean;
  insideWorkspace: boolean;
  touchesSecrets: boolean;
  usesNetwork: boolean;
  riskLevel: IntelligenceRiskLevel;
};

export type IntelligenceExecutionProposal = {
  id: string;
  summary: string;
  mode: 'draft' | 'simulation' | 'commit';
  actions: IntelligenceProposedAction[];
  riskLevel: IntelligenceRiskLevel;
  requiresApproval: boolean;
  requiresSandbox: boolean;
  rollbackPlan: string | null;
  testsToRun: string[];
  liveActionApplied: false;
};

export type IntelligenceModelRoutingInput = {
  taskKind: IntelligenceTaskKind;
  complexity: IntelligenceTaskComplexity;
  riskLevel: IntelligenceRiskLevel;
  needsCode: boolean;
  needsLongContext: boolean;
  needsVision: boolean;
  needsToolUse: boolean;
  needsSecurityReasoning: boolean;
  userForcedModel?: string | null;
};

export type IntelligenceModelRoutingDecision = {
  source: 'ModelPickerService' | 'manual-override' | 'fallback';
  selectedModelId: string | null;
  selectedProviderId: string | null;
  selectedRouteId: string | null;
  ready: boolean;
  overrideUsed: boolean;
  fallbackAllowed: boolean;
  routingInput: IntelligenceModelRoutingInput;
  explanation: string[];
};

export type IntelligenceRelevantFile = {
  path: string;
  reason: string;
  tokenEstimate: number;
};

export type IntelligenceContextPack = {
  systemIdentity: string;
  userPreferences: string;
  projectSummary: string;
  relevantFiles: IntelligenceRelevantFile[];
  recentDecisions: string[];
  activeConstraints: string[];
  securityPolicy: string;
  tokenBudget: number;
};

export type IntelligenceCapabilityManifest = {
  id: string;
  name: string;
  description: string;
  kind: 'skill' | 'tool' | 'plugin' | 'workflow' | 'subagent';
  riskLevel: IntelligenceRiskLevel;
  requiredTools: string[];
  requiredSecrets: string[];
  allowedFileScopes: string[];
  networkAccess: 'none' | 'allowlist' | 'open';
  approvalRequiredFor: string[];
  tests: string[];
  defaultEnabled: false;
  liveAllowedByDefault: false;
};

export type IntelligenceCapabilityBuilderDraft = {
  status: 'not_needed' | 'existing_capability' | 'draft_ready';
  requestedCapability: string | null;
  matchedCapabilityId: string | null;
  manifest: IntelligenceCapabilityManifest | null;
  activationBlockedUntilApproval: true;
  notes: string[];
};

export type IntelligenceRiskActionDecision = {
  actionId: string;
  actionKind: IntelligenceProposedActionKind;
  decision: 'allow' | 'require_approval' | 'require_sandbox' | 'block';
  reason: string;
  requiresApproval: boolean;
  requiresSandbox: boolean;
};

export type IntelligenceRiskGateSnapshot = {
  source: 'IntelligenceRiskGateService';
  trustMode: IntelligenceTrustMode;
  legacyTrustMode: IntelligenceLegacyTrustMode;
  overallDecision: 'allow' | 'require_approval' | 'require_sandbox' | 'block';
  canExecuteNow: boolean;
  requiresApproval: boolean;
  requiresSandbox: boolean;
  actionDecisions: IntelligenceRiskActionDecision[];
  receipts: string[];
};

export type IntelligenceVerifierFinding = {
  id: string;
  severity: 'info' | 'warning' | 'blocker';
  message: string;
};

export type IntelligenceVerifierSnapshot = {
  status: 'passed' | 'warning' | 'blocked';
  independentReviewRequired: boolean;
  findings: IntelligenceVerifierFinding[];
};

export type IntelligenceTaskEval = {
  taskId: string;
  taskKind: IntelligenceTaskKind;
  complexity: IntelligenceTaskComplexity;
  riskLevel: IntelligenceRiskLevel;
  modelUsed: string | null;
  success: boolean;
  userCorrectionNeeded: boolean;
  testsPassed: boolean | null;
  securityIssuesFound: boolean;
  latencyMs: number;
  costEstimate: number | null;
  lessons: string[];
};

export type IntelligenceFabricInput = {
  text: string;
  surface?: string | null;
  trustMode?: IntelligenceTrustMode | null;
  userRole?: string | null;
  userForcedModel?: string | null;
  workspaceRoot?: string | null;
  requestedTools?: string[] | null;
  capabilityIds?: string[] | null;
  now?: string | null;
};

export type IntelligenceFabricClassification = {
  taskKind: IntelligenceTaskKind;
  complexity: IntelligenceTaskComplexity;
  riskLevel: IntelligenceRiskLevel;
  recommendedMode: IntelligenceRecommendedMode;
  reasons: string[];
  routeIntent: string;
  universalIntent: string;
  confidence: number;
};

export type IntelligenceFabricSnapshot = {
  contractVersion: typeof INTELLIGENCE_FABRIC_CONTRACT_VERSION;
  generatedAt: string;
  mode: 'shadow';
  input: {
    surface: string;
    redactedText: string;
    rawSecretsSerialized: false;
  };
  trust: {
    requested: IntelligenceTrustMode;
    legacy: IntelligenceLegacyTrustMode;
    defaulted: boolean;
    source: IntelligenceTrustResolutionSource;
    ownerLocalDefault: boolean;
    surfacePolicy: IntelligenceTrustMode;
    reason: string;
  };
  classification: IntelligenceFabricClassification;
  contextPack: IntelligenceContextPack;
  modelRouting: IntelligenceModelRoutingDecision;
  executionProposal: IntelligenceExecutionProposal;
  riskGate: IntelligenceRiskGateSnapshot;
  verifier: IntelligenceVerifierSnapshot;
  capabilityBuilder: IntelligenceCapabilityBuilderDraft;
  taskEval: IntelligenceTaskEval;
  activation: {
    shadowOnly: true;
    promotedToDefault: false;
    liveActionApplied: false;
  };
  safety: {
    thinkingRequiresApproval: false;
    planningRequiresApproval: false;
    simulationRequiresApproval: false;
    dangerousActionsRequireGate: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  receipts: string[];
  reply: {
    headline: string;
    body: string;
    nextAction: string;
  };
};
