export const ZAVORTH_TRANSACTION_PLANE_CONTRACT_VERSION = 'zavorth-transaction-plane/phase-0' as const;

export type ZavorthTransactionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ZavorthTransactionActor =
  | 'human'
  | 'llm'
  | 'zavorth-runtime'
  | 'typed-connector'
  | 'system';

export type ZavorthTransactionExecutionMode =
  | 'conversation'
  | 'observe'
  | 'preview'
  | 'dry-run'
  | 'sandbox'
  | 'paper'
  | 'live';

export type ZavorthTransactionApprovalStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

export type ZavorthTransactionActionKind =
  | 'market-data-read'
  | 'price-monitor'
  | 'cart-preview'
  | 'purchase-submit'
  | 'payment-submit'
  | 'trade-order'
  | 'trade-cancel'
  | 'asset-transfer'
  | 'asset-withdrawal'
  | 'currency-conversion'
  | 'subscription-create'
  | 'subscription-cancel'
  | 'api-credit-purchase'
  | 'refund-request'
  | 'mandate-create'
  | 'mandate-revoke';

export type ZavorthTransactionDecisionStatus =
  | 'allowed'
  | 'blocked'
  | 'needs-preview'
  | 'needs-approval'
  | 'needs-connector'
  | 'needs-ledger'
  | 'simulation-only';

export type ZavorthTransactionRiskTaxonomyEntry = {
  level: ZavorthTransactionRiskLevel;
  summary: string;
  examples: ZavorthTransactionActionKind[];
  requiredControls: string[];
};

export type ZavorthTransactionPlaneInvariant = {
  id: string;
  summary: string;
  enforcedBy: string[];
};

export type ZavorthTransactionPlaneSafetyInput = {
  actor: ZavorthTransactionActor;
  actionKind: ZavorthTransactionActionKind;
  executionMode: ZavorthTransactionExecutionMode;
  approvalStatus?: ZavorthTransactionApprovalStatus | null;
  typedConnector?: boolean | null;
  connectorTrusted?: boolean | null;
  previewGenerated?: boolean | null;
  ledgerEnabled?: boolean | null;
  usesRealMoney?: boolean | null;
  movesExternalValue?: boolean | null;
  touchesRawSecret?: boolean | null;
  persistsRawSecret?: boolean | null;
  mandateId?: string | null;
  sourceSurface?: string | null;
};

export type ZavorthTransactionPlaneSafetyDecision = {
  version: typeof ZAVORTH_TRANSACTION_PLANE_CONTRACT_VERSION;
  status: ZavorthTransactionDecisionStatus;
  allowed: boolean;
  riskLevel: ZavorthTransactionRiskLevel;
  actionKind: ZavorthTransactionActionKind;
  executionMode: ZavorthTransactionExecutionMode;
  actor: ZavorthTransactionActor;
  llmDirectExecutionAllowed: false;
  typedConnectorRequired: boolean;
  trustedConnectorRequired: boolean;
  previewRequired: boolean;
  explicitHumanApprovalRequired: boolean;
  ledgerRequired: boolean;
  simulationFirst: boolean;
  realMoneyAction: boolean;
  irreversibleAction: boolean;
  criticalValueMovement: boolean;
  blockers: string[];
  requiredControls: string[];
  reasons: string[];
};

export type ZavorthTransactionPlaneContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_PLANE_CONTRACT_VERSION;
  summary: string;
  invariants: ZavorthTransactionPlaneInvariant[];
  riskTaxonomy: Record<ZavorthTransactionRiskLevel, ZavorthTransactionRiskTaxonomyEntry>;
  irreversibleActions: ZavorthTransactionActionKind[];
  realMoneyActions: ZavorthTransactionActionKind[];
  criticalValueMovementActions: ZavorthTransactionActionKind[];
  defaultControls: string[];
};

export const ZAVORTH_TRANSACTION_REAL_MONEY_ACTIONS: readonly ZavorthTransactionActionKind[] = [
  'purchase-submit',
  'payment-submit',
  'trade-order',
  'asset-transfer',
  'asset-withdrawal',
  'currency-conversion',
  'subscription-create',
  'api-credit-purchase',
] as const;

export const ZAVORTH_TRANSACTION_IRREVERSIBLE_ACTIONS: readonly ZavorthTransactionActionKind[] = [
  'purchase-submit',
  'payment-submit',
  'trade-order',
  'asset-transfer',
  'asset-withdrawal',
  'currency-conversion',
  'subscription-create',
  'subscription-cancel',
  'api-credit-purchase',
] as const;

export const ZAVORTH_TRANSACTION_CRITICAL_VALUE_MOVEMENT_ACTIONS: readonly ZavorthTransactionActionKind[] = [
  'asset-transfer',
  'asset-withdrawal',
] as const;

