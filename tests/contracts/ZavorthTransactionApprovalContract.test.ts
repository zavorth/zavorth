import {
  buildZavorthTransactionApprovalContractSnapshot,
  ZAVORTH_TRANSACTION_APPROVAL_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionApprovalContract.js';

describe('ZavorthTransactionApprovalContract', () => {
  it('publishes the Phase 3 approval ledger contract', () => {
    const snapshot = buildZavorthTransactionApprovalContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_APPROVAL_CONTRACT_VERSION);
    expect(snapshot.ledgerEntryKinds).toEqual([
      'preview-recorded',
      'approval-granted',
      'approval-rejected',
      'approval-blocked',
    ]);
    expect(snapshot.decisions).toEqual(['approved', 'rejected']);
  });

  it('documents that approval is still not live execution', () => {
    const snapshot = buildZavorthTransactionApprovalContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Approving a preview in Phase 3 does not execute a transaction.',
        'Approved previews still report liveExecutionAuthorized=false until a later connector execution phase.',
        'Raw secrets must never appear in approval ledger entries.',
      ]),
    );
  });
});
