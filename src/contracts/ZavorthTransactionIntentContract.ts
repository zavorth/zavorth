import type {
  ZavorthTransactionActionKind,
  ZavorthTransactionExecutionMode,
  ZavorthTransactionPlaneSafetyDecision,
  ZavorthTransactionRiskLevel,
} from './ZavorthTransactionPlaneContract.js';

export const ZAVORTH_TRANSACTION_INTENT_CONTRACT_VERSION = 'zavorth-transaction-intent/checkpoint-1' as const;

export type ZavorthTransactionIntentKind =
  | 'monitor-price'
  | 'purchase-product'
  | 'pay-bill'
  | 'renew-service'
  | 'execute-trade'
  | 'convert-currency'
  | 'restock-inventory'
  | 'buy-api-credits'
  | 'cancel-subscription'
  | 'withdraw-asset'
  | 'transfer-asset'
  | 'unknown-transaction';

export type ZavorthTransactionIntentTargetKind =
  | 'product'
  | 'asset'
  | 'bill'
  | 'subscription'
  | 'service'
  | 'api-credit'
  | 'inventory-item'
  | 'currency'
  | 'unknown';

export type ZavorthTransactionApprovalPreference =
  | 'explicit'
  | 'preview-only'
  | 'auto-requested'
  | 'none'
  | 'unknown';

export type ZavorthTransactionIntentSimulationMode =
  | 'preview-first'
  | 'dry-run-first'
  | 'sandbox-first'
  | 'paper-first'
  | 'observe-only';

export type ZavorthNaturalFirstTransactionRoute =
  | 'light-chat'
  | 'llm-reply'
  | 'tool-preview'
  | 'approval-proposal'
  | 'governed-execution';

export type ZavorthTransactionIntentTarget = {
  kind: ZavorthTransactionIntentTargetKind;
  label: string;
  symbol?: string;
  vendorHints: string[];
};

export type ZavorthTransactionIntentCondition = {
  kind:
    | 'price-below'
    | 'price-above'
    | 'percent-drop'
    | 'percent-rise'
    | 'stock-below'
    | 'date-before'
    | 'manual-confirmation'
    | 'always';
  value?: number;
  unit?: string;
  rawText: string;
};

export type ZavorthTransactionIntentLimit = {
  amount: number;
  currency: string;
  scope: 'per-transaction' | 'daily' | 'mandate' | 'unknown';
  rawText: string;
};

export type ZavorthTransactionIntentWindow = {
  startsAt?: string;
  expiresAt?: string;
  durationText?: string;
  rawText?: string;
};

export type ZavorthTransactionIntentExtraction = {
  sourceWasRedacted: boolean;
  redactionMarkers: string[];
  detectedKeywords: string[];
  detectedAssets: string[];
  detectedCurrencies: string[];
  missingFields: string[];
};

export type ZavorthTransactionIntent = {
  version: typeof ZAVORTH_TRANSACTION_INTENT_CONTRACT_VERSION;
  id: string;
  kind: ZavorthTransactionIntentKind;
  actionKind: ZavorthTransactionActionKind;
  sourceText: string;
  target: ZavorthTransactionIntentTarget;
  conditions: ZavorthTransactionIntentCondition[];
  limits: ZavorthTransactionIntentLimit[];
  window?: ZavorthTransactionIntentWindow;
  approvalPreference: ZavorthTransactionApprovalPreference;
  simulationMode: ZavorthTransactionIntentSimulationMode;
  executionMode: ZavorthTransactionExecutionMode;
  riskLevel: ZavorthTransactionRiskLevel;
  naturalFirstRoute: ZavorthNaturalFirstTransactionRoute;
  confidence: number;
  needsClarification: boolean;
  clarifyingQuestions: string[];
  safetyDecision: ZavorthTransactionPlaneSafetyDecision;
  policySummary: string[];
  extraction: ZavorthTransactionIntentExtraction;
};

