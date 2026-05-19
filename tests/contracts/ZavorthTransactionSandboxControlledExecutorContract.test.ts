import {
  buildZavorthTransactionSandboxControlledExecutorContractSnapshot,
  ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionSandboxControlledExecutorContract.js';

describe('ZavorthTransactionSandboxControlledExecutorContract', () => {
  it('publishes the Intent model3 controlled sandbox executor contract', () => {
    const snapshot = buildZavorthTransactionSandboxControlledExecutorContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_CONTRACT_VERSION);
    expect(snapshot.ownerPhrase).toBe(ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE);
    expect(snapshot.statuses).toEqual([
      'certification-required',
      'sandbox-operator-approval-required',
      'sandbox-execution-blocked',
      'sandbox-executed',
    ]);
    expect(snapshot.gateKinds).toEqual([
      'intent-model2-certification-ready',
      'certification-packet-present',
      'sandbox-operator-confirmation',
      'local-sandbox-only',
      'endpoint-not-called',
      'amount-within-certified-limits',
      'credential-ref-bound',
      'idempotency-ready',
      'kill-switch-ready',
      'rollback-ready',
      'sandbox-not-aborted',
      'sandbox-simulation-succeeds',
      'execution-receipt-ready',
      'live-still-disabled',
      'raw-secret-redaction',
    ]);
  });

  it('documents local sandbox execution without live effects', () => {
    const snapshot = buildZavorthTransactionSandboxControlledExecutorContractSnapshot();

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Intent model3 performs only a deterministic local sandbox simulation and never calls external sandbox or live endpoints.',
        'Sandbox execution requires a dedicated owner phrase separate from Intent model0 and Intent model1 phrases.',
        'Sandbox execution receipts may report sandboxExecutionAuthorized=true for the local simulation only.',
        'Every Intent model3 result keeps sandboxExternalIoPerformed=false, externalSideEffects=false, liveExecutionAuthorized=false and liveActionApplied=false.',
      ]),
    );
  });
});
