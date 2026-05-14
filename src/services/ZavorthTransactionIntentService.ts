import { createHash } from 'node:crypto';

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
  type ZavorthTransactionIntentSimulationMode,
  type ZavorthTransactionIntentTarget,
  type ZavorthTransactionIntentTargetKind,
  type ZavorthTransactionIntentWindow,
} from '../contracts/ZavorthTransactionIntentContract.js';
import type {
  ZavorthTransactionActionKind,
  ZavorthTransactionExecutionMode,
  ZavorthTransactionPlaneSafetyInput,
} from '../contracts/ZavorthTransactionPlaneContract.js';
import { ZavorthTransactionPlanePolicyService } from './ZavorthTransactionPlanePolicyService.js';

type IntentRule = {
  kind: ZavorthTransactionIntentKind;
  actionKind: ZavorthTransactionActionKind;
  targetKind: ZavorthTransactionIntentTargetKind;
  keywords: RegExp[];
};

const INTENT_RULES: readonly IntentRule[] = [
  {
    kind: 'withdraw-asset',
    actionKind: 'asset-withdrawal',
    targetKind: 'asset',
    keywords: [/\b(saque|sacar|retire|retirar|withdraw)\b/i],
  },
  {
    kind: 'transfer-asset',
    actionKind: 'asset-transfer',
    targetKind: 'asset',
    keywords: [/\b(transfira|transferir|envie|mandar|send)\b/i, /\b(carteira|wallet|endereco)\b/i],
  },
  {
    kind: 'execute-trade',
    actionKind: 'trade-order',
    targetKind: 'asset',
    keywords: [/\b(compre|comprar|venda|vender|trade|ordem|order)\b/i, /\b(btc|eth|sol|usdt|acao|acoes|cripto|crypto)\b/i],
  },
  {
    kind: 'convert-currency',
    actionKind: 'currency-conversion',
    targetKind: 'currency',
    keywords: [/\b(converta|converter|troque|cambio|exchange)\b/i, /\b(real|reais|brl|usd|dolar|eur|euro)\b/i],
  },
  {
    kind: 'buy-api-credits',
    actionKind: 'api-credit-purchase',
    targetKind: 'api-credit',
    keywords: [/\b(credito|creditos|tokens?)\b/i, /\b(api|openai|anthropic|provider|provedor)\b/i],
  },
  {
    kind: 'cancel-subscription',
    actionKind: 'subscription-cancel',
    targetKind: 'subscription',
    keywords: [/\b(cancele|cancelar|cancelamento)\b/i, /\b(assinatura|plano|servico|service)\b/i],
  },
  {
    kind: 'renew-service',
    actionKind: 'subscription-create',
    targetKind: 'service',
    keywords: [/\b(renove|renovar|renew)\b/i, /\b(assinatura|dominio|servico|plano|service)\b/i],
  },
  {
    kind: 'pay-bill',
    actionKind: 'payment-submit',
    targetKind: 'bill',
    keywords: [/\b(pague|pagar|pagamento|pix|boleto|fatura|conta)\b/i],
  },
  {
    kind: 'restock-inventory',
    actionKind: 'purchase-submit',
    targetKind: 'inventory-item',
    keywords: [/\b(repor|reabastecer|estoque|restock|inventory)\b/i],
  },
  {
    kind: 'monitor-price',
    actionKind: 'price-monitor',
    targetKind: 'product',
    keywords: [/\b(monitore|monitorar|acompanhe|avise|alerta|watch)\b/i, /\b(preco|preco|abaixo|acima|cair|subir|queda)\b/i],
  },
  {
    kind: 'purchase-product',
    actionKind: 'purchase-submit',
    targetKind: 'product',
    keywords: [/\b(compre|comprar|pedido|checkout|carrinho)\b/i],
  },
] as const;

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
    const rule = detectIntentRule(normalized);
    const actionKind = rule?.actionKind ?? 'cart-preview';
    const kind = rule?.kind ?? 'unknown-transaction';
    const target = extractTarget(redaction.text, normalized, rule?.targetKind ?? 'unknown');
    const limits = extractLimits(redaction.text);
    const conditions = extractConditions(redaction.text, limits);
    const window = extractWindow(redaction.text, now);
    const approvalPreference = detectApprovalPreference(normalized, actionKind);
    const simulationMode = detectSimulationMode(normalized, actionKind);
    const executionMode = simulationModeToExecutionMode(simulationMode);
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
      simulationMode,
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
        detectedKeywords: detectKeywordLabels(normalized),
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
      '[transaction-intent] Phase 1 transaction intent',
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
          .map((condition) => `${condition.kind}${condition.value === undefined ? '' : `=${condition.value}${condition.unit ?? ''}`}`)
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

