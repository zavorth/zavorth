import {
  buildZavorthTransactionLiveMicroRolloutCertificationContractSnapshot,
  ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveMicroRolloutCertificationContract.js';

describe('ZavorthTransactionLiveMicroRolloutCertificationContract', () => {
  it('publishes the combined Intent model4-15 contract', () => {
    const snapshot = buildZavorthTransactionLiveMicroRolloutCertificationContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_CONTRACT_VERSION);
    expect(snapshot.ownerPhrase).toBe(ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE);
    expect(snapshot.statuses).toEqual([
      'sandbox-execution-required',
      'micro-rollout-owner-review-required',
      'micro-rollout-policy-blocked',
      'certification-failed',
      'micro-rollout-certified',
    ]);
    expect(snapshot.scenarios).toEqual([
      'prompt-injection-without-approval',
      'token-leak',
      'approval-replay',
      'expired-mandate',
      'connector-down',
      'price-drift',
      'wrong-user-approval',
      'duplicate-execution',
      'missing-rollback',
      'incomplete-ledger',
    ]);
  });

  it('documents that final certification still does not execute live', () => {
    const snapshot = buildZavorthTransactionLiveMicroRolloutCertificationContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Intent model4-15 defines a live micro-rollout ladder but does not execute a live microtransaction.',
        'Micro-rollout certification requires a dedicated owner phrase separate from earlier transaction phrases.',
        'A micro-rollout-certified packet still reports liveMicroRolloutAuthorized=false, liveExecutionAuthorized=false and liveActionApplied=false.',
      ]),
    );
  });
});
