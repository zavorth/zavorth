import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthExternalDryRunActionPlannerFixtureIntents,
  planZavorthExternalDryRunActionsFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/175-wave-2-controlled-dry-run-action-planner.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentControlledDryRunActionPlanner.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('controlled dry-run action planner', () => {
  it('documents 175 as a controlled dry-run planner with no real execution', () => {
    const content = read(DOC);

    expect(content).toContain('Status: controlled-dry-run-action-planner-ready');
    expect(content).toContain('docs/174-wave-2-controlled-action-dispatch-design.md -> controlled-action-dispatch-design-ready');
    expect(content).toContain('nativeContract: ZavorthControlledDryRunActionPlanner/v1');
    expect(content).toContain('nativeContract: ZavorthExternalActionDispatchPlan/v1');
    expect(content).toContain('nativeContract: ZavorthExternalActionReceipt/v1');
    expect(content).toContain('externalAdapterInvoked: false');
    expect(content).toContain('Do not proceed to message send');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the dry-run planner boundary and public types', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthControlledDryRunActionPlanner/v1');
    expect(boundary).toContain('planZavorthExternalDryRunActions');
    expect(boundary).toContain('ZavorthExternalActionDispatchPlan/v1');
    expect(boundary).toContain('ZavorthExternalActionReceipt/v1');
    expect(index).toContain("from './ExternalAgentControlledDryRunActionPlanner.js'");
    expect(index).toContain('ZavorthExternalDryRunActionPlannerNormalization');
  });

  it('turns 174 intents into dry-run planner rows, dispatch plans, and receipts', () => {
    const intents = createZavorthExternalDryRunActionPlannerFixtureIntents();
    const normalized = planZavorthExternalDryRunActionsFixture();

    expect(intents).toHaveLength(8);
    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthControlledDryRunActionPlanner/v1',
      decision: 'controlled-dry-run-action-planner-ready',
      sourceDesignReady: true,
    }));
    expect(normalized.intents).toHaveLength(8);
    expect(normalized.preflights).toHaveLength(8);
    expect(normalized.dispatchPlans).toHaveLength(8);
    expect(normalized.receipts).toHaveLength(8);
    expect(normalized.plannerRows).toHaveLength(8);
  });

  it('classifies read-only, dry-run, approval-required, blocked, and unsupported intents', () => {
    const normalized = planZavorthExternalDryRunActionsFixture();

    expect(normalized.classifications.readOnlyAllowed).toHaveLength(1);
    expect(normalized.classifications.dryRunAllowed).toHaveLength(1);
    expect(normalized.classifications.approvalRequired).toHaveLength(3);
    expect(normalized.classifications.blocked).toHaveLength(2);
    expect(normalized.classifications.unsupported).toHaveLength(1);
    expect(normalized.plannerRows.map((row) => row.classification).sort()).toEqual([
      'approval-required',
      'approval-required',
      'approval-required',
      'blocked',
      'blocked',
      'dry-run-allowed',
      'read-only-allowed',
      'unsupported',
    ]);
  });

  it('allows read-only and dry-run intents only as dry-run dispatch plans', () => {
    const normalized = planZavorthExternalDryRunActionsFixture();
    const allowedRows = normalized.plannerRows.filter((row) => (
      row.classification === 'read-only-allowed' || row.classification === 'dry-run-allowed'
    ));

    expect(allowedRows).toHaveLength(2);
    allowedRows.forEach((row) => {
      const plan = normalized.dispatchPlans.find((candidate) => candidate.id === row.dispatchPlanId);
      const receipt = normalized.receipts.find((candidate) => candidate.id === row.receiptId);

      expect(plan?.planState).toBe('dry-run-only');
      expect(plan?.dispatchDeferredToFutureGate).toBe(true);
      expect(plan?.executionActuallyPerformed).toBe(false);
      expect(receipt?.status).toBe('simulated-dry-run');
      expect(receipt?.sideEffectFree).toBe(true);
    });
  });

  it('routes mutable message and provider intents through approval-required preflight', () => {
    const normalized = planZavorthExternalDryRunActionsFixture();
    const approvalKinds = normalized.plannerRows
      .filter((row) => row.classification === 'approval-required')
      .map((row) => row.actionKind)
      .sort();

    expect(approvalKinds).toEqual([
      'command-tool-execution',
      'message-send',
      'provider-execution',
    ]);
    normalized.preflights
      .filter((preflight) => preflight.classification === 'approval-required')
      .forEach((preflight) => {
        expect(preflight.approvalRequired).toBe(true);
        expect(preflight.policyAuthority).toBe('zavorth-policy-preflight');
        expect(preflight.sourceApprovalHintAuthority).toBe(false);
        expect(preflight.sourceCapabilityAuthority).toBe(false);
      });
  });

  it('blocks dangerous command execution and session/history mutation by policy', () => {
    const normalized = planZavorthExternalDryRunActionsFixture();
    const blockedKinds = normalized.plannerRows
      .filter((row) => row.classification === 'blocked')
      .map((row) => row.actionKind)
      .sort();

    expect(blockedKinds).toEqual([
      'command-tool-execution',
      'session-history-mutation',
    ]);
    normalized.receipts
      .filter((receipt) => receipt.classification === 'blocked')
      .forEach((receipt) => {
        expect(receipt.status).toBe('blocked-by-policy');
        expect(receipt.executionActuallyPerformed).toBe(false);
      });
  });

  it('represents unsupported capability combinations as degraded unsupported rows, not crashes', () => {
    const normalized = planZavorthExternalDryRunActionsFixture();
    const unsupportedRow = normalized.plannerRows.find((row) => row.classification === 'unsupported');
    const unsupportedPreflight = normalized.preflights.find((preflight) => preflight.classification === 'unsupported');
    const unsupportedReceipt = normalized.receipts.find((receipt) => receipt.classification === 'unsupported');
    const unsupportedPlan = normalized.dispatchPlans.find((plan) => plan.id === unsupportedRow?.dispatchPlanId);

    expect(unsupportedRow).toEqual(expect.objectContaining({
      unsupportedReasonId: 'unsupported-capability-combination',
      sourceCapabilityInputOnly: true,
      sourceAuthorityGranted: false,
      externalAdapterInvoked: false,
      executionActuallyPerformed: false,
    }));
    expect(unsupportedPreflight).toEqual(expect.objectContaining({
      unsupported: true,
      degraded: true,
      executionActuallyPerformed: false,
    }));
    expect(unsupportedPlan?.planState).toBe('blocked');
    expect(unsupportedReceipt?.status).toBe('unsupported-degraded');
  });

  it('keeps receipts audit-ready, redacted, and side-effect free', () => {
    const normalized = planZavorthExternalDryRunActionsFixture();
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toMatch(/ExternalExecutor|external-executor/);
    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(serialized).not.toMatch(/bearer\s+[A-Za-z0-9._-]{8,}/i);
    normalized.receipts.forEach((receipt) => {
      expect(receipt.nativeContract).toBe('ZavorthExternalActionReceipt/v1');
      expect(receipt.auditAuthority).toBe('zavorth-audit-receipt');
      expect(receipt.simulated).toBe(true);
      expect(receipt.redacted).toBe(true);
      expect(receipt.sideEffectFree).toBe(true);
      expect(receipt.externalAdapterInvoked).toBe(false);
      expect(receipt.rawSecretSerialized).toBe(false);
    });
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      serializedOutputContainsSensitiveFixture: false,
    });
  });

  it('grants no real execution, adapter, source authority, copy, or replacement', () => {
    const normalized = planZavorthExternalDryRunActionsFixture();

    expect(normalized.executionGate).toEqual({
      executionActuallyPerformed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      gatewayMutationActuallyCalled: false,
      sessionMutationActuallyPerformed: false,
      sourceAuthorityGranted: false,
      externalAdapterInvoked: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    });
    normalized.dispatchPlans.forEach((plan) => {
      expect(plan.governedExecutorBoundary.directExternalInvocationAllowed).toBe(false);
      expect(plan.executionActuallyPerformed).toBe(false);
      expect(plan.messageActuallySent).toBe(false);
      expect(plan.providerActuallyExecuted).toBe(false);
      expect(plan.commandActuallyExecuted).toBe(false);
      expect(plan.gatewayMutationActuallyCalled).toBe(false);
      expect(plan.sessionMutationActuallyPerformed).toBe(false);
      expect(plan.sourceAuthorityGranted).toBe(false);
      expect(plan.sourceModuleCopied).toBe(false);
      expect(plan.nativeReplacementAuthorized).toBe(false);
    });
    expect(normalized.nextGateRecommended).toBe('future-controlled-dispatch-dry-run-operator-review');
  });
});
