import {
  buildZavorthTransactionCertificationContractSnapshot,
  ZAVORTH_TRANSACTION_CERTIFICATION_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionCertificationContract.js';

describe('ZavorthTransactionCertificationContract', () => {
  it('publishes the Phase 9 transaction certification contract', () => {
    const snapshot = buildZavorthTransactionCertificationContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_CERTIFICATION_CONTRACT_VERSION);
    expect(snapshot.scenarioIds).toEqual([
      'web-trade-approval',
      'api-approved-paper-trade',
      'cli-credential-required',
      'telegram-price-monitor',
      'web-raw-secret-blocked',
    ]);
    expect(snapshot.gateKinds).toEqual([
      'natural-first-routing',
      'approval-gate',
      'credential-ref-gate',
      'typed-connector-simulation',
      'command-center-projection',
      'cross-surface-parity',
      'secret-redaction',
      'no-live-execution',
    ]);
  });

  it('documents certification invariants without live authorization', () => {
    const snapshot = buildZavorthTransactionCertificationContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Phase 9 certifies Phases 0-8 as one transaction plane.',
        'Certification scenarios must never serialize raw transaction secrets.',
        'A passed report still does not authorize live transaction execution.',
      ]),
    );
  });
});