export const ZAVORTH_TRANSACTION_PLANE_INVARIANTS: readonly ZavorthTransactionPlaneInvariant[] = [
  {
    id: 'llm-never-executes',
    summary: 'LLM may classify, explain and propose transaction parameters, but it may never execute a transaction directly.',
    enforcedBy: ['TransactionPlanePolicyService', 'typed connector boundary', 'approval plane'],
  },
  {
    id: 'typed-connector-only',
    summary: 'Live transactional effects must go through Zavorth-owned typed connectors, never through free-form browser or shell automation.',
    enforcedBy: ['connector registry', 'transaction execution gateway'],
  },
  {
    id: 'real-money-needs-human-approval',
    summary: 'Any real-money or value-moving action requires an explicit human approval after preview.',
    enforcedBy: ['transaction preview', 'approval ledger', 'risk policy'],
  },
  {
    id: 'preview-before-effect',
    summary: 'The user must see amount, destination, fees, connector, risk and reversibility before any live effect.',
    enforcedBy: ['preview engine', 'Command Center', 'Telegram approval'],
  },
  {
    id: 'no-raw-secrets',
    summary: 'Raw secrets, payment credentials and private keys must not be persisted in memory, ledgers, prompts or docs.',
    enforcedBy: ['secret redaction', 'credential vault references', 'ledger sanitizer'],
  },
  {
    id: 'ledger-for-every-decision',
    summary: 'Every preview, approval, rejection and execution must produce an audit receipt.',
    enforcedBy: ['transaction ledger', 'receipt pipeline'],
  },
] as const;

export const ZAVORTH_TRANSACTION_RISK_TAXONOMY: Record<ZavorthTransactionRiskLevel, ZavorthTransactionRiskTaxonomyEntry> = {
  low: {
    level: 'low',
    summary: 'Read-only observation or local explanation with no external commitment and no funds at risk.',
    examples: ['market-data-read', 'price-monitor', 'cart-preview'],
    requiredControls: ['trace metadata', 'no raw secret exposure'],
  },
  medium: {
    level: 'medium',
    summary: 'Structured preview, sandbox, refund request or mandate revocation without live value movement.',
    examples: ['refund-request', 'mandate-revoke', 'trade-cancel'],
    requiredControls: ['preview', 'ledger receipt', 'connector schema validation'],
  },
  high: {
    level: 'high',
    summary: 'Real-money purchase, payment, trade, subscription or credit purchase that can create financial exposure.',
    examples: ['purchase-submit', 'payment-submit', 'trade-order', 'subscription-create', 'api-credit-purchase'],
    requiredControls: ['typed connector', 'trusted connector', 'preview', 'explicit approval', 'ledger receipt'],
  },
  critical: {
    level: 'critical',
    summary: 'External value movement such as withdrawal or asset transfer; blocked by default in Phase 0.',
    examples: ['asset-transfer', 'asset-withdrawal'],
    requiredControls: ['manual owner policy', 'dual confirmation', 'cooldown', 'ledger receipt'],
  },
};

export function buildZavorthTransactionPlaneContractSnapshot(): ZavorthTransactionPlaneContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_PLANE_CONTRACT_VERSION,
    summary: 'Security contract for Zavorth Transaction Plane Phase 0.',
    invariants: [...ZAVORTH_TRANSACTION_PLANE_INVARIANTS],
    riskTaxonomy: ZAVORTH_TRANSACTION_RISK_TAXONOMY,
    irreversibleActions: [...ZAVORTH_TRANSACTION_IRREVERSIBLE_ACTIONS],
    realMoneyActions: [...ZAVORTH_TRANSACTION_REAL_MONEY_ACTIONS],
    criticalValueMovementActions: [...ZAVORTH_TRANSACTION_CRITICAL_VALUE_MOVEMENT_ACTIONS],
    defaultControls: [
      'simulation-first',
      'typed connector required for live effects',
      'preview before live effects',
      'explicit human approval for real money',
      'ledger receipt required',
      'raw secrets never persisted',
    ],
  };
}

