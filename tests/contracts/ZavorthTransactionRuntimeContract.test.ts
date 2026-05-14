import {
  buildZavorthTransactionRuntimeContractSnapshot,
  ZAVORTH_TRANSACTION_RUNTIME_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionRuntimeContract.js';

describe('ZavorthTransactionRuntimeContract', () => {
  it('publishes the Phase 6 transaction runtime contract', () => {
    const snapshot = buildZavorthTransactionRuntimeContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_RUNTIME_CONTRACT_VERSION);
    expect(snapshot.statuses).toEqual([
      'preview-ready',
      'approval-required',
      'credential-required',
      'simulated',
      'blocked',
      'needs-clarification',
    ]);
    expect(snapshot.stages).toEqual(['intent', 'preview', 'approval-ledger', 'credential-validation', 'typed-connector']);
  });

  it('documents end-to-end orchestration without live execution', () => {
    const snapshot = buildZavorthTransactionRuntimeContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Phase 6 orchestrates existing transaction stages but does not introduce live execution.',
        'Credential refs are validated before they are passed to connector payloads.',
        'Every runtime result reports externalSideEffects=false, liveActionApplied=false and executableNow=false.',
      ]),
    );
  });
});
