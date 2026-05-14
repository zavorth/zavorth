export type UniversalIntentRiskLevel = 'safe' | 'attention' | 'danger';

export type UniversalIntentCategory =
  | 'conversation'
  | 'inspection'
  | 'workspace_mutation'
  | 'command_execution'
  | 'network_access'
  | 'external_side_effect'
  | 'automation'
  | 'operator_control'
  | 'clarification';

export type UniversalIntentNextSafeAction =
  | 'answer'
  | 'execute_governed'
  | 'ask_clarification'
  | 'request_permission'
  | 'preview_then_request_permission'
  | 'block';

export type UniversalIntentSideEffect =
  | 'none'
  | 'local_workspace'
  | 'external'
  | 'system'
  | 'destructive';

export type UniversalIntentTrustMode = 'protected' | 'collaborator' | 'overlord';

export type UniversalIntentUserRole = 'common' | 'builder' | 'operator' | string;

export type UniversalIntentPermissionScope = 'once' | 'session' | 'workspace' | 'persistent';

export type TrustSliderLevel = UniversalIntentTrustMode;

export type TrustSliderRuntimeProfile = 'safe-core' | 'trusted-workspace' | 'owner-operator';

export type TrustSliderSandboxTier = 'safe-core' | 'workspace-scoped' | 'host-scoped';

export type TrustSliderPermissionBoundary = 'container-first' | 'workspace-scoped' | 'host-scoped';

export type TrustSliderPolicyDecisionStatus = 'allow' | 'requires_permission' | 'block';

export type TrustSliderReceiptDirection = 'same' | 'elevation' | 'reduction';

export type UniversalIntentContextHints = {
  activeTargetId?: string | null;
  activeArtifactId?: string | null;
  previousRunId?: string | null;
  sessionId?: string | null;
  workspacePath?: string | null;
  workspaceRoot?: string | null;
  targetPath?: string | null;
  hostScopeRequested?: boolean | null;
  sensitiveDomain?: boolean | null;
};

export type UniversalIntentRiskHints = {
  mutation?: boolean | null;
  externalSideEffect?: boolean | null;
  destructive?: boolean | null;
  shell?: boolean | null;
  network?: boolean | null;
  approvalRequired?: boolean | null;
  operatorRequired?: boolean | null;
};

export type UniversalIntentInput = {
  surface: 'cli' | 'web' | 'telegram' | 'discord' | string;
  text: string;
  requestedTools?: string[] | null;
  capabilityIds?: string[] | null;
  userRole?: UniversalIntentUserRole | null;
  trustMode?: UniversalIntentTrustMode | null;
  previousTrustMode?: UniversalIntentTrustMode | null;
  ownerConfirmed?: boolean | null;
  killSwitchActive?: boolean | null;
  contextHints?: UniversalIntentContextHints | null;
  riskHints?: UniversalIntentRiskHints | null;
};

export type UniversalIntentSignalSnapshot = {
  textEmpty: boolean;
  hasKnownTarget: boolean;
  requestedTools: string[];
  toolsFromRequest: string[];
  toolsFromCapabilities: string[];
  mutation: boolean;
  shell: boolean;
  network: boolean;
  externalSideEffect: boolean;
  destructive: boolean;
  automation: boolean;
  inspection: boolean;
  operatorRequired: boolean;
  sensitiveDomain: boolean;
  ambiguousTarget: boolean;
  hostScopeRequested: boolean;
  matchedSignals: string[];
};

export type UniversalIntentSafetyClassification = {
  intent: UniversalIntentCategory;
  risk: UniversalIntentRiskLevel;
  sideEffect: UniversalIntentSideEffect;
  confidence: number;
  capabilityRequired: string[];
  signals: UniversalIntentSignalSnapshot;
};

export type NaturalClarificationPolicy = {
  askBeforeAssumption: boolean;
  question: string | null;
  reason: string | null;
  missing: string[];
  sensitiveDomain: boolean;
};

export type PermissionNarrative = {
  summary: string;
  whatWillHappen: string;
  where: string;
  permission: string;
  risk: string;
  review: string;
  validity: string;
  technicalDetails: string[];
};

export type ConversationalPermissionScopeBoundary = {
  sessionId: string | null;
  workspaceRoot: string | null;
  targetPath: string | null;
  hostAllowed: boolean;
};

export type ConversationalPermissionRequest = {
  id: string;
  kind:
    | 'tool_execution'
    | 'workspace_mutation'
    | 'external_side_effect'
    | 'automation'
    | 'dangerous_operation'
    | 'operator_control';
  prompt: string;
  reason: string;
  risk: UniversalIntentRiskLevel;
  scope: UniversalIntentPermissionScope;
  scopeBoundary: ConversationalPermissionScopeBoundary;
  requestedTools: string[];
  previewRequired: boolean;
  approvalRequired: boolean;
  sideEffect: UniversalIntentSideEffect;
  narrative: PermissionNarrative;
};

