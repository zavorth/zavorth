import { createHash } from 'node:crypto';
import { ZavorthTransactionPlanePolicyService } from './ZavorthTransactionPlanePolicyService.js';

import {
  buildZavorthTransactionIntentContractSnapshot,
  ZAVORTH_TRANSACTION_INTENT_CONTRACT_VERSION,
  type ZavorthNaturalFirstTransactionRoute,
  type ZavorthTransactionApprovalPreference,
  type ZavorthTransactionIntent,
  type ZavorthTransactionIntentCondition,
  type ZavorthTransactionIntentContractSnapshot,
  type ZavorthTransactionIntentKind,
  type ZavorthTransactionIntentLimit,
  type ZavorthTransactionIntentParseInput,
  type ZavorthTransactionIntentParseResult,
  type ZavorthTransactionIntentDryRunMode,
  type ZavorthTransactionIntentTarget,
  type ZavorthTransactionIntentTargetKind,
  type ZavorthTransactionIntentWindow,
} from '../contracts/ZavorthTransactionIntentContract.js';
import type {
  ZavorthTransactionActionKind,
  ZavorthTransactionExecutionMode,
  ZavorthTransactionPlaneSafetyInput,
} from '../contracts/ZavorthTransactionPlaneContract.js';

/**
 * Structured kind → default action/target mapping.
 * Free text never selects entries here — only input.kind / input.actionKind / input.targetKind.
 */
type KindDefaults = {
  actionKind: ZavorthTransactionActionKind;
  targetKind: ZavorthTransactionIntentTargetKind;
};

const KIND_DEFAULTS: Readonly<Record<ZavorthTransactionIntentKind, KindDefaults>> = {
  'withdraw-asset': { actionKind: 'asset-withdrawal', targetKind: 'asset' },
  'transfer-asset': { actionKind: 'asset-transfer', targetKind: 'asset' },
  'execute-trade': { actionKind: 'trade-order', targetKind: 'asset' },
  'convert-currency': { actionKind: 'currency-conversion', targetKind: 'currency' },
  'buy-api-credits': { actionKind: 'api-credit-purchase', targetKind: 'api-credit' },
  'cancel-subscription': { actionKind: 'subscription-cancel', targetKind: 'subscription' },
  'renew-service': { actionKind: 'subscription-create', targetKind: 'service' },
  'pay-bill': { actionKind: 'payment-submit', targetKind: 'bill' },
  'restock-inventory': { actionKind: 'purchase-submit', targetKind: 'inventory-item' },
  'monitor-price': { actionKind: 'price-monitor', targetKind: 'product' },
  'purchase-product': { actionKind: 'purchase-submit', targetKind: 'product' },
  'unknown-transaction': { actionKind: 'cart-preview', targetKind: 'unknown' },
};

const ASSET_SYMBOLS = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC'] as const;

export class ZavorthTransactionIntentService {
  public constructor(private readonly policy = new ZavorthTransactionPlanePolicyService()) {}

  public buildSnapshot(): ZavorthTransactionIntentContractSnapshot {
    return buildZavorthTransactionIntentContractSnapshot();
  }

