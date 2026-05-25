import {
  buildZavorthTransactionLiveCandidateContractSnapshot,
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveCandidateContract.js';

describe('ZavorthTransactionLiveCandidateContract', () => {
  it('publishes the Intent model0 live-candidate contract', () => {
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
      'certification-matrix-certification',
      'dashboard-simulated',
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
        'Intent model0 may produce a live-candidate envelope, but it still cannot execute a live transaction.',
        'A candidate-ready envelope requires Certification matrix certification to pass first.',
        'A candidate-ready envelope requires explicit owner confirmation using the required phrase.',
        'Every Intent model0 result reports externalSideEffects=false, liveExecutionAuthorized=false, executableNow=false and liveActionApplied=false.',
      ]),
    );
  });
});
