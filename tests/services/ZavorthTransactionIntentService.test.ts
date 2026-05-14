import { ZavorthTransactionIntentService } from '../../src/services/ZavorthTransactionIntentService.js';

const now = new Date('2026-05-11T12:00:00.000Z');

describe('ZavorthTransactionIntentService', () => {
  const service = new ZavorthTransactionIntentService();

  it('parses a governed crypto trade intent without executing it', () => {
    const result = service.parse({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
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

  it('parses price monitoring as a tool preview intent', () => {
    const result = service.parse({
      text: 'Monitore notebook abaixo de R$3500 e me avise.',
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

  it('keeps bill payment behind approval proposal', () => {
    const result = service.parse({
      text: 'Pague a fatura do cartao se ficar abaixo de R$900.',
      channel: 'api',
      now,
    });

    expect(result.intent.kind).toBe('pay-bill');
    expect(result.intent.actionKind).toBe('payment-submit');
    expect(result.intent.naturalFirstRoute).toBe('approval-proposal');
    expect(result.intent.riskLevel).toBe('high');
    expect(result.intent.safetyDecision.explicitHumanApprovalRequired).toBe(true);
  });

  it('marks underspecified transactional text for clarification', () => {
    const result = service.parse({
      text: 'Compre isso para mim depois.',
      now,
    });

    expect(result.intent.kind).toBe('purchase-product');
    expect(result.intent.needsClarification).toBe(true);
    expect(result.intent.extraction.missingFields).toEqual(expect.arrayContaining(['target', 'amount_or_limit']));
    expect(result.intent.clarifyingQuestions.length).toBeGreaterThan(0);
  });

  it('redacts raw secrets and blocks the intent output', () => {
    const result = service.parse({
      text: 'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
      now,
    });

    expect(result.intent.sourceText).not.toContain('sk-super-secret-value-123456');
    expect(result.intent.sourceText).toContain('[REDACTED]');
    expect(result.intent.extraction.sourceWasRedacted).toBe(true);
    expect(result.intent.safetyDecision.allowed).toBe(false);
    expect(result.intent.safetyDecision.blockers).toContain('raw_secret_exposure_blocked');
  });

  it('recognizes subscription cancellation as approval-gated', () => {
    const result = service.parse({
      text: 'Cancele minha assinatura do servico X no fim do mes.',
      now,
    });

    expect(result.intent.kind).toBe('cancel-subscription');
    expect(result.intent.actionKind).toBe('subscription-cancel');
    expect(result.intent.naturalFirstRoute).toBe('approval-proposal');
    expect(result.intent.window?.durationText).toBe('fim do mes');
    expect(result.intent.riskLevel).toBe('medium');
  });
});
