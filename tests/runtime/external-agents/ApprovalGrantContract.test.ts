import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeApprovalGrantContractFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/179-wave-2-approval-grant-contract.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentApprovalGrantContract.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('approval grant contract', () => {
  it('documents 179 as an approval grant contract with zero mutation side effects', () => {
    const content = read(DOC);

    expect(content).toContain('Status: approval-grant-contract-ready');
    expect(content).toContain('approval grant/reject/revoke/expire');
    expect(content).toContain('approved-executable');
    expect(content).toContain('policy recheck before approved-executable');
    expect(content).toContain('idempotency key');
    expect(content).toContain('mutationActuallyPerformed: false');
    expect(content).toContain('Do not execute real mutation');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the approval grant boundary and public contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthExternalActionApprovalGrant/v1');
    expect(boundary).toContain('ZavorthExternalActionDispatchPlanTransition/v1');
    expect(boundary).toContain('ZavorthExternalActionApprovalAuditReceipt/v1');
    expect(boundary).toContain('normalizeApprovalGrantContract');
    expect(index).toContain("from './ExternalAgentApprovalGrantContract.js'");
    expect(index).toContain('ZavorthApprovalGrantContractNormalization');
  });

  it('changes a valid approval grant to approved-executable in the model only', () => {
    const normalized = normalizeApprovalGrantContractFixture();
    const row = normalized.rows.find((candidate) => candidate.fixtureCase === 'message-send-valid-grant');
    const transition = normalized.transitions.find((candidate) => candidate.id === row?.transitionId);
    const grant = normalized.approvalGrants.find((candidate) => candidate.id === row?.grantId);
    const receipt = normalized.receipts.find((candidate) => candidate.id === row?.receiptId);

    expect(normalized.decision).toBe('approval-grant-contract-ready');
    expect(row?.finalPlanState).toBe('approved-executable');
    expect(transition).toEqual(expect.objectContaining({
      fromPlanState: 'awaiting-approval',
      toPlanState: 'approved-executable',
      stateTransitionApplied: true,
      executableFuture: true,
      executableNowInThisGate: false,
      realExecutionBlockedThisGate: true,
    }));
    expect(grant).toEqual(expect.objectContaining({
      approvalGrantModeled: true,
      approvalActuallyGrantedInModel: true,
      mutationActuallyPerformed: false,
    }));
    expect(receipt).toEqual(expect.objectContaining({
      status: 'approval-modeled',
      approvalActuallyGrantedInModel: true,
      sideEffectFree: true,
    }));
  });

  it('maps rejection, revocation, expiry, and policy invalidation into explicit plan states', () => {
    const normalized = normalizeApprovalGrantContractFixture();
    const stateByCase = Object.fromEntries(normalized.rows.map((row) => [row.fixtureCase, row.finalPlanState]));

    expect(stateByCase['provider-execution-rejected']).toBe('rejected');
    expect(stateByCase['gateway-mutation-revoked']).toBe('revoked');
    expect(stateByCase['session-history-expired']).toBe('expired');
    expect(stateByCase['provider-execution-policy-invalidated']).toBe('policy-invalidated');
  });

  it('blocks divergent scope and insufficient approver metadata during policy recheck', () => {
    const normalized = normalizeApprovalGrantContractFixture();
    const scopeMismatch = normalized.rows.find((row) => row.fixtureCase === 'scope-mismatch-blocked');
    const insufficient = normalized.rows.find((row) => row.fixtureCase === 'insufficient-approver-blocked');
    const scopeGrant = normalized.approvalGrants.find((grant) => grant.id === scopeMismatch?.grantId);
    const insufficientGrant = normalized.approvalGrants.find((grant) => grant.id === insufficient?.grantId);

    expect(scopeMismatch).toEqual(expect.objectContaining({
      finalPlanState: 'policy-invalidated',
      blockedReason: 'scope-mismatch',
    }));
    expect(scopeGrant?.scope.exactScopeMatched).toBe(false);
    expect(scopeGrant?.policyRecheck).toEqual(expect.objectContaining({
      required: true,
      performed: true,
      passed: false,
      invalidationReason: 'scope-mismatch',
    }));

    expect(insufficient).toEqual(expect.objectContaining({
      finalPlanState: 'policy-invalidated',
      blockedReason: 'insufficient-approver',
    }));
    expect(insufficientGrant?.approver).toEqual(expect.objectContaining({
      role: 'observer',
      sufficientForScope: false,
      identityRedacted: true,
    }));
  });

  it('requires TTL, exact scope, approver metadata, policy recheck, and idempotency key on every grant', () => {
    const normalized = normalizeApprovalGrantContractFixture();

    normalized.approvalGrants.forEach((grant) => {
      expect(grant.approver.identityRef).toMatch(/^zavorth-approver:/);
      expect(grant.approver.identityRedacted).toBe(true);
      expect(grant.ttlSeconds).toBeGreaterThan(0);
      expect(Date.parse(grant.expiresAt)).toBeGreaterThan(Date.parse(grant.issuedAt));
      expect(grant.idempotencyKey).toMatch(/^approval-grant:/);
      expect(grant.policyRecheck.required).toBe(true);
      expect(grant.policyRecheck.performed).toBe(true);
      expect(grant.scope.scopeHash).toMatch(/^zavorth-scope:/);
      expect(grant.scope.sourceCapabilityEvidenceOnly).toBe(true);
    });
  });

  it('deduplicates repeated idempotency keys without applying a second transition', () => {
    const normalized = normalizeApprovalGrantContractFixture();
    const key = 'approval-grant:message-send:stable-1';
    const transitions = normalized.transitions.filter((transition) => transition.idempotencyKey === key);
    const applied = transitions.filter((transition) => transition.stateTransitionApplied);
    const duplicate = transitions.find((transition) => transition.idempotencyState === 'duplicate-replay');
    const duplicateReceipt = normalized.receipts.find((receipt) => receipt.transitionId === duplicate?.id);

    expect(transitions).toHaveLength(2);
    expect(applied).toHaveLength(1);
    expect(duplicate).toEqual(expect.objectContaining({
      stateTransitionApplied: false,
      executableFuture: false,
      reusedTransitionId: applied[0].id,
    }));
    expect(duplicateReceipt?.status).toBe('idempotent-replay');
  });

  it('generates audit receipts that are redacted and mutation-free', () => {
    const normalized = normalizeApprovalGrantContractFixture();
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`"]+/);
    expect(serialized).not.toMatch(/bearer\s+[A-Za-z0-9._-]{8,}/i);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    normalized.receipts.forEach((receipt) => {
      expect(receipt.auditAuthority).toBe('zavorth-audit-receipt');
      expect(receipt.simulated).toBe(true);
      expect(receipt.redacted).toBe(true);
      expect(receipt.sideEffectFree).toBe(true);
      expect(receipt.rawSecretSerialized).toBe(false);
      expect(receipt.mutationActuallyPerformed).toBe(false);
      expect(receipt.externalAdapterInvokedForMutation).toBe(false);
      expect(receipt.sourceAuthorityGranted).toBe(false);
    });
  });

  it('keeps all real mutation and source authority gates closed', () => {
    const normalized = normalizeApprovalGrantContractFixture();

    expect(normalized.sourceRehearsalDecision).toBe('approval-required-mutation-rehearsal-ready');
    expect(normalized.executionGate).toEqual({
      approvalGrantModeled: true,
      approvalActuallyGrantedInModel: true,
      mutationActuallyPerformed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      gatewayMutationActuallyCalled: false,
      sessionMutationActuallyPerformed: false,
      externalAdapterInvokedForMutation: false,
      sourceAuthorityGranted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    });
    normalized.transitions.forEach((transition) => {
      expect(transition.executableNowInThisGate).toBe(false);
      expect(transition.realExecutionBlockedThisGate).toBe(true);
      expect(transition.mutationActuallyPerformed).toBe(false);
      expect(transition.sourceAuthorityGranted).toBe(false);
    });
    expect(normalized.nextGateRecommended).toBe('future-controlled-mutation-dispatch-gate');
  });
});
