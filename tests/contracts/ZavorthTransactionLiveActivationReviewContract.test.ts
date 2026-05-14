import {
  buildZavorthTransactionLiveActivationReviewContractSnapshot,
  ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveActivationReviewContract.js';

describe('ZavorthTransactionLiveActivationReviewContract', () => {
  it('publishes the Phase 11 live activation review contract', () => {
    const snapshot = buildZavorthTransactionLiveActivationReviewContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_CONTRACT_VERSION);
    expect(snapshot.ownerPhrase).toBe(ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE);
    expect(snapshot.statuses).toEqual([
      'candidate-required',
      'owner-review-required',
      'rollback-drill-required',
      'activation-policy-blocked',
      'ready-for-live-activation-review',
    ]);
    expect(snapshot.gateKinds).toEqual([
      'phase10-candidate-ready',
      'candidate-envelope-present',
      'owner-activation-review',
      'bounded-limits',
      'canary-limit-ready',
      'kill-switch-ready',
      'rollback-drill-ready',
      'connector-live-still-disabled',
      'separate-live-executor-required',
      'raw-secret-redaction',
    ]);
  });

  it('documents that Phase 11 is still review-only', () => {
    const snapshot = buildZavorthTransactionLiveActivationReviewContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Phase 11 consumes a Phase 10 candidate-ready envelope and turns it into a review-only activation packet.',
        'A ready-for-live-activation-review packet requires explicit bounded limits, kill switch and rollback drill receipts.',
        'Phase 11 does not authorize or execute a live transaction.',
        'Phase 11 requires a separate future live executor and cannot be used as that executor.',
      ]),
    );
  });
});
