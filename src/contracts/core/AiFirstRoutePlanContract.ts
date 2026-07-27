export const AI_FIRST_ROUTE_PLAN_CONTRACT_VERSION = '2026-05-06.gate-1' as const;

export const AI_FIRST_ROUTE_PLAN_INTENTS = [
  'conversation',
  'configuration',
  'workspace-inspection',
  'workspace-mutation',
  'command-execution',
  'research',
  'automation',
  'memory',
  'computer-use',
  'channel-setup',
  'model-selection',
  'unknown',
] as const;

export type AiFirstRoutePlanIntent = (typeof AI_FIRST_ROUTE_PLAN_INTENTS)[number];

export const AI_FIRST_ROUTE_PLAN_AUDIENCES = ['plain', 'guided', 'technical'] as const;

export type AiFirstRoutePlanAudience = (typeof AI_FIRST_ROUTE_PLAN_AUDIENCES)[number];

export const AI_FIRST_ROUTE_PLAN_RISKS = ['safe', 'attention', 'danger'] as const;

export type AiFirstRoutePlanRisk = (typeof AI_FIRST_ROUTE_PLAN_RISKS)[number];

export const AI_FIRST_ROUTE_PLAN_SIDE_EFFECTS = [
  'none',
  'local-read',
  'local-write',
  'command',
  'network',
  'external-send',
  'destructive',
] as const;

export type AiFirstRoutePlanSideEffect = (typeof AI_FIRST_ROUTE_PLAN_SIDE_EFFECTS)[number];

export const AI_FIRST_ROUTE_ACTION_KINDS = [
  'answer',
  'ask-clarification',
  'preview',
  'read',
  'write',
  'run-command',
  'search',
  'configure',
  'test',
  'send',
  'delegate',
] as const;

export type AiFirstRouteActionKind = (typeof AI_FIRST_ROUTE_ACTION_KINDS)[number];

export const AI_FIRST_ROUTE_NEXT_SAFE_ACTIONS = [
  'answer',
  'ask-clarification',
  'preview-then-request-permission',
  'request-permission',
  'execute-governed-safe-read',
  'decline',
] as const;

export type AiFirstRouteNextSafeAction = (typeof AI_FIRST_ROUTE_NEXT_SAFE_ACTIONS)[number];

export type AiFirstRouteTargetType =
  | 'none'
  | 'conversation'
  | 'workspace'
  | 'file'
  | 'service'
  | 'account'
  | 'external'
  | 'unknown';

export type AiFirstRouteTarget = {
  type: AiFirstRouteTargetType;
  value: string | null;
};

export type AiFirstRouteQuestion = {
  id: string;
  prompt: string;
  reason: string;
  required: boolean;
};

export type AiFirstRouteRiskNote = {
  id: string;
  severity: AiFirstRoutePlanRisk;
  message: string;
};

export type AiFirstRouteAction = {
  id: string;
  kind: AiFirstRouteActionKind;
  label: string;
  summary: string;
  target: AiFirstRouteTarget;
  requestedToolIds: string[];
  sideEffect: AiFirstRoutePlanSideEffect;
  risk: AiFirstRoutePlanRisk;
  requiresApproval: boolean;
  requiresPreview: boolean;
  status: 'proposed';
  payloadPreview?: Record<string, unknown>;
};

export type AiFirstRoutePlanPolicyExpectation = {
  requiresApproval: boolean;
  requiresPreview: boolean;
  canExecuteNow: false;
  approvalReason: string | null;
  nextSafeAction: AiFirstRouteNextSafeAction;
  planCannotAuthorizeExecution: true;
  naturalLanguageDoesNotBypassPolicy: true;
};

export type AiFirstRoutePlanReceipt = {
  id: string;
  kind: 'normalization' | 'redaction' | 'policy' | 'fallback';
  detail: string;
};

export type AiFirstRoutePlanDiagnostics = {
  warnings: string[];
  errors: string[];
};

export type AiFirstRoutePlan = {
  contractVersion: typeof AI_FIRST_ROUTE_PLAN_CONTRACT_VERSION;
  source: 'ai-first-route-plan';
  planId: string;
  generatedAt: string;
  input: {
    surface: string;
    userMessage: string;
    rawMessageStored: false;
    language: string;
  };
  audience: {
    level: AiFirstRoutePlanAudience;
    explainBeforeActing: boolean;
    hideTechnicalJargon: boolean;
  };
  intent: {
    primary: AiFirstRoutePlanIntent;
    confidence: number;
    summary: string;
    assumptions: string[];
  };
  goal: {
    userFacing: string;
    internalSummary: string;
  };
  missingInformation: AiFirstRouteQuestion[];
  proposedActions: AiFirstRouteAction[];
  requestedTools: string[];
  risk: {
    level: AiFirstRoutePlanRisk;
    sideEffects: AiFirstRoutePlanSideEffect[];
    notes: AiFirstRouteRiskNote[];
  };
  policy: AiFirstRoutePlanPolicyExpectation;
  response: {
    style: AiFirstRoutePlanAudience;
    userFacingSummary: string;
    nextReply: string;
  };
  receipts: AiFirstRoutePlanReceipt[];
  diagnostics: AiFirstRoutePlanDiagnostics;
};

export type AiFirstRoutePlanNormalizationInput = {
  userMessage?: string | null;
  surface?: string | null;
  rawPlan?: unknown;
  language?: string | null;
};

export type AiFirstRoutePlanNormalizationResult = {
  normalized: AiFirstRoutePlan;
  accepted: boolean;
};
