import { createHash } from 'node:crypto';
import {
  ZAVORTH_TRANSACTION_CRITICAL_VALUE_MOVEMENT_ACTIONS,
  ZAVORTH_TRANSACTION_REAL_MONEY_ACTIONS,
} from '../contracts/ZavorthTransactionPlaneContract.js';

import type {
  ZavorthTransactionActionKind,
  ZavorthTransactionRiskLevel,
} from '../contracts/ZavorthTransactionPlaneContract.js';

import type { ZavorthTransactionIntent } from '../contracts/ZavorthTransactionIntentContract.js';
import { ZavorthTransactionIntentService } from './ZavorthTransactionIntentService.js';
import {
  buildZavorthTransactionPreviewContractSnapshot,
  ZAVORTH_TRANSACTION_PREVIEW_CONTRACT_VERSION,
  type ZavorthTransactionApprovalEnvelope,
  type ZavorthTransactionConnectorKind,
  type ZavorthTransactionConnectorRequirement,
  type ZavorthTransactionPreview,
  type ZavorthTransactionPreviewBuildInput,
  type ZavorthTransactionPreviewContractSnapshot,
  type ZavorthTransactionPreviewIntentSnapshot,
  type ZavorthTransactionPreviewPolicy,
  type ZavorthTransactionPreviewQuote,
  type ZavorthTransactionPreviewReceipt,
  type ZavorthTransactionPreviewStatus,
  type ZavorthTransactionPreviewValidation,
} from '../contracts/ZavorthTransactionPreviewContract.js';

export class ZavorthTransactionPreviewService {
  public constructor(private readonly intentService = new ZavorthTransactionIntentService()) {}

  public buildSnapshot(): ZavorthTransactionPreviewContractSnapshot {
    return buildZavorthTransactionPreviewContractSnapshot();
  }

  public buildPreview(input: ZavorthTransactionPreviewBuildInput): ZavorthTransactionPreview {
    const now = input.now ?? new Date();
    const intent =
      input.intent ??
      this.intentService.parse({
        text: input.text ?? '',
        kind: input.kind,
        actionKind: input.actionKind,
        targetKind: input.targetKind,
        channel: input.channel,
        now,
      }).intent;
    const previewId = buildPreviewId(intent, input.channel, now);
    const status = resolvePreviewStatus(intent);
    const connector = buildConnectorRequirement(intent);
    const quote = buildQuote(intent);
    const approval = buildApprovalEnvelope(previewId, intent);
    const policy = buildPreviewPolicy(intent);
    const validation = buildValidation(intent, status, connector, quote);
    const receipts = buildReceipts(previewId, intent, status, connector, approval);
    const intentSnapshot = buildIntentSnapshot(intent);

    return {
      version: ZAVORTH_TRANSACTION_PREVIEW_CONTRACT_VERSION,
      id: previewId,
      createdAt: now.toISOString(),
      status,
      title: buildPreviewTitle(intent),
      summary: buildPreviewSummary(intent, status, quote, connector),
      intent: intentSnapshot,
      connector,
      quote,
      approval,
      policy,
      validation,
      receipts,
      operatorReview: buildOperatorReview(intent, quote, connector, approval, validation),
      nextSteps: buildNextSteps(status, intent, approval, validation),
    };
  }

  public renderReport(preview: ZavorthTransactionPreview): string {
    const lines = [
      '[transaction-preview] Preview engine transaction preview',
      `[transaction-preview] status: ${preview.status}`,
      `[transaction-preview] title: ${preview.title}`,
      `[transaction-preview] action: ${preview.intent.actionKind}`,
      `[transaction-preview] target: ${preview.intent.target.kind}:${preview.intent.target.label}`,
      `[transaction-preview] route: ${preview.intent.naturalFirstRoute}`,
      `[transaction-preview] risk: ${preview.intent.riskLevel}`,
      `[transaction-preview] connector: ${preview.connector.kind}`,
      `[transaction-preview] quote: ${renderQuote(preview.quote)}`,
      `[transaction-preview] approval: ${preview.approval.required ? 'required' : 'not-required'} (${preview.approval.status})`,
      `[transaction-preview] executable-now: ${preview.policy.executableNow}`,
      `[transaction-preview] live-action-applied: ${preview.policy.liveActionApplied}`,
    ];

    if (preview.validation.missingFields.length > 0) {
      lines.push(`[transaction-preview] missing: ${preview.validation.missingFields.join(', ')}`);
    }

    if (preview.validation.warnings.length > 0) {
      lines.push(`[transaction-preview] warnings: ${preview.validation.warnings.join(' | ')}`);
    }

    for (const step of preview.nextSteps) {
      lines.push(`[transaction-preview] next: ${step}`);
    }

    for (const receipt of preview.receipts) {
      lines.push(`[transaction-preview] receipt: ${receipt.id} - ${receipt.summary}`);
    }

    return lines.join('\n');
  }
}