export function evaluateZavorthTransactionPlaneSafety(
  input: ZavorthTransactionPlaneSafetyInput,
): ZavorthTransactionPlaneSafetyDecision {
  const actionKind = input.actionKind;
  const executionMode = input.executionMode;
  const actor = input.actor;
  const liveEffect = executionMode === 'live';
  const connectorExecution = ['dry-run', 'sandbox', 'paper', 'live'].includes(executionMode);
  const realMoneyAction = input.usesRealMoney === true || ZAVORTH_TRANSACTION_REAL_MONEY_ACTIONS.includes(actionKind);
  const irreversibleAction = ZAVORTH_TRANSACTION_IRREVERSIBLE_ACTIONS.includes(actionKind);
  const criticalValueMovement =
    input.movesExternalValue === true || ZAVORTH_TRANSACTION_CRITICAL_VALUE_MOVEMENT_ACTIONS.includes(actionKind);
  const typedConnectorRequired = liveEffect || realMoneyAction || irreversibleAction;
  const trustedConnectorRequired = liveEffect || realMoneyAction || criticalValueMovement;
  const previewRequired = liveEffect || realMoneyAction || irreversibleAction || actionKind === 'mandate-create';
  const explicitHumanApprovalRequired = realMoneyAction || irreversibleAction || criticalValueMovement || actionKind === 'mandate-create';
  const ledgerRequired = connectorExecution || previewRequired || explicitHumanApprovalRequired;
  const riskLevel = classifyZavorthTransactionRisk(input);
  const blockers: string[] = [];
  const requiredControls: string[] = [];
  const reasons: string[] = [];

  if (actor === 'llm' && connectorExecution) {
    blockers.push('llm_direct_transaction_execution_blocked');
    reasons.push('LLM can propose transaction parameters, but cannot execute transactional connector actions.');
  }

  if (input.touchesRawSecret === true || input.persistsRawSecret === true) {
    blockers.push('raw_secret_exposure_blocked');
    reasons.push('Raw transaction secrets or payment credentials cannot enter prompts, memory or ledgers.');
  }

  if (criticalValueMovement && liveEffect) {
    blockers.push('critical_value_movement_blocked_by_default');
    reasons.push('External transfers and withdrawals remain blocked by default in Phase 0.');
  }

  if (typedConnectorRequired && input.typedConnector !== true && liveEffect) {
    blockers.push('typed_connector_required');
    requiredControls.push('typed connector');
  }

  if (trustedConnectorRequired && input.connectorTrusted !== true && liveEffect) {
    blockers.push('trusted_connector_required');
    requiredControls.push('trusted connector');
  }

  if (previewRequired && input.previewGenerated !== true && liveEffect) {
    blockers.push('transaction_preview_required');
    requiredControls.push('preview');
  }

  if (explicitHumanApprovalRequired && input.approvalStatus !== 'approved' && liveEffect) {
    blockers.push('explicit_human_approval_required');
    requiredControls.push('explicit human approval');
  }

  if (ledgerRequired && input.ledgerEnabled !== true && liveEffect) {
    blockers.push('transaction_ledger_required');
    requiredControls.push('ledger receipt');
  }

  if (!liveEffect && connectorExecution && realMoneyAction) {
    reasons.push('Simulation, sandbox and paper modes are allowed before live money movement when secrets are not exposed.');
  }

  if (blockers.length === 0) {
    reasons.push(liveEffect ? 'Live transaction controls satisfied for Phase 0 policy.' : 'Non-live transaction activity stays inside simulation or preview boundaries.');
  }

  return {
    version: ZAVORTH_TRANSACTION_PLANE_CONTRACT_VERSION,
    status: resolveTransactionDecisionStatus(blockers, liveEffect),
    allowed: blockers.length === 0,
    riskLevel,
    actionKind,
    executionMode,
    actor,
    llmDirectExecutionAllowed: false,
    typedConnectorRequired,
    trustedConnectorRequired,
    previewRequired,
    explicitHumanApprovalRequired,
    ledgerRequired,
    simulationFirst: true,
    realMoneyAction,
    irreversibleAction,
    criticalValueMovement,
    blockers: unique(blockers),
    requiredControls: unique(requiredControls),
    reasons: unique(reasons),
  };
}

export function classifyZavorthTransactionRisk(
  input: Pick<ZavorthTransactionPlaneSafetyInput, 'actionKind' | 'executionMode' | 'usesRealMoney' | 'movesExternalValue'>,
): ZavorthTransactionRiskLevel {
  if (input.movesExternalValue === true || ZAVORTH_TRANSACTION_CRITICAL_VALUE_MOVEMENT_ACTIONS.includes(input.actionKind)) {
    return 'critical';
  }

  if (
    input.usesRealMoney === true
    || ZAVORTH_TRANSACTION_REAL_MONEY_ACTIONS.includes(input.actionKind)
    || input.executionMode === 'live'
    || input.actionKind === 'mandate-create'
  ) {
    return 'high';
  }

  if (['refund-request', 'trade-cancel', 'mandate-revoke', 'subscription-cancel'].includes(input.actionKind)) {
    return 'medium';
  }

  return 'low';
}

function resolveTransactionDecisionStatus(
  blockers: string[],
  liveEffect: boolean,
): ZavorthTransactionDecisionStatus {
  if (blockers.length === 0) {
    return liveEffect ? 'allowed' : 'simulation-only';
  }
  if (blockers.includes('transaction_preview_required')) {
    return 'needs-preview';
  }
  if (blockers.includes('explicit_human_approval_required')) {
    return 'needs-approval';
  }
  if (blockers.includes('typed_connector_required') || blockers.includes('trusted_connector_required')) {
    return 'needs-connector';
  }
  if (blockers.includes('transaction_ledger_required')) {
    return 'needs-ledger';
  }
  return 'blocked';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
