import {
  buildZavorthTransactionDashboardContractSnapshot,
  ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionDashboardContract.js';

describe('ZavorthTransactionDashboardContract', () => {
  it('publishes the Dashboard controls transaction Dashboard contract', () => {
    const snapshot = buildZavorthTransactionDashboardContractSnapshot();

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
    const snapshot = buildZavorthTransactionDashboardContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Dashboard controls is a cockpit projection over Surface controls; it does not introduce execution authority.',
        'Every Dashboard projection keeps live execution disabled.',
        'Operator actions are visual affordances backed by governed surface actions.',
        'Raw transaction secrets must never be serialized into cockpit lanes, tiles, notifications or API payloads.',
      ]),
    );
  });
});
