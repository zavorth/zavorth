import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeApprovalRequiredMutationRehearsalFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/178-wave-2-approval-required-mutation-rehearsal.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentApprovalRequiredMutationRehearsal.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('approval-required mutation rehearsal', () => {
  it('documents 178 as a zero-side-effect mutation rehearsal', () => {
    const content = read(DOC);

    expect(content).toContain('Status: approval-required-mutation-rehearsal-ready');
    expect(content).toContain('docs/177-wave-2-governed-read-only-capability-refresh.md -> governed-read-only-capability-refresh-ok');
    expect(content).toContain('mutable intent');
    expect(content).toContain('planState: awaiting-approval | blocked');
    expect(content).toContain('mutationActuallyPerformed: false');
    expect(content).toContain('approvalActuallyGranted: false');
    expect(content).toContain('docs/179-wave-2-approval-grant-contract.md');
    expect(content).toContain('Do not execute real mutation');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the rehearsal boundary and public contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthApprovalRequiredMutationRehearsal/v1');
    expect(boundary).toContain('ZavorthExternalActionApprovalRequest/v1');
    expect(boundary).toContain('planState:');
    expect(boundary).toContain('normalizeApprovalRequiredMutationRehearsal');
    expect(index).toContain("from './ExternalAgentApprovalRequiredMutationRehearsal.js'");
    expect(index).toContain('ZavorthApprovalRequiredMutationRehearsalNormalization');
  });

  it('turns mutable message, session, and gateway mutation intents into approval-required plans', () => {
    const normalized = normalizeApprovalRequiredMutationRehearsalFixture();
    const approvalRows = normalized.rows.filter((row) => row.decision === 'approval-required');
    const approvalsByKind = Object.fromEntries(approvalRows.map((row) => [row.actionKind, row]));

    expect(normalized.decision).toBe('approval-required-mutation-rehearsal-ready');
    expect(approvalsByKind['message-send']?.planState).toBe('awaiting-approval');
    expect(approvalsByKind['session-history-mutation']?.planState).toBe('awaiting-approval');
    expect(approvalsByKind['gateway-mutation-method']?.planState).toBe('awaiting-approval');
    approvalRows.forEach((row) => {
      const approval = normalized.approvalRequests.find((candidate) => candidate.id === row.approvalRequestId);
      const plan = normalized.dispatchPlans.find((candidate) => candidate.id === row.dispatchPlanId);
      const receipt = normalized.receipts.find((candidate) => candidate.id === row.receiptId);

      expect(approval?.approvalState).toBe('pending-human-approval');
      expect(approval?.approvalActuallyGranted).toBe(false);
      expect(plan?.planState).toBe('awaiting-approval');
      expect(plan?.executableNow).toBe(false);
      expect(receipt?.status).toBe('simulated-awaiting-approval');
      expect(receipt?.sideEffectFree).toBe(true);
    });
  });

  it('classifies provider execution as approval-required or blocked according to policy', () => {
    const normalized = normalizeApprovalRequiredMutationRehearsalFixture();
    const providerRows = normalized.rows.filter((row) => row.actionKind === 'provider-execution');

    expect(providerRows.map((row) => row.decision).sort()).toEqual(['approval-required', 'blocked']);
    expect(providerRows.find((row) => row.decision === 'approval-required')?.planState).toBe('awaiting-approval');
    expect(providerRows.find((row) => row.decision === 'blocked')?.planState).toBe('blocked');
  });

  it('keeps dangerous command/tool execution blocked', () => {
    const normalized = normalizeApprovalRequiredMutationRehearsalFixture();
    const commandRow = normalized.rows.find((row) => row.actionKind === 'command-tool-execution');
    const receipt = normalized.receipts.find((candidate) => candidate.id === commandRow?.receiptId);

    expect(commandRow).toEqual(expect.objectContaining({
      decision: 'blocked',
      planState: 'blocked',
      zeroSideEffects: true,
    }));
    expect(receipt).toEqual(expect.objectContaining({
      status: 'simulated-blocked',
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
    }));
  });

  it('records rollback and compensation metadata without executing it', () => {
    const normalized = normalizeApprovalRequiredMutationRehearsalFixture();
    const rollbackPlans = normalized.dispatchPlans.filter((plan) => plan.rollbackOrCompensationRequired);

    expect(rollbackPlans.length).toBeGreaterThanOrEqual(4);
    rollbackPlans.forEach((plan) => {
      expect(plan.rollbackOrCompensationMetadataOnly).toBe(true);
      expect(plan.executableNow).toBe(false);
      expect(plan.externalAdapterInvokedForMutation).toBe(false);
    });
  });

  it('keeps read-only 176/177 paths available without mutation regression', () => {
    const normalized = normalizeApprovalRequiredMutationRehearsalFixture();

    expect(normalized.readOnlyRegression).toEqual({
      nativeContract: 'ZavorthReadOnlyRegressionState/v1',
      firstGovernedGatewayActionDecision: 'governed-read-only-gateway-action-ok',
      governedCapabilityRefreshDecision: 'governed-read-only-capability-refresh-ok',
      readOnlyGatewayPathStillAvailable: true,
      readOnlyRefreshPathStillAvailable: true,
      mutationAuthorityIntroducedIntoReadOnlyPath: false,
    });
  });

  it('generates redacted audit-ready approval requests and simulated receipts', () => {
    const normalized = normalizeApprovalRequiredMutationRehearsalFixture();
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`"]+/);
    expect(serialized).not.toMatch(/bearer\s+[A-Za-z0-9._-]{8,}/i);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    normalized.approvalRequests.forEach((approval) => {
      expect(approval.redacted).toBe(true);
      expect(approval.auditReady).toBe(true);
      expect(approval.rawSecretSerialized).toBe(false);
      expect(approval.mutationActuallyPerformed).toBe(false);
    });
    normalized.receipts.forEach((receipt) => {
      expect(receipt.simulated).toBe(true);
      expect(receipt.sideEffectFree).toBe(true);
      expect(receipt.redacted).toBe(true);
      expect(receipt.rawSecretSerialized).toBe(false);
    });
  });

  it('grants no approval, mutation, adapter, source authority, copy, or replacement', () => {
    const normalized = normalizeApprovalRequiredMutationRehearsalFixture();

    expect(normalized.executionGate).toEqual({
      mutationActuallyPerformed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      gatewayMutationActuallyCalled: false,
      sessionMutationActuallyPerformed: false,
      approvalActuallyGranted: false,
      externalAdapterInvokedForMutation: false,
      sourceAuthorityGranted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    });
    normalized.receipts.forEach((receipt) => {
      expect(receipt.mutationActuallyPerformed).toBe(false);
      expect(receipt.messageActuallySent).toBe(false);
      expect(receipt.providerActuallyExecuted).toBe(false);
      expect(receipt.commandActuallyExecuted).toBe(false);
      expect(receipt.toolActuallyExecuted).toBe(false);
      expect(receipt.gatewayMutationActuallyCalled).toBe(false);
      expect(receipt.sessionMutationActuallyPerformed).toBe(false);
      expect(receipt.approvalActuallyGranted).toBe(false);
      expect(receipt.externalAdapterInvokedForMutation).toBe(false);
      expect(receipt.sourceAuthorityGranted).toBe(false);
    });
    expect(normalized.nextGateRecommended).toBe('future-approval-grant-design-only');
  });
});
