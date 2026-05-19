import {
  buildZavorthTransactionIntentContractSnapshot,
  ZAVORTH_TRANSACTION_INTENT_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionIntentContract.js';

describe('ZavorthTransactionIntentContract', () => {
  it('publishes the Intent model transaction intent contract', () => {
    const snapshot = buildZavorthTransactionIntentContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_INTENT_CONTRACT_VERSION);
    expect(snapshot.supportedIntents).toContain('execute-trade');
    expect(snapshot.supportedIntents).toContain('pay-bill');
    expect(snapshot.supportedIntents).toContain('buy-api-credits');
    expect(snapshot.supportedTargets).toContain('asset');
    expect(snapshot.naturalFirstRoutes).toContain('approval-proposal');
  });

  it('documents examples that stay inside Natural First governance routes', () => {
    const snapshot = buildZavorthTransactionIntentContractSnapshot();

    expect(snapshot.examples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expectedKind: 'execute-trade',
          expectedActionKind: 'trade-order',
          expectedRoute: 'approval-proposal',
        }),
        expect.objectContaining({
          expectedKind: 'monitor-price',
          expectedActionKind: 'price-monitor',
          expectedRoute: 'tool-preview',
        }),
      ]),
    );
  });

  it('keeps non-execution invariants explicit', () => {
    const snapshot = buildZavorthTransactionIntentContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Intent parsing never executes a transaction.',
        'Raw secrets are redacted before intent output is persisted or displayed.',
        'Every parsed intent carries a Transaction Plane safety decision.',
      ]),
    );
  });
});
