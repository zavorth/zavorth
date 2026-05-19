import {
  buildZavorthTransactionSandboxAdapterCertificationContractSnapshot,
  ZAVORTH_TRANSACTION_SANDBOX_ADAPTER_CERTIFICATION_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthTransactionSandboxAdapterCertificationContract.js';

describe('ZavorthTransactionSandboxAdapterCertificationContract', () => {
  it('publishes the Intent model2 sandbox adapter certification contract', () => {
    const snapshot = buildZavorthTransactionSandboxAdapterCertificationContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_SANDBOX_ADAPTER_CERTIFICATION_CONTRACT_VERSION);
    expect(snapshot.statuses).toEqual([
      'activation-review-required',
      'adapter-manifest-required',
      'sandbox-policy-blocked',
      'sandbox-certification-ready',
    ]);
    expect(snapshot.gateKinds).toEqual([
      'intent-model1-review-ready',
      'review-packet-present',
      'adapter-manifest-present',
      'sandbox-environment-only',
      'endpoint-allowlist-ready',
      'credential-ref-bound',
      'idempotency-ready',
      'rate-limit-ready',
      'timeout-ready',
      'circuit-breaker-ready',
      'kill-switch-linked',
      'rollback-linked',
      'live-endpoint-blocked',
      'separate-sandbox-executor-required',
      'no-external-io',
      'raw-secret-redaction',
    ]);
  });

  it('documents that Intent model2 is certification-only', () => {
    const snapshot = buildZavorthTransactionSandboxAdapterCertificationContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Intent model2 consumes a Intent model1 ready-for-live-activation-review packet before certifying any adapter.',
        'Intent model2 certifies sandbox or paper adapter readiness only; it does not call external networks.',
        'Live and production adapter endpoints are blocked in Intent model2.',
        'A sandbox-certification-ready packet still reports sandboxExecutionAuthorized=false and liveExecutionAuthorized=false.',
      ]),
    );
  });
});