export type ConversationalPermissionGrant = {
  permissionId: string;
  request: ConversationalPermissionRequest;
  scope: UniversalIntentPermissionScope;
  sessionId: string | null;
  workspaceRoot: string | null;
  consumed: boolean;
  approvedAt: string;
};

export type ConversationalPermissionUsage = {
  permissionId: string;
  sessionId?: string | null;
  workspacePath?: string | null;
  targetPath?: string | null;
  hostScopeRequested?: boolean | null;
};

export type ConversationalPermissionUseDecision = {
  allowed: boolean;
  consumed: boolean;
  reason: string;
};

export type TrustPostureSnapshot = {
  posture:
    | 'direct-answer'
    | 'governed-execution'
    | 'preview-first'
    | 'approval-required'
    | 'clarify-first'
    | 'blocked';
  reason: string;
  userRole: UniversalIntentUserRole;
  trustMode: UniversalIntentTrustMode;
  approvalRequired: boolean;
  previewRequired: boolean;
  rollbackExpected: boolean;
  blocked: boolean;
  blockReason: string | null;
};

export type TrustSliderPolicySnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  level: TrustSliderLevel;
  runtimeProfile: TrustSliderRuntimeProfile;
  sandboxTier: TrustSliderSandboxTier;
  permissionBoundary: TrustSliderPermissionBoundary;
  hostAllowed: boolean;
  workspaceRequired: boolean;
  ownerOrOperatorRequired: boolean;
  killSwitchRequired: boolean;
  auditTrailRequired: boolean;
  selfModificationPreviewRequired: boolean;
  summary: string;
  controls: {
    explicitElevationRequired: boolean;
    workspaceEscapeRequiresPermission: boolean;
    hostMutationBlocked: boolean;
    rollbackExpected: boolean;
  };
};

export type TrustSliderReceipt = {
  id: string;
  generatedAt: string;
  fromLevel: TrustSliderLevel | null;
  toLevel: TrustSliderLevel;
  direction: TrustSliderReceiptDirection;
  reason: string;
  sandboxTier: TrustSliderSandboxTier;
  permissionScope: UniversalIntentPermissionScope | 'none';
  auditTrailRequired: boolean;
  killSwitchRequired: boolean;
  previewRequired: boolean;
  rollbackCommand: string | null;
};

export type TrustSliderPolicyDecision = {
  schemaVersion: 1;
  generatedAt: string;
  level: TrustSliderLevel;
  decision: TrustSliderPolicyDecisionStatus;
  reason: string;
  sandboxTier: TrustSliderSandboxTier;
  permissionBoundary: TrustSliderPermissionBoundary;
  permissionScope: UniversalIntentPermissionScope | 'none';
  hostAllowed: boolean;
  workspaceRoot: string | null;
  targetPath: string | null;
  previewRequired: boolean;
  approvalRequired: boolean;
  auditTrailRequired: boolean;
  killSwitchRequired: boolean;
  ownerOrOperatorRequired: boolean;
  blocked: boolean;
  blockReason: string | null;
  snapshot: TrustSliderPolicySnapshot;
  receipt: TrustSliderReceipt;
  enforcement: {
    source: 'TrustSliderPolicyService';
    centralEnforcement: boolean;
    explicitElevationRequired: boolean;
  };
};

export type UserAbstractionProfile = {
  role: UniversalIntentUserRole;
  detailLevel: 'plain' | 'balanced' | 'technical';
  hideImplementationJargon: boolean;
  shouldExposeTechnicalDetails: boolean;
  summaryStyle: 'simple' | 'operator';
};

export type UniversalIntentDecision = {
  schemaVersion: 1;
  generatedAt: string;
  intent: UniversalIntentCategory;
  capabilityRequired: string[];
  risk: UniversalIntentRiskLevel;
  confidence: number;
  requiresClarification: boolean;
  clarification: NaturalClarificationPolicy;
  requiresPermission: boolean;
  permissionRequest: ConversationalPermissionRequest | null;
  permissionNarrative: PermissionNarrative;
  nextSafeAction: UniversalIntentNextSafeAction;
  trustSlider: TrustSliderPolicyDecision;
  trustPosture: TrustPostureSnapshot;
  userAbstraction: UserAbstractionProfile;
  safety: UniversalIntentSafetyClassification;
  diagnostics: {
    source: 'UniversalIntentService';
    surface: string;
    matchedSignals: string[];
    textEmpty: boolean;
    toolsFromRequest: string[];
    toolsFromCapabilities: string[];
  };
};