  public parse(input: ZavorthTransactionIntentParseInput): ZavorthTransactionIntentParseResult {
    const now = input.now ?? new Date();
    const redaction = redactTransactionSourceText(input.text);
    const normalized = normalizeText(redaction.text);

    // Purity: free text never maps keywords to product kind. Structured input only.
    const hasStructuredKind = input.kind !== undefined || input.actionKind !== undefined;
    const kind: ZavorthTransactionIntentKind = input.kind ?? 'unknown-transaction';
    const defaults = KIND_DEFAULTS[kind] ?? KIND_DEFAULTS['unknown-transaction'];
    const actionKind: ZavorthTransactionActionKind = input.actionKind ?? defaults.actionKind;
    const structuredTargetKind: ZavorthTransactionIntentTargetKind = input.targetKind ?? defaults.targetKind;

    // Soft field extraction only when kind/action is structured — never activates kind from text.
    const target = hasStructuredKind
      ? extractTarget(redaction.text, normalized, structuredTargetKind)
      : { kind: 'unknown' as const, label: 'unknown', vendorHints: [] as string[] };
    const limits = hasStructuredKind ? extractLimits(redaction.text) : [];
    const conditions = hasStructuredKind
      ? extractConditions(redaction.text, limits)
      : [{ kind: 'always' as const, rawText: 'no explicit condition detected' }];
    const window = hasStructuredKind ? extractWindow(redaction.text, now) : undefined;

    const approvalPreference = detectApprovalPreference(normalized, actionKind);
    const dryRunMode = detectDryRunMode(normalized, actionKind);
    const executionMode = dryRunModeToExecutionMode(dryRunMode);
    const naturalFirstRoute = routeIntent(kind, actionKind, approvalPreference);
    const missingFields = buildMissingFields(kind, target, limits, conditions);
    const safetyInput = buildSafetyInput({
      actionKind,
      executionMode,
      sourceSurface: input.channel,
      sourceWasRedacted: redaction.wasRedacted,
    });
    const safetyDecision = this.policy.evaluate(safetyInput);
    const policySummary = buildPolicySummary(safetyDecision);
    const confidence = scoreConfidence(kind, target, limits, conditions, redaction.wasRedacted);
    const needsClarification =
      kind === 'unknown-transaction' || missingFields.length > 0 || safetyDecision.status === 'blocked';

    const intent: ZavorthTransactionIntent = {
      version: ZAVORTH_TRANSACTION_INTENT_CONTRACT_VERSION,
      id: buildIntentId(redaction.text, input.channel, now),
      kind,
      actionKind,
      sourceText: redaction.text,
      target,
      conditions,
      limits,
      ...(window ? { window } : {}),
      approvalPreference,
      dryRunMode,
      executionMode,
      riskLevel: safetyDecision.riskLevel,
      naturalFirstRoute,
      confidence,
      needsClarification,
      clarifyingQuestions: buildClarifyingQuestions(kind, missingFields, safetyDecision.status),
      safetyDecision,
      policySummary,
      extraction: {
        sourceWasRedacted: redaction.wasRedacted,
        redactionMarkers: redaction.markers,
        // Keywords never drive kind; surface structured kind only when present.
        detectedKeywords: hasStructuredKind ? [kind] : [],
        detectedAssets: extractAssetSymbols(redaction.text),
        detectedCurrencies: extractCurrencyCodes(redaction.text),
        missingFields,
      },
    };

    return {
      version: ZAVORTH_TRANSACTION_INTENT_CONTRACT_VERSION,
      parsedAt: now.toISOString(),
      status: kind === 'unknown-transaction' ? 'not-transactional' : 'parsed',
      intent,
    };
  }

  public renderReport(result: ZavorthTransactionIntentParseResult): string {
    const intent = result.intent;
    const lines = [
      '[transaction-intent] Intent model transaction intent',
      `[transaction-intent] status: ${result.status}`,
      `[transaction-intent] kind: ${intent.kind}`,
      `[transaction-intent] action: ${intent.actionKind}`,
      `[transaction-intent] target: ${intent.target.kind}:${intent.target.label}`,
      `[transaction-intent] route: ${intent.naturalFirstRoute}`,
      `[transaction-intent] risk: ${intent.riskLevel}`,
      `[transaction-intent] execution-mode: ${intent.executionMode}`,
      `[transaction-intent] approval: ${intent.approvalPreference}`,
      `[transaction-intent] policy: ${intent.safetyDecision.status}`,
    ];

    if (intent.limits.length > 0) {
      lines.push(
        `[transaction-intent] limits: ${intent.limits
          .map((limit) => `${limit.currency} ${limit.amount} (${limit.scope})`)
          .join(', ')}`,
      );
    }

    if (intent.conditions.length > 0) {
      lines.push(
        `[transaction-intent] conditions: ${intent.conditions
          .map(
            (condition) =>
              `${condition.kind}${condition.value === undefined ? '' : `=${condition.value}${condition.unit ?? ''}`}`,
          )
          .join(', ')}`,
      );
    }

    if (intent.needsClarification) {
      lines.push(`[transaction-intent] clarify: ${intent.clarifyingQuestions.join(' | ')}`);
    }

    for (const item of intent.policySummary) {
      lines.push(`[transaction-intent] control: ${item}`);
    }

    return lines.join('\n');
  }
}