function resolvePreviewStatus(intent: ZavorthTransactionIntent): ZavorthTransactionPreviewStatus {
  if (!intent.safetyDecision.allowed) {
    return 'blocked';
  }
  if (intent.needsClarification || intent.extraction.missingFields.length > 0) {
    return 'needs-clarification';
  }
  return 'ready-for-review';
}

function buildIntentSnapshot(intent: ZavorthTransactionIntent): ZavorthTransactionPreviewIntentSnapshot {
  return {
    intentId: intent.id,
    kind: intent.kind,
    actionKind: intent.actionKind,
    target: intent.target,
    conditions: intent.conditions,
    limits: intent.limits,
    ...(intent.window ? { window: intent.window } : {}),
    naturalFirstRoute: intent.naturalFirstRoute,
    riskLevel: intent.riskLevel,
    sourceText: intent.sourceText,
  };
}

function buildConnectorRequirement(intent: ZavorthTransactionIntent): ZavorthTransactionConnectorRequirement {
  const kind = connectorKindForAction(intent.actionKind);
  const liveRequired = intent.safetyDecision.previewRequired || intent.safetyDecision.explicitHumanApprovalRequired;
  const trustedRequired = intent.safetyDecision.trustedConnectorRequired || isCriticalAction(intent.actionKind);
  const credentialRequired = liveRequired && kind !== 'market-data';

  return {
    kind,
    requiredForLive: liveRequired,
    trustedConnectorRequired: trustedRequired,
    credentialRefRequired: credentialRequired,
    rawSecretAllowed: false,
    suggestedAdapterIds: suggestedAdapters(kind),
    notes: connectorNotes(intent, kind, credentialRequired),
  };
}

function connectorKindForAction(actionKind: ZavorthTransactionActionKind): ZavorthTransactionConnectorKind {
  switch (actionKind) {
    case 'market-data-read':
    case 'price-monitor':
    case 'cart-preview':
      return 'market-data';
    case 'purchase-submit':
    case 'api-credit-purchase':
      return 'commerce';
    case 'payment-submit':
    case 'refund-request':
    case 'mandate-create':
    case 'mandate-revoke':
      return 'payment';
    case 'trade-order':
    case 'trade-cancel':
      return 'exchange';
    case 'currency-conversion':
      return 'currency-exchange';
    case 'subscription-create':
    case 'subscription-cancel':
      return 'subscription';
    case 'asset-transfer':
    case 'asset-withdrawal':
      return 'wallet';
    default:
      return 'unknown';
  }
}

function suggestedAdapters(kind: ZavorthTransactionConnectorKind): string[] {
  switch (kind) {
    case 'market-data':
      return ['zavorth.connector.market-data.typed'];
    case 'commerce':
      return ['zavorth.connector.commerce.typed'];
    case 'payment':
      return ['zavorth.connector.payment.typed'];
    case 'exchange':
      return ['zavorth.connector.exchange.typed'];
    case 'currency-exchange':
      return ['zavorth.connector.fx.typed'];
    case 'subscription':
      return ['zavorth.connector.subscription.typed'];
    case 'wallet':
      return ['zavorth.connector.wallet.owner-gated'];
    default:
      return [];
  }
}

