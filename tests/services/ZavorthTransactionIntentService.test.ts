import { ZavorthTransactionIntentService } from '../../src/services/ZavorthTransactionIntentService.js';

const now = new Date('2026-05-11T12:00:00.000Z');

describe('ZavorthTransactionIntentService', () => {
  const service = new ZavorthTransactionIntentService();

  it('parses a governed crypto trade intent from structured kind without executing it', () => {
    const result = service.parse({
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
      channel: 'web',
      now,
    });

    expect(result.status).toBe('parsed');
    expect(result.intent.kind).toBe('execute-trade');
    expect(result.intent.actionKind).toBe('trade-order');
    expect(result.intent.target).toEqual(
      expect.objectContaining({
        kind: 'asset',
        label: 'ETH',
        symbol: 'ETH',
      }),
    );
    expect(result.intent.limits).toEqual([
      expect.objectContaining({
        amount: 300,
        currency: 'BRL',
      }),
    ]);
    expect(result.intent.conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'percent-drop',
          value: 5,
          unit: 'percent',
        }),
        expect.objectContaining({
          kind: 'manual-confirmation',
        }),
      ]),
    );
    expect(result.intent.naturalFirstRoute).toBe('approval-proposal');
    expect(result.intent.executionMode).toBe('preview');
    expect(result.intent.safetyDecision.allowed).toBe(true);
    expect(result.intent.safetyDecision.status).toBe('simulation-only');
  });

  it('parses price monitoring as a tool preview intent when kind is structured', () => {
    const result = service.parse({
      text: 'Monitor notebook below R$3500 and notify me.',
      kind: 'monitor-price',
      actionKind: 'price-monitor',
      channel: 'telegram',
      now,
    });

    expect(result.intent.kind).toBe('monitor-price');
    expect(result.intent.actionKind).toBe('price-monitor');
    expect(result.intent.target).toEqual(
      expect.objectContaining({
        kind: 'product',
        label: 'notebook',
      }),
    );
    expect(result.intent.naturalFirstRoute).toBe('tool-preview');
    expect(result.intent.riskLevel).toBe('low');
    expect(result.intent.safetyDecision.status).toBe('simulation-only');
  });

  it('keeps bill payment behind approval proposal when kind is structured', () => {
    const result = service.parse({
      text: 'Pay the card bill if it stays below R$900.',
      kind: 'pay-bill',
      actionKind: 'payment-submit',
      channel: 'api',
      now,
    });

    expect(result.intent.kind).toBe('pay-bill');
    expect(result.intent.actionKind).toBe('payment-submit');
    expect(result.intent.naturalFirstRoute).toBe('approval-proposal');
    expect(result.intent.riskLevel).toBe('high');
    expect(result.intent.safetyDecision.explicitHumanApprovalRequired).toBe(true);
  });

  it('does not activate product kind from free-text keywords alone', () => {
    const result = service.parse({
      text: 'Buy this for me later. Saque pix compre monitores.',
      now,
    });

    expect(result.status).toBe('not-transactional');
    expect(result.intent.kind).toBe('unknown-transaction');
    expect(result.intent.actionKind).toBe('cart-preview');
    expect(result.intent.naturalFirstRoute).toBe('llm-reply');
    expect(result.intent.needsClarification).toBe(true);
    expect(result.intent.extraction.detectedKeywords).toEqual([]);
  });

  it('marks underspecified structured purchase for clarification', () => {
    const result = service.parse({
      text: 'Buy this for me later.',
      kind: 'purchase-product',
      now,
    });

    expect(result.intent.kind).toBe('purchase-product');
    expect(result.intent.needsClarification).toBe(true);
    expect(result.intent.extraction.missingFields).toEqual(expect.arrayContaining(['target', 'amount_or_limit']));
    expect(result.intent.clarifyingQuestions.length).toBeGreaterThan(0);
  });

  it('redacts raw secrets and blocks the intent output without structured kind', () => {
    const result = service.parse({
      text: 'Buy ETH up to R$100 using api_key=sk-super-secret-value-123456.',
      now,
    });

    expect(result.intent.kind).toBe('unknown-transaction');
    expect(result.intent.sourceText).not.toContain('sk-super-secret-value-123456');
    expect(result.intent.sourceText).toContain('[REDACTED]');
    expect(result.intent.extraction.sourceWasRedacted).toBe(true);
    expect(result.intent.safetyDecision.allowed).toBe(false);
    expect(result.intent.safetyDecision.blockers).toContain('raw_secret_exposure_blocked');
  });

  it('recognizes subscription cancellation as approval-gated when kind is structured', () => {
    const result = service.parse({
      text: 'Cancel my subscription for service X at the end of the month.',
      kind: 'cancel-subscription',
      actionKind: 'subscription-cancel',
      now,
    });

    expect(result.intent.kind).toBe('cancel-subscription');
    expect(result.intent.actionKind).toBe('subscription-cancel');
    expect(result.intent.naturalFirstRoute).toBe('approval-proposal');
    expect(result.intent.window?.durationText).toBe('end of month');
    expect(result.intent.riskLevel).toBe('medium');
  });
});