function buildSafetyInput(input: {
  actionKind: ZavorthTransactionActionKind;
  executionMode: ZavorthTransactionExecutionMode;
  sourceSurface?: string;
  sourceWasRedacted: boolean;
}): ZavorthTransactionPlaneSafetyInput {
  return {
    actor: 'zavorth-runtime',
    actionKind: input.actionKind,
    executionMode: input.executionMode,
    approvalStatus: 'pending',
    typedConnector: false,
    connectorTrusted: false,
    previewGenerated: input.executionMode !== 'live',
    ledgerEnabled: true,
    touchesRawSecret: input.sourceWasRedacted,
    persistsRawSecret: false,
    sourceSurface: input.sourceSurface ?? 'natural-first',
  };
}

function redactTransactionSourceText(text: string): { text: string; wasRedacted: boolean; markers: string[] } {
  const markers: string[] = [];
  let redacted = text.replace(
    /\b(api[_-]?key|token|secret|private[_-]?key|senha|password)\b\s*[:=]\s*([^\s,;]+)/gi,
    (_match, label: string) => {
      const marker = label.toLowerCase();
      markers.push(marker);
      return `${label}=[REDACTED]`;
    },
  );

  redacted = redacted.replace(
    /\b(sk-[A-Za-z0-9_-]{12}|pk_live_[A-Za-z0-9_-]{12}|rk_live_[A-Za-z0-9_-]{12})\b/g,
    (match) => {
      markers.push(match.slice(0, 2));
      return '[REDACTED_SECRET]';
    },
  );

  return {
    text: redacted,
    wasRedacted: markers.length > 0,
    markers: [...new Set(markers)],
  };
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Soft target field extraction. Does not activate product kind — caller supplies fallbackKind
 * from structured input only.
 */
function extractTarget(
  rawText: string,
  normalized: string,
  fallbackKind: ZavorthTransactionIntentTargetKind,
): ZavorthTransactionIntentTarget {
  const assets = extractAssetSymbols(rawText);
  if (assets.length > 0) {
    return {
      kind: 'asset',
      label: assets[0] ?? 'asset',
      symbol: assets[0],
      vendorHints: extractVendorHints(rawText),
    };
  }

  return {
    kind: fallbackKind,
    label: fallbackKind === 'unknown' ? 'unknown' : fallbackKind,
    vendorHints: extractVendorHints(rawText),
  };
}

function cleanTargetLabel(value: string): string {
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned : 'unknown';
}

function extractVendorHints(text: string): string[] {
  void text;
  return [];
}

function extractAssetSymbols(text: string): string[] {
  void text;
  return [];
}

function extractCurrencyCodes(text: string): string[] {
  void text;
  return [];
}

function extractLimits(text: string): ZavorthTransactionIntentLimit[] {
  void text;
  return [];
}

function detectLimitScope(text: string): ZavorthTransactionIntentLimit['scope'] {
  void text;
  return 'per-transaction';
}

function dedupeLimits(limits: ZavorthTransactionIntentLimit[]): ZavorthTransactionIntentLimit[] {
  const seen = new Set<string>();
  return limits.filter((limit) => {
    const key = `${limit.currency}:${limit.amount}:${limit.scope}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractConditions(text: string, limits: ZavorthTransactionIntentLimit[]): ZavorthTransactionIntentCondition[] {
  void text;
  void limits;
  return [{ kind: 'always', rawText: 'no explicit condition detected' }];
}

function extractWindow(text: string, now: Date): ZavorthTransactionIntentWindow | undefined {
  void text;
  void now;
  return undefined;
}

function detectApprovalPreference(
  text: string,
  actionKind: ZavorthTransactionActionKind,
): ZavorthTransactionApprovalPreference {
  void text;
  if (actionKind === 'price-monitor' || actionKind === 'market-data-read' || actionKind === 'cart-preview') {
    return 'preview-only';
  }
  return 'explicit';
}

function detectDryRunMode(
  text: string,
  actionKind: ZavorthTransactionActionKind,
): ZavorthTransactionIntentDryRunMode {
  void text;
  if (actionKind === 'price-monitor' || actionKind === 'market-data-read') {
    return 'observe-only';
  }
  return 'preview-first';
}

function dryRunModeToExecutionMode(mode: ZavorthTransactionIntentDryRunMode): ZavorthTransactionExecutionMode {
  if (mode === 'observe-only') {
    return 'observe';
  }
  if (mode === 'paper-first') {
    return 'paper';
  }
  if (mode === 'sandbox-first') {
    return 'sandbox';
  }
  if (mode === 'dry-run-first') {
    return 'dry-run';
  }
  return 'preview';
}

function routeIntent(
  kind: ZavorthTransactionIntentKind,
  actionKind: ZavorthTransactionActionKind,
  approvalPreference: ZavorthTransactionApprovalPreference,
): ZavorthNaturalFirstTransactionRoute {
  if (kind === 'unknown-transaction') {
    return 'llm-reply';
  }
  if (actionKind === 'price-monitor' || actionKind === 'market-data-read' || actionKind === 'cart-preview') {
    return 'tool-preview';
  }
  if (approvalPreference === 'explicit' || approvalPreference === 'auto-requested') {
    return 'approval-proposal';
  }
  return 'tool-preview';
}

function buildMissingFields(
  kind: ZavorthTransactionIntentKind,
  target: ZavorthTransactionIntentTarget,
  limits: ZavorthTransactionIntentLimit[],
  conditions: ZavorthTransactionIntentCondition[],
): string[] {
  const missing = new Set<string>();
  if (kind === 'unknown-transaction') {
    return [];
  }
  if (target.kind === 'unknown' || target.label === 'unknown' || isAmbiguousTargetLabel(target.label)) {
    missing.add('target');
  }
  if (
    [
      'purchase-product',
      'pay-bill',
      'execute-trade',
      'convert-currency',
      'restock-inventory',
      'buy-api-credits',
    ].includes(kind) &&
    limits.length === 0
  ) {
    missing.add('amount_or_limit');
  }
  if (
    ['monitor-price', 'execute-trade'].includes(kind) &&
    conditions.every((condition) => condition.kind === 'always')
  ) {
    missing.add('condition');
  }
  return [...missing];
}

function isAmbiguousTargetLabel(label: string): boolean {
  void label;
  return false;
}

function buildClarifyingQuestions(
  kind: ZavorthTransactionIntentKind,
  missingFields: string[],
  decisionStatus: string,
): string[] {
  const questions: string[] = [];
  if (kind === 'unknown-transaction') {
    questions.push(
      'Which transaction do you want to prepare: purchase, payment, trade, conversion, subscription, or monitoring...',
    );
  }
  if (missingFields.includes('target')) {
    questions.push('What is the target product, asset, service, bill, or subscription...');
  }
  if (missingFields.includes('amount_or_limit')) {
    questions.push('What amount limit should I use before preparing any preview...');
  }
  if (missingFields.includes('condition')) {
    questions.push('What condition should trigger the preview or alert...');
  }
  if (decisionStatus === 'blocked') {
    questions.push('This request contains a raw secret or critical action; confirm a safe vault/preview path.');
  }
  return questions;
}

function scoreConfidence(
  kind: ZavorthTransactionIntentKind,
  target: ZavorthTransactionIntentTarget,
  limits: ZavorthTransactionIntentLimit[],
  conditions: ZavorthTransactionIntentCondition[],
  sourceWasRedacted: boolean,
): number {
  let score = kind === 'unknown-transaction' ? 0.2 : 0.55;
  if (target.kind !== 'unknown') {
    score += 0.15;
  }
  if (limits.length > 0) {
    score += 0.1;
  }
  if (conditions.some((condition) => condition.kind !== 'always')) {
    score += 0.1;
  }
  if (sourceWasRedacted) {
    score -= 0.15;
  }
  return Math.max(0, Math.min(0.95, Number(score.toFixed(2))));
}

function buildPolicySummary(decision: { requiredControls: string[]; blockers: string[]; status: string }): string[] {
  const summary = [`policy status: ${decision.status}`];
  if (decision.requiredControls.length > 0) {
    summary.push(`required controls: ${decision.requiredControls.join(', ')}`);
  }
  if (decision.blockers.length > 0) {
    summary.push(`blockers: ${decision.blockers.join(', ')}`);
  }
  return summary;
}

function buildIntentId(text: string, channel: string | undefined, now: Date): string {
  const hash = createHash('sha256')
    .update(`${now.toISOString()}:${channel ?? 'natural-first'}:${text}`)
    .digest('hex')
    .slice(0, 16);
  return `ztx-intent-${hash}`;
}
