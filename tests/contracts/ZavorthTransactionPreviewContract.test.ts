import {
  buildZavorthTransactionPreviewContractSnapshot,
  ZAVORTH_TRANSACTION_PREVIEW_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionPreviewContract.js';

describe('ZavorthTransactionPreviewContract', () => {
  it('publishes the Phase 2 transaction preview contract', () => {
    const snapshot = buildZavorthTransactionPreviewContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_PREVIEW_CONTRACT_VERSION);
    expect(snapshot.statuses).toEqual(['ready-for-review', 'needs-clarification', 'blocked']);
    expect(snapshot.connectorKinds).toEqual(
      expect.arrayContaining(['market-data', 'commerce', 'payment', 'exchange', 'wallet']),
    );
  });

  it('keeps preview invariants non-executing and approval-first', () => {
    const snapshot = buildZavorthTransactionPreviewContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'A preview never applies a live transaction effect.',
        'A preview must carry the parsed intent snapshot and Phase 0 policy decision.',
        'Real-money previews require explicit approval before any live execution plan can exist.',
      ]),
    );
  });
});
