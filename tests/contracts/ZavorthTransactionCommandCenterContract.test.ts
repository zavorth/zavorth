import {
  buildZavorthTransactionCommandCenterContractSnapshot,
  ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionCommandCenterContract.js';

describe('ZavorthTransactionCommandCenterContract', () => {
  it('publishes the Phase 8 transaction Command Center contract', () => {
    const snapshot = buildZavorthTransactionCommandCenterContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION);
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
    const snapshot = buildZavorthTransactionCommandCenterContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Phase 8 is a cockpit projection over Phase 7; it does not introduce execution authority.',
        'Every Command Center projection keeps live execution disabled.',
        'Operator actions are visual affordances backed by governed surface actions.',
        'Raw transaction secrets must never be serialized into cockpit lanes, tiles, notifications or API payloads.',
      ]),
    );
  });
});