function detectIntentRule(text: string): IntentRule | undefined {
  return INTENT_RULES.find((rule) => rule.keywords.every((keyword) => keyword.test(text)));
}

function detectKeywordLabels(text: string): string[] {
  const labels = new Set<string>();
  for (const rule of INTENT_RULES) {
    if (rule.keywords.some((keyword) => keyword.test(text))) {
      labels.add(rule.kind);
    }
  }
  return [...labels];
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

  redacted = redacted.replace(/\b(sk-[A-Za-z0-9_-]{12,}|pk_live_[A-Za-z0-9_-]{12,}|rk_live_[A-Za-z0-9_-]{12,})\b/g, (match) => {
    markers.push(match.slice(0, 2));
    return '[REDACTED_SECRET]';
  });

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

function extractTarget(rawText: string, normalized: string, fallbackKind: ZavorthTransactionIntentTargetKind): ZavorthTransactionIntentTarget {
  const assets = extractAssetSymbols(rawText);
  if (assets.length > 0) {
    return {
      kind: 'asset',
      label: assets[0] ?? 'asset',
      symbol: assets[0],
      vendorHints: extractVendorHints(rawText),
    };
  }

  const billMatch = rawText.match(/\b(fatura|boleto|conta|pix)\b(?:\s+(?:do|da|de)\s+([A-Za-z0-9 _.-]{2,40}))?/i);
  if (billMatch) {
    return {
      kind: 'bill',
      label: cleanTargetLabel(billMatch[2] ?? billMatch[1] ?? 'bill'),
      vendorHints: extractVendorHints(rawText),
    };
  }

  const subscriptionMatch = rawText.match(/\b(?:assinatura|plano|servico|service)\b(?:\s+(?:do|da|de)\s+([A-Za-z0-9 _.-]{2,50}))?/i);
  if (subscriptionMatch) {
    return {
      kind: fallbackKind === 'unknown' ? 'subscription' : fallbackKind,
      label: cleanTargetLabel(subscriptionMatch[1] ?? subscriptionMatch[0]),
      vendorHints: extractVendorHints(rawText),
    };
  }

  const productMatch = normalized.match(/\b(?:monitore|monitorar|compre|comprar|repor|reabastecer)\s+([a-z0-9 _.-]{2,60}?)(?:\s+(?:abaixo|acima|ate|se|por|em|no|na)\b|$)/i);
  if (productMatch?.[1]) {
    return {
      kind: fallbackKind === 'unknown' ? 'product' : fallbackKind,
      label: cleanTargetLabel(productMatch[1]),
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
  const cleaned = value.replace(/\s+/g, ' ').replace(/[.,;:]+$/g, '').trim();
  return cleaned.length > 0 ? cleaned : 'unknown';
}

function extractVendorHints(text: string): string[] {
  const hints = new Set<string>();
  for (const match of text.matchAll(/\b(?:na|no|pela|pelo|via)\s+([A-Z][A-Za-z0-9_.-]{2,40})/g)) {
    if (match[1]) {
      hints.add(match[1]);
    }
  }
  return [...hints];
}

function extractAssetSymbols(text: string): string[] {
  const symbols = new Set<string>();
  for (const symbol of ASSET_SYMBOLS) {
    if (new RegExp(`\\b${symbol}\\b`, 'i').test(text)) {
      symbols.add(symbol);
    }
  }
  if (/\bbitcoin\b/i.test(text)) {
    symbols.add('BTC');
  }
  if (/\bethereum\b/i.test(text)) {
    symbols.add('ETH');
  }
  return [...symbols];
}

function extractCurrencyCodes(text: string): string[] {
  const currencies = new Set<string>();
  if (/\b(R\$|BRL|real|reais)\b/i.test(text)) {
    currencies.add('BRL');
  }
  if (/\b(US\$|USD|dolar|dolares)\b/i.test(text)) {
    currencies.add('USD');
  }
  if (/\b(EUR|euro|euros)\b/i.test(text)) {
    currencies.add('EUR');
  }
  return [...currencies];
}

function extractLimits(text: string): ZavorthTransactionIntentLimit[] {
  const limits: ZavorthTransactionIntentLimit[] = [];
  const patterns: Array<{ regex: RegExp; currency: string }> = [
    { regex: /\b(?:R\$|BRL)\s*([0-9][0-9.,]*)/gi, currency: 'BRL' },
    { regex: /\b([0-9][0-9.,]*)\s*(?:reais|BRL)\b/gi, currency: 'BRL' },
    { regex: /\b(?:US\$|USD)\s*([0-9][0-9.,]*)/gi, currency: 'USD' },
    { regex: /\b([0-9][0-9.,]*)\s*(?:dolares|dolar|USD)\b/gi, currency: 'USD' },
    { regex: /\b(?:EUR)\s*([0-9][0-9.,]*)/gi, currency: 'EUR' },
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      const amount = parseLocalizedNumber(match[1] ?? '');
      if (amount !== undefined) {
        limits.push({
          amount,
          currency: pattern.currency,
          scope: detectLimitScope(text),
          rawText: match[0],
        });
      }
    }
  }

  return dedupeLimits(limits);
}

function parseLocalizedNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  let normalized = trimmed;
  if (trimmed.includes(',')) {
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else if (/\.[0-9]{3}$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function detectLimitScope(text: string): ZavorthTransactionIntentLimit['scope'] {
  if (/\b(por dia|diario|daily)\b/i.test(text)) {
    return 'daily';
  }
  if (/\b(mandato|mandate|ate eu cancelar)\b/i.test(text)) {
    return 'mandate';
  }
  if (/\b(por transacao|cada compra|cada ordem)\b/i.test(text)) {
    return 'per-transaction';
  }
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
  const conditions: ZavorthTransactionIntentCondition[] = [];
  const percentDrop = text.match(/\b(?:cair|queda|abaixar|abaixe|drop)\D{0,20}([0-9]+(?:[,.][0-9]+)?)\s*%/i);
  if (percentDrop?.[1]) {
    conditions.push({
      kind: 'percent-drop',
      value: parseLocalizedNumber(percentDrop[1]),
      unit: 'percent',
      rawText: percentDrop[0],
    });
  }

  const percentRise = text.match(/\b(?:subir|alta|rise)\D{0,20}([0-9]+(?:[,.][0-9]+)?)\s*%/i);
  if (percentRise?.[1]) {
    conditions.push({
      kind: 'percent-rise',
      value: parseLocalizedNumber(percentRise[1]),
      unit: 'percent',
      rawText: percentRise[0],
    });
  }

  if (limits.length > 0 && /\b(abaixo|menor que|ate|no maximo|maximo)\b/i.test(text)) {
    conditions.push({
      kind: 'price-below',
      value: limits[0]?.amount,
      unit: limits[0]?.currency,
      rawText: limits[0]?.rawText ?? 'price limit',
    });
  }

  if (limits.length > 0 && /\b(acima|maior que|pelo menos|minimo)\b/i.test(text)) {
    conditions.push({
      kind: 'price-above',
      value: limits[0]?.amount,
      unit: limits[0]?.currency,
      rawText: limits[0]?.rawText ?? 'price limit',
    });
  }

  if (/\b(peca confirmacao|confirmacao antes|aprovar|aprovacao|me confirme)\b/i.test(normalizeText(text))) {
    conditions.push({
      kind: 'manual-confirmation',
      rawText: 'manual confirmation requested',
    });
  }

  return conditions.length > 0 ? conditions : [{ kind: 'always', rawText: 'no explicit condition detected' }];
}

function extractWindow(text: string, now: Date): ZavorthTransactionIntentWindow | undefined {
  const duration = text.match(/\b(?:por|durante)\s+([0-9]+)\s+(minutos?|horas?|dias?|semanas?)\b/i);
  if (duration?.[1] && duration[2]) {
    const amount = Number(duration[1]);
    const unit = normalizeText(duration[2]);
    const expiresAt = addDuration(now, amount, unit);
    return {
      startsAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      durationText: duration[0],
      rawText: duration[0],
    };
  }

  const endOfMonth = /\b(fim do mes|final do mes)\b/i.test(normalizeText(text));
  if (endOfMonth) {
    const expiresAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    return {
      startsAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      durationText: 'fim do mes',
      rawText: 'fim do mes',
    };
  }

  return undefined;
}

function addDuration(now: Date, amount: number, unit: string): Date {
  const copy = new Date(now.getTime());
  if (unit.startsWith('minuto')) {
    copy.setUTCMinutes(copy.getUTCMinutes() + amount);
  } else if (unit.startsWith('hora')) {
    copy.setUTCHours(copy.getUTCHours() + amount);
  } else if (unit.startsWith('semana')) {
    copy.setUTCDate(copy.getUTCDate() + amount * 7);
  } else {
    copy.setUTCDate(copy.getUTCDate() + amount);
  }
  return copy;
}

function detectApprovalPreference(
  text: string,
  actionKind: ZavorthTransactionActionKind,
): ZavorthTransactionApprovalPreference {
  if (/\b(sem aprovar|automatico|automaticamente|auto)\b/i.test(text)) {
    return 'auto-requested';
  }
  if (/\b(peca confirmacao|confirmacao antes|aprovar|aprovacao|me confirme|me avise)\b/i.test(text)) {
    return 'explicit';
  }
  if (actionKind === 'price-monitor' || actionKind === 'market-data-read' || actionKind === 'cart-preview') {
    return 'preview-only';
  }
  return 'explicit';
}

function detectSimulationMode(
  text: string,
  actionKind: ZavorthTransactionActionKind,
): ZavorthTransactionIntentSimulationMode {
  if (actionKind === 'price-monitor' || actionKind === 'market-data-read') {
    return 'observe-only';
  }
  if (/\b(paper|simulado|simulada)\b/i.test(text)) {
    return 'paper-first';
  }
  if (/\b(sandbox|homologacao)\b/i.test(text)) {
    return 'sandbox-first';
  }
  if (/\b(dry-run|teste|testar)\b/i.test(text)) {
    return 'dry-run-first';
  }
  return 'preview-first';
}

function simulationModeToExecutionMode(mode: ZavorthTransactionIntentSimulationMode): ZavorthTransactionExecutionMode {
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
  if (target.kind === 'unknown' || target.label === 'unknown' || isAmbiguousTargetLabel(target.label)) {
    missing.add('target');
  }
  if (
    ['purchase-product', 'pay-bill', 'execute-trade', 'convert-currency', 'restock-inventory', 'buy-api-credits'].includes(kind) &&
    limits.length === 0
  ) {
    missing.add('amount_or_limit');
  }
  if (['monitor-price', 'execute-trade'].includes(kind) && conditions.every((condition) => condition.kind === 'always')) {
    missing.add('condition');
  }
  return [...missing];
}

function isAmbiguousTargetLabel(label: string): boolean {
  const normalized = normalizeText(label);
  return /^(isso|aquilo|esse|essa|este|esta|ele|ela|algo|coisa)\b/.test(normalized);
}

function buildClarifyingQuestions(
  kind: ZavorthTransactionIntentKind,
  missingFields: string[],
  decisionStatus: string,
): string[] {
  const questions: string[] = [];
  if (kind === 'unknown-transaction') {
    questions.push('Qual transacao voce quer preparar: compra, pagamento, trade, conversao, assinatura ou monitoramento?');
  }
  if (missingFields.includes('target')) {
    questions.push('Qual e o produto, ativo, servico, boleto ou assinatura alvo?');
  }
  if (missingFields.includes('amount_or_limit')) {
    questions.push('Qual limite de valor devo usar antes de preparar qualquer preview?');
  }
  if (missingFields.includes('condition')) {
    questions.push('Qual condicao deve disparar o preview ou alerta?');
  }
  if (decisionStatus === 'blocked') {
    questions.push('Esse pedido contem segredo bruto ou acao critica; confirme um caminho seguro via vault/preview.');
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
