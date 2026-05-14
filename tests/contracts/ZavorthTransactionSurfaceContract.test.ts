import {
  buildZavorthTransactionSurfaceContractSnapshot,
  ZAVORTH_TRANSACTION_SURFACE_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionSurfaceContract.js';

describe('ZavorthTransactionSurfaceContract', () => {
  it('publishes the Phase 7 transaction surface contract', () => {
    const snapshot = buildZavorthTransactionSurfaceContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_SURFACE_CONTRACT_VERSION);
    expect(snapshot.surfaces).toEqual(['web', 'cli', 'telegram', 'api', 'natural-first']);
    expect(snapshot.cardKinds).toEqual([
      'runtime-summary',
      'preview',
      'approval',
      'credential',
      'connector',
      'safety',
    ]);
    expect(snapshot.actionKinds).toEqual(
      expect.arrayContaining([
        'request-approval',
        'provide-credential-ref',
        'simulate',
        'open-ledger',
        'explain-blockers',
        'no-live-action',
      ]),
    );
  });

  it('documents cross-surface invariants without live execution', () => {
    const snapshot = buildZavorthTransactionSurfaceContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'All transaction text enters the governed Natural First gateway path.',
        'Surface projections expose cards and actions, not hidden live execution.',
        'No surface projection may authorize live execution.',
        'Telegram/API/Web/CLI receive the same runtime truth with surface-specific presentation only.',
      ]),
    );
  });
});
