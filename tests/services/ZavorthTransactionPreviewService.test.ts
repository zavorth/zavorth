import { ZavorthTransactionPreviewService } from '../../src/services/ZavorthTransactionPreviewService.js';

const now = new Date('2026-05-11T12:00:00.000Z');

describe('ZavorthTransactionPreviewService', () => {
  const service = new ZavorthTransactionPreviewService();

  it('builds an approval-ready exchange preview from a trade intent', () => {
    const preview = service.buildPreview({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      channel: 'web',
      now,
    });

    expect(preview.version).toBe('zavorth-transaction-preview/checkpoint-2');
    expect(preview.status).toBe('ready-for-review');
    expect(preview.intent.kind).toBe('execute-trade');
    expect(preview.intent.actionKind).toBe('trade-order');
    expect(preview.connector).toEqual(
      expect.objectContaining({
        kind: 'exchange',
        requiredForLive: true,
        trustedConnectorRequired: true,
        credentialRefRequired: true,
        rawSecretAllowed: false,
      }),
    );
    expect(preview.quote).toEqual(
      expect.objectContaining({
        status: 'estimated',
        amount: 300,
        currency: 'BRL',
        feeStatus: 'not-quoted',
      }),
    );
    expect(preview.approval).toEqual(
      expect.objectContaining({
        required: true,
        status: 'pending',
        scope: 'single-preview',
      }),
    );
    expect(preview.validation.canAskApproval).toBe(true);
    expect(preview.validation.canCreateLiveExecutionPlan).toBe(false);
    expect(preview.policy.liveActionApplied).toBe(false);
    expect(preview.policy.executableNow).toBe(false);
  });

  it('keeps monitoring previews low-risk and non-approval by default', () => {
    const preview = service.buildPreview({
      text: 'Monitore notebook abaixo de R$3500 e me avise.',
      channel: 'telegram',
      now,
    });

    expect(preview.status).toBe('ready-for-review');
    expect(preview.intent.kind).toBe('monitor-price');
    expect(preview.connector.kind).toBe('market-data');
    expect(preview.approval.required).toBe(false);
    expect(preview.quote.amount).toBe(3500);
    expect(preview.policy.liveActionApplied).toBe(false);
  });

  it('does not make underspecified purchases approval-ready', () => {
    const preview = service.buildPreview({
      text: 'Compre isso para mim depois.',
      now,
    });

    expect(preview.status).toBe('needs-clarification');
    expect(preview.validation.canAskApproval).toBe(false);
    expect(preview.validation.missingFields).toEqual(expect.arrayContaining(['target', 'amount_or_limit']));
    expect(preview.nextSteps.length).toBeGreaterThan(0);
  });

  it('blocks previews that contain raw transaction secrets', () => {
    const preview = service.buildPreview({
      text: 'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
      now,
    });

    expect(preview.status).toBe('blocked');
    expect(JSON.stringify(preview)).not.toContain('sk-super-secret-value-123456');
    expect(preview.policy.blockers).toContain('raw_secret_exposure_blocked');
    expect(preview.validation.canAskApproval).toBe(false);
  });

  it('marks wallet value movement as critical and blocked from live planning', () => {
    const preview = service.buildPreview({
      text: 'Saque BTC para minha wallet ate R$100.',
      now,
    });

    expect(preview.intent.kind).toBe('withdraw-asset');
    expect(preview.connector.kind).toBe('wallet');
    expect(preview.intent.riskLevel).toBe('critical');
    expect(preview.validation.canCreateLiveExecutionPlan).toBe(false);
    expect(preview.validation.warnings).toEqual(
      expect.arrayContaining(['wallet value movement remains blocked by default until a later owner-gated phase']),
    );
  });
});