export type ZavorthTransactionIntentParseInput = {
  text: string;
  channel?: string;
  sessionId?: string;
  now?: Date;
};

export type ZavorthTransactionIntentParseResult = {
  version: typeof ZAVORTH_TRANSACTION_INTENT_CONTRACT_VERSION;
  parsedAt: string;
  status: 'parsed' | 'not-transactional';
  intent: ZavorthTransactionIntent;
};

export type ZavorthTransactionIntentExample = {
  text: string;
  expectedKind: ZavorthTransactionIntentKind;
  expectedActionKind: ZavorthTransactionActionKind;
  expectedRoute: ZavorthNaturalFirstTransactionRoute;
};

export type ZavorthTransactionIntentContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_INTENT_CONTRACT_VERSION;
  summary: string;
  supportedIntents: ZavorthTransactionIntentKind[];
  supportedTargets: ZavorthTransactionIntentTargetKind[];
  naturalFirstRoutes: ZavorthNaturalFirstTransactionRoute[];
  examples: ZavorthTransactionIntentExample[];
  invariants: string[];
};

export const ZAVORTH_TRANSACTION_INTENT_SUPPORTED_INTENTS: readonly ZavorthTransactionIntentKind[] = [
  'monitor-price',
  'purchase-product',
  'pay-bill',
  'renew-service',
  'execute-trade',
  'convert-currency',
  'restock-inventory',
  'buy-api-credits',
  'cancel-subscription',
  'withdraw-asset',
  'transfer-asset',
  'unknown-transaction',
] as const;

export const ZAVORTH_TRANSACTION_INTENT_SUPPORTED_TARGETS: readonly ZavorthTransactionIntentTargetKind[] = [
  'product',
  'asset',
  'bill',
  'subscription',
  'service',
  'api-credit',
  'inventory-item',
  'currency',
  'unknown',
] as const;

export const ZAVORTH_TRANSACTION_INTENT_EXAMPLES: readonly ZavorthTransactionIntentExample[] = [
  {
    text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
    expectedKind: 'execute-trade',
    expectedActionKind: 'trade-order',
    expectedRoute: 'approval-proposal',
  },
  {
    text: 'Monitore notebook abaixo de R$3500 e me avise.',
    expectedKind: 'monitor-price',
    expectedActionKind: 'price-monitor',
    expectedRoute: 'tool-preview',
  },
  {
    text: 'Pague a fatura do cartao se ficar abaixo de R$900.',
    expectedKind: 'pay-bill',
    expectedActionKind: 'payment-submit',
    expectedRoute: 'approval-proposal',
  },
  {
    text: 'Cancele minha assinatura do servico X no fim do mes.',
    expectedKind: 'cancel-subscription',
    expectedActionKind: 'subscription-cancel',
    expectedRoute: 'approval-proposal',
  },
] as const;

export function buildZavorthTransactionIntentContractSnapshot(): ZavorthTransactionIntentContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_INTENT_CONTRACT_VERSION,
    summary: 'Natural-language transaction intent contract for Zavorth Transaction Plane Intent model.',
    supportedIntents: [...ZAVORTH_TRANSACTION_INTENT_SUPPORTED_INTENTS],
    supportedTargets: [...ZAVORTH_TRANSACTION_INTENT_SUPPORTED_TARGETS],
    naturalFirstRoutes: ['light-chat', 'llm-reply', 'tool-preview', 'approval-proposal', 'governed-execution'],
    examples: [...ZAVORTH_TRANSACTION_INTENT_EXAMPLES],
    invariants: [
      'Intent parsing never executes a transaction.',
      'Raw secrets are redacted before intent output is persisted or displayed.',
      'Real-money actions are routed to preview or approval proposal, never direct execution.',
      'Every parsed intent carries a Transaction Plane safety decision.',
      'Unknown or underspecified transactional text asks for clarification.',
    ],
  };
}
