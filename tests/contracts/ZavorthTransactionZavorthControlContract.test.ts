import {
  buildZavorthTransactionZavorthControlContractSnapshot,
  ZAVORTH_TRANSACTION_ZAVORTH_CONTROL_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionZavorthControlContract.js';

describe('ZavorthTransactionZavorthControlContract', () => {
  it('publishes the ZavorthControl controls transaction ZavorthControl contract', () => {
    const snapshot = buildZavorthTransactionZavorthControlContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_ZAVORTH_CONTROL_CONTRACT_VERSION);
    expect(snapshot.laneKinds).toEqual([
      'intake',
      'natural-first',
      'preview',
      'approval',
      'credential',
      'connector',
      'ledger',
      'safety',
    ]);
    expect(snapshot.tileKinds).toEqual([
      'status',
      'action',
      'target',
      'amount',
      'approval',
      'credential',
      'connector',
      'safety',
    ]);
    expect(snapshot.timelineStatuses).toEqual(['done', 'pending', 'blocked', 'skipped']);
  });

  it('documents cockpit projection invariants without live execution', () => {
    const snapshot = buildZavorthTransactionZavorthControlContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'ZavorthControl controls is a cockpit projection over Surface controls; it does not introduce execution authority.',
        'Every ZavorthControl projection keeps live execution disabled.',
        'Operator actions are visual affordances backed by governed surface actions.',
        'Raw transaction secrets must never be serialized into cockpit lanes, tiles, notifications or API payloads.',
      ]),
    );
  });
});
