import {
  ZAVORTH_TRANSACTION_PLANE_CONTRACT_VERSION,
  buildZavorthTransactionPlaneContractSnapshot,
  evaluateZavorthTransactionPlaneSafety,
} from '../../src/contracts/ZavorthTransactionPlaneContract.js';

describe('ZavorthTransactionPlaneContract', () => {
  it('defines the phase 0 security contract and default invariants', () => {
    const snapshot = buildZavorthTransactionPlaneContractSnapshot();

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_PLANE_CONTRACT_VERSION);
    expect(snapshot.defaultControls).toEqual(expect.arrayContaining([
      'simulation-first',
      'typed connector required for live effects',
      'explicit human approval for real money',
      'ledger receipt required',
      'raw secrets never persisted',
    ]));
    expect(snapshot.invariants.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'llm-never-executes',
      'typed-connector-only',
      'real-money-needs-human-approval',
      'preview-before-effect',
      'no-raw-secrets',
      'ledger-for-every-decision',
    ]));
  });

  it('publishes risk taxonomy and irreversible action lists', () => {
    const snapshot = buildZavorthTransactionPlaneContractSnapshot();

    expect(Object.keys(snapshot.riskTaxonomy)).toEqual(['low', 'medium', 'high', 'critical']);
    expect(snapshot.irreversibleActions).toEqual(expect.arrayContaining([
      'purchase-submit',
      'payment-submit',
      'trade-order',
      'asset-withdrawal',
    ]));
    expect(snapshot.realMoneyActions).toEqual(expect.arrayContaining([
      'purchase-submit',
      'payment-submit',
      'trade-order',
      'api-credit-purchase',
    ]));
    expect(snapshot.criticalValueMovementActions).toEqual(['asset-transfer', 'asset-withdrawal']);
  });

  it('blocks direct LLM execution even when controls are otherwise present', () => {
    const decision = evaluateZavorthTransactionPlaneSafety({
      actor: 'llm',
      actionKind: 'purchase-submit',
      executionMode: 'live',
      typedConnector: true,
      connectorTrusted: true,
      previewGenerated: true,
      approvalStatus: 'approved',
      ledgerEnabled: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe('blocked');
    expect(decision.llmDirectExecutionAllowed).toBe(false);
    expect(decision.blockers).toContain('llm_direct_transaction_execution_blocked');
  });

  it('requires explicit human approval for real-money live effects', () => {
    const decision = evaluateZavorthTransactionPlaneSafety({
      actor: 'zavorth-runtime',
      actionKind: 'payment-submit',
      executionMode: 'live',
      typedConnector: true,
      connectorTrusted: true,
      previewGenerated: true,
      approvalStatus: 'pending',
      ledgerEnabled: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe('needs-approval');
    expect(decision.explicitHumanApprovalRequired).toBe(true);
    expect(decision.blockers).toContain('explicit_human_approval_required');
  });

  it('allows a governed live purchase only after connector, preview, approval and ledger', () => {
    const decision = evaluateZavorthTransactionPlaneSafety({
      actor: 'zavorth-runtime',
      actionKind: 'purchase-submit',
      executionMode: 'live',
      typedConnector: true,
      connectorTrusted: true,
      previewGenerated: true,
      approvalStatus: 'approved',
      ledgerEnabled: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe('allowed');
    expect(decision.riskLevel).toBe('high');
    expect(decision.realMoneyAction).toBe(true);
  });

  it('keeps critical value movement blocked by default in phase 0', () => {
    const decision = evaluateZavorthTransactionPlaneSafety({
      actor: 'zavorth-runtime',
      actionKind: 'asset-withdrawal',
      executionMode: 'live',
      typedConnector: true,
      connectorTrusted: true,
      previewGenerated: true,
      approvalStatus: 'approved',
      ledgerEnabled: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.riskLevel).toBe('critical');
    expect(decision.criticalValueMovement).toBe(true);
    expect(decision.blockers).toContain('critical_value_movement_blocked_by_default');
  });

  it('allows simulation-first transaction work before live money movement', () => {
    const decision = evaluateZavorthTransactionPlaneSafety({
      actor: 'zavorth-runtime',
      actionKind: 'trade-order',
      executionMode: 'paper',
      approvalStatus: 'none',
      ledgerEnabled: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe('simulation-only');
    expect(decision.simulationFirst).toBe(true);
  });

  it('blocks raw secret persistence regardless of mode', () => {
    const decision = evaluateZavorthTransactionPlaneSafety({
      actor: 'human',
      actionKind: 'cart-preview',
      executionMode: 'preview',
      persistsRawSecret: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.blockers).toContain('raw_secret_exposure_blocked');
  });
});
