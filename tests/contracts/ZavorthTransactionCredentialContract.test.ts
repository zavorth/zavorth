import {
  buildZavorthTransactionCredentialContractSnapshot,
  ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionCredentialContract.js';

describe('ZavorthTransactionCredentialContract', () => {
  it('publishes the Credential vault credential ref contract', () => {
    const snapshot = buildZavorthTransactionCredentialContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION);
    expect(snapshot.environments).toEqual(['dry-run', 'sandbox', 'paper', 'live-candidate']);
    expect(snapshot.validationStatuses).toEqual(['ready', 'missing', 'blocked', 'mismatch', 'expired']);
  });

  it('documents the no raw secret boundary', () => {
    const snapshot = buildZavorthTransactionCredentialContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Credential vault stores credential references and metadata only, never raw secret values.',
        'Raw credential values are blocked and redacted before any store write.',
        'Credential references do not authorize live execution by themselves.',
      ]),
    );
  });
});