function connectorNotes(
  intent: ZavorthTransactionIntent,
  kind: ZavorthTransactionConnectorKind,
  credentialRequired: boolean,
): string[] {
  const notes = [`connector kind ${kind} selected from action ${intent.actionKind}`];
  if (credentialRequired) {
    notes.push('live use must reference a vault credential, never raw secret text');
  }
  if (isCriticalAction(intent.actionKind)) {
    notes.push('critical value movement remains owner-gated and blocked for live execution by default');
  }
  return notes;
}

function buildQuote(intent: ZavorthTransactionIntent): ZavorthTransactionPreviewQuote {
  const firstLimit = intent.limits[0];
  if (firstLimit) {
    return {
      status: 'estimated',
      amount: firstLimit.amount,
      currency: firstLimit.currency,
      feeStatus: requiresFeeQuote(intent.actionKind) ? 'not-quoted' : 'not-required',
      notes: [
        'amount comes from natural-language limit and must be confirmed by a typed connector before live execution',
      ],
    };
  }

  if (isRealMoneyAction(intent.actionKind)) {
    return {
      status: 'missing-limit',
      feeStatus: 'not-quoted',
      notes: ['real-money action needs an amount or spending limit before approval'],
    };
  }

  return {
    status: 'not-required',
    feeStatus: 'not-required',
    notes: ['no monetary quote is required for this preview'],
  };
}

function buildApprovalEnvelope(
  previewId: string,
  intent: ZavorthTransactionIntent,
): ZavorthTransactionApprovalEnvelope {
  const required =
    intent.safetyDecision.explicitHumanApprovalRequired || intent.naturalFirstRoute === 'approval-proposal';
  const scope = intent.limits.some((limit) => limit.scope === 'mandate')
    ? 'future-mandate'
    : required
      ? 'single-preview'
      : 'none';
  return {
    required,
    status: required ? 'pending' : 'none',
    scope,
    reason: required
      ? 'Transaction preview requires explicit human approval before any live execution plan.'
      : 'Read-only or preview-only transaction does not require approval.',
    ...(required ? { approvalId: `${previewId}.approval` } : {}),
    approvalPrompt: buildApprovalPrompt(intent, required),
  };
}

function buildApprovalPrompt(intent: ZavorthTransactionIntent, required: boolean): string {
  if (!required) {
    return 'No approval requested for this preview.';
  }
  const amount = intent.limits[0] ? `${intent.limits[0]?.currency} ${intent.limits[0]?.amount}` : 'amount pending';
  return `Approve preview for ${intent.actionKind} on ${intent.target.label} with limit ${amount}.`;
}

function buildPreviewPolicy(intent: ZavorthTransactionIntent): ZavorthTransactionPreviewPolicy {
  return {
    decision: intent.safetyDecision,
    requiredControls: intent.safetyDecision.requiredControls,
    blockers: intent.safetyDecision.blockers,
    liveActionApplied: false,
    executableNow: false,
  };
}

function buildValidation(
  intent: ZavorthTransactionIntent,
  status: ZavorthTransactionPreviewStatus,
  connector: ZavorthTransactionConnectorRequirement,
  quote: ZavorthTransactionPreviewQuote,
): ZavorthTransactionPreviewValidation {
  const warnings: string[] = [];
  if (intent.approvalPreference === 'auto-requested') {
    warnings.push('automatic execution was requested, but Zavorth keeps real transactions approval-gated');
  }
  if (quote.status === 'missing-limit') {
    warnings.push('amount or limit missing for real-money preview');
  }
  if (connector.kind === 'wallet') {
    warnings.push('wallet value movement remains blocked by default until a later owner-gated phase');
  }

  return {
    canAskApproval:
      status === 'ready-for-review' &&
      (intent.safetyDecision.explicitHumanApprovalRequired || intent.naturalFirstRoute === 'approval-proposal'),
    canCreateLiveExecutionPlan: false,
    missingFields: intent.extraction.missingFields,
    warnings,
  };
}

