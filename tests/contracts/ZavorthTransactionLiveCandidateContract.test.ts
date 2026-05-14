import {
  buildZavorthTransactionLiveCandidateContractSnapshot,
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveCandidateContract.js';

describe('ZavorthTransactionLiveCandidateContract', () => {
  it('publishes the Phase 10 live-candidate contract', () => {
    const snapshot = buildZavorthTransactionLiveCandidateContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_LIVE_CANDIDATE_CONTRACT_VERSION);
    expect(snapshot.ownerPhrase).toBe(ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE);
    expect(snapshot.statuses).toEqual([
      'certification-required',
      'runtime-blocked',
      'owner-confirmation-required',
      'candidate-ready',
    ]);
    expect(snapshot.gateKinds).toEqual([
      'phase9-certification',
      'command-center-simulated',
      'approval-ledger-approved',
      'credential-ref-ready',
      'typed-connector-simulated',
      'owner-confirmation',
      'raw-secret-redaction',
      'live-switch-disabled',
    ]);
  });

  it('documents that candidate-ready still cannot execute live', () => {
    const snapshot = buildZavorthTransactionLiveCandidateContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Phase 10 may produce a live-candidate envelope, but it still cannot execute a live transaction.',
        'A candidate-ready envelope requires Phase 9 certification to pass first.',
        'A candidate-ready envelope requires explicit owner confirmation using the required phrase.',
        'Every Phase 10 result reports externalSideEffects=false, liveExecutionAuthorized=false, executableNow=false and liveActionApplied=false.',
      ]),
    );
  });
});
