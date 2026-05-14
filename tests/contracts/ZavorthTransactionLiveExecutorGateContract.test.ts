import {
  buildZavorthTransactionLiveExecutorGateContractSnapshot,
  ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveExecutorGateContract.js';

describe('ZavorthTransactionLiveExecutorGateContract', () => {
  it('publishes the Phase 16 live executor gate contract', () => {
    const snapshot = buildZavorthTransactionLiveExecutorGateContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_CONTRACT_VERSION);
    expect(snapshot.ownerPhrase).toBe(ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE);
    expect(snapshot.statuses).toEqual([
      'micro-rollout-certification-required',
      'live-operator-confirmation-required',
      'live-adapter-required',
      'live-policy-blocked',
      'live-ready-held',
    ]);
    expect(snapshot.gateKinds).toEqual(
      expect.arrayContaining([
        'phase14-15-micro-rollout-certified',
        'live-adapter-manifest-present',
        'price-recheck-required',
        'balance-check-required',
        'receipt-fetch-required',
        'live-execution-held',
      ]),
    );
  });

  it('documents that readiness still holds execution', () => {
    const snapshot = buildZavorthTransactionLiveExecutorGateContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Phase 16 ships no bundled financial adapter and performs no live execution by default.',
        'A live-ready-held packet means the system is prepared for external adapter binding, not that money has moved.',
        'executeLive=true is deliberately policy-blocked in this readiness gate.',
      ]),
    );
  });
});