function buildReceipts(
  previewId: string,
  intent: ZavorthTransactionIntent,
  status: ZavorthTransactionPreviewStatus,
  connector: ZavorthTransactionConnectorRequirement,
  approval: ZavorthTransactionApprovalEnvelope,
): ZavorthTransactionPreviewReceipt[] {
  return [
    {
      id: `${previewId}.intent`,
      summary: `Intent ${intent.kind} normalized as ${intent.actionKind}.`,
    },
    {
      id: `${previewId}.policy`,
      summary: `Security contract policy returned ${intent.safetyDecision.status}.`,
    },
    {
      id: `${previewId}.connector`,
      summary: `Connector requirement prepared for ${connector.kind}.`,
    },
    {
      id: `${previewId}.approval`,
      summary: approval.required ? 'Approval envelope created in pending state.' : 'Approval not required for preview.',
    },
    {
      id: `${previewId}.effect`,
      summary: `Preview status ${status}; liveActionApplied=false.`,
    },
  ];
}

function buildOperatorReview(
  intent: ZavorthTransactionIntent,
  quote: ZavorthTransactionPreviewQuote,
  connector: ZavorthTransactionConnectorRequirement,
  approval: ZavorthTransactionApprovalEnvelope,
  validation: ZavorthTransactionPreviewValidation,
): string[] {
  const review = [
    `Confirm target: ${intent.target.kind}:${intent.target.label}.`,
    `Confirm action: ${intent.actionKind}.`,
    `Confirm connector: ${connector.kind}.`,
    `Confirm quote: ${renderQuote(quote)}.`,
  ];
  if (approval.required) {
    review.push(`Approval required: ${approval.approvalId ?? 'pending id'}.`);
  }
  for (const warning of validation.warnings) {
    review.push(`Warning: ${warning}.`);
  }
  return review;
}

function buildNextSteps(
  status: ZavorthTransactionPreviewStatus,
  intent: ZavorthTransactionIntent,
  approval: ZavorthTransactionApprovalEnvelope,
  validation: ZavorthTransactionPreviewValidation,
): string[] {
  if (status === 'blocked') {
    return ['Remove raw secrets or critical blockers, then rebuild the preview.'];
  }
  if (status === 'needs-clarification') {
    return intent.clarifyingQuestions.length > 0
      ? intent.clarifyingQuestions
      : ['Clarify missing target, amount, connector or condition before approval.'];
  }
  if (approval.required && validation.canAskApproval) {
    return ['Show this preview to the operator and request explicit approval before any live execution plan.'];
  }
  return ['Keep this as read-only preview or monitoring setup; no live execution is available in Preview engine.'];
}

function buildPreviewTitle(intent: ZavorthTransactionIntent): string {
  return `${intent.kind} preview for ${intent.target.label}`;
}

function buildPreviewSummary(
  intent: ZavorthTransactionIntent,
  status: ZavorthTransactionPreviewStatus,
  quote: ZavorthTransactionPreviewQuote,
  connector: ZavorthTransactionConnectorRequirement,
): string {
  return `${status}: ${intent.actionKind} via ${connector.kind}, quote=${renderQuote(quote)}, liveActionApplied=false.`;
}

function renderQuote(quote: ZavorthTransactionPreviewQuote): string {
  if (quote.amount !== undefined && quote.currency) {
    return `${quote.currency} ${quote.amount} (${quote.status}, fees=${quote.feeStatus})`;
  }
  return `${quote.status} (fees=${quote.feeStatus})`;
}

function buildPreviewId(intent: ZavorthTransactionIntent, channel: string | undefined, now: Date): string {
  const hash = createHash('sha256')
    .update(`${now.toISOString()}:${channel ?? 'natural-first'}:${intent.id}:${intent.actionKind}:${intent.sourceText}`)
    .digest('hex')
    .slice(0, 16);
  return `ztx-preview-${hash}`;
}

function isRealMoneyAction(actionKind: ZavorthTransactionActionKind): boolean {
  return ZAVORTH_TRANSACTION_REAL_MONEY_ACTIONS.includes(actionKind);
}

function isCriticalAction(actionKind: ZavorthTransactionActionKind): boolean {
  return ZAVORTH_TRANSACTION_CRITICAL_VALUE_MOVEMENT_ACTIONS.includes(actionKind);
}

function requiresFeeQuote(actionKind: ZavorthTransactionActionKind): boolean {
  return isRealMoneyAction(actionKind) || ['refund-request', 'trade-cancel'].includes(actionKind);
}
