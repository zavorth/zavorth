import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeApprovedMutationExecutionHarnessFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/180-wave-2-approved-mutation-execution-harness.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentApprovedMutationExecutionHarness.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('approved mutation execution harness', () => {
  it('documents 180 as a dry-run-approved harness with live mutation blocked', () => {
    const content = read(DOC);

    expect(content).toContain('Status: approved-mutation-execution-harness-ready');
    expect(content).toContain('dry-run approved execution');
    expect(content).toContain('live execution blocked');
    expect(content).toContain('policy invalidated');
    expect(content).toContain('approval expired/revoked');
    expect(content).toContain('unsupported executor');
    expect(content).toContain('degraded receipt');
    expect(content).toContain('liveMutationExecutionAllowed: false');
    expect(content).toContain('mutationActuallyPerformed: false');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the approved mutation execution harness boundary', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthApprovedMutationExecutionHarness/v1');
    expect(boundary).toContain('ZavorthApprovedMutationExecutionReceipt/v1');
    expect(boundary).toContain('normalizeApprovedMutationExecutionHarness');
    expect(index).toContain("from './ExternalAgentApprovedMutationExecutionHarness.js'");
    expect(index).toContain('ZavorthApprovedMutationExecutionHarnessNormalization');
  });

  it('accepts only approved-executable source plans from 179', () => {
    const normalized = normalizeApprovedMutationExecutionHarnessFixture();

    expect(normalized.decision).toBe('approved-mutation-execution-harness-ready');
    expect(normalized.sourceApprovalDecision).toBe('approval-grant-contract-ready');
    normalized.rows.forEach((row) => {
      expect(row.sourcePlanState).toBe('approved-executable');
      expect(row.sourceApprovalFixtureCase).toBe('message-send-valid-grant');
      expect(row.zeroMutationSideEffects).toBe(true);
    });
    normalized.executionPlans.forEach((plan) => {
      expect(plan.sourcePlanAccepted).toBe(true);
      expect(plan.sourcePlanState).toBe('approved-executable');
      expect(plan.liveMutationExecutionAllowed).toBe(false);
      expect(plan.externalAdapterInvokedForMutation).toBe(false);
      expect(plan.sourceCapabilityEvidenceOnly).toBe(true);
    });
  });

  it('allows dry-run approved execution without performing mutation', () => {
    const normalized = normalizeApprovedMutationExecutionHarnessFixture();
    const row = normalized.rows.find((candidate) => candidate.fixtureCase === 'dry-run-approved-success');
    const check = normalized.preExecutionChecks.find((candidate) => candidate.id === row?.preExecutionCheckId);
    const plan = normalized.executionPlans.find((candidate) => candidate.id === row?.executionPlanId);
    const receipt = normalized.receipts.find((candidate) => candidate.id === row?.receiptId);

    expect(row?.receiptStatus).toBe('dry-run-approved-success');
    expect(check).toEqual(expect.objectContaining({
      policyRecheckPassed: true,
      approvalTtlValid: true,
      approvalNotRevoked: true,
      idempotencyFresh: true,
      executorSupported: true,
      dryRunApprovedExecutionAllowed: true,
      liveMutationExecutionAllowed: false,
    }));
    expect(plan?.dryRunApprovedExecutionAllowed).toBe(true);
    expect(receipt).toEqual(expect.objectContaining({
      status: 'dry-run-approved-success',
      dryRunApprovedExecutionAllowed: true,
      mutationActuallyPerformed: false,
      messageActuallySent: false,
    }));
  });

  it('blocks live execution even for approved plans', () => {
    const normalized = normalizeApprovedMutationExecutionHarnessFixture();
    const row = normalized.rows.find((candidate) => candidate.fixtureCase === 'live-execution-blocked');
    const check = normalized.preExecutionChecks.find((candidate) => candidate.id === row?.preExecutionCheckId);
    const receipt = normalized.receipts.find((candidate) => candidate.id === row?.receiptId);

    expect(row?.receiptStatus).toBe('live-blocked');
    expect(check).toEqual(expect.objectContaining({
      mode: 'live',
      liveExecutionBlockedByGate: true,
      dryRunApprovedExecutionAllowed: false,
      liveMutationExecutionAllowed: false,
    }));
    expect(receipt).toEqual(expect.objectContaining({
      status: 'live-blocked',
      liveMutationExecutionAllowed: false,
      mutationActuallyPerformed: false,
    }));
  });

  it('emits policy invalidated, expired, revoked, unsupported, and degraded receipts', () => {
    const normalized = normalizeApprovedMutationExecutionHarnessFixture();
    const statusByCase = Object.fromEntries(normalized.rows.map((row) => [row.fixtureCase, row.receiptStatus]));

    expect(statusByCase['policy-invalidated-before-execution']).toBe('policy-invalidated');
    expect(statusByCase['approval-expired-before-execution']).toBe('approval-expired');
    expect(statusByCase['approval-revoked-before-execution']).toBe('approval-revoked');
    expect(statusByCase['unsupported-executor']).toBe('unsupported-executor');
    expect(statusByCase['degraded-failure-receipt']).toBe('degraded-failure');
  });

  it('revalidates policy, TTL, revocation, idempotency, and executor support before execution', () => {
    const normalized = normalizeApprovedMutationExecutionHarnessFixture();

    normalized.preExecutionChecks.forEach((check) => {
      expect(check.policyRevalidated).toBe(true);
      expect(check.approvalTtlRevalidated).toBe(true);
      expect(check.approvalRevocationRevalidated).toBe(true);
      expect(check.idempotencyRevalidated).toBe(true);
      expect(check.idempotencyKey).toMatch(/^approved-mutation-harness:/);
      expect(check.governedExecutorBoundary).toEqual(expect.objectContaining({
        entrypoint: 'AgentRunService',
        directExternalInvocationAllowed: false,
      }));
      expect(check.sourceCapabilityEvidenceOnly).toBe(true);
      expect(check.sourceAuthorityGranted).toBe(false);
      expect(check.rawSecretSerialized).toBe(false);
    });
  });

  it('generates redacted audit receipts with zero side effects', () => {
    const normalized = normalizeApprovedMutationExecutionHarnessFixture();
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`"]+/);
    expect(serialized).not.toMatch(/bearer\s+[A-Za-z0-9._-]{8,}/i);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    normalized.receipts.forEach((receipt) => {
      expect(receipt.auditAuthority).toBe('zavorth-audit-receipt');
      expect(receipt.simulated).toBe(true);
      expect(receipt.redacted).toBe(true);
      expect(receipt.sideEffectFree).toBe(true);
      expect(receipt.approvedMutationHarnessCreated).toBe(true);
      expect(receipt.rawSecretSerialized).toBe(false);
      expect(receipt.externalAdapterInvokedForMutation).toBe(false);
      expect(receipt.sourceAuthorityGranted).toBe(false);
    });
  });

  it('keeps all live mutation and source authority gates closed', () => {
    const normalized = normalizeApprovedMutationExecutionHarnessFixture();

    expect(normalized.executionGate).toEqual({
      approvedMutationHarnessCreated: true,
      dryRunApprovedExecutionAllowed: true,
      liveMutationExecutionAllowed: false,
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
    normalized.receipts.forEach((receipt) => {
      expect(receipt.mutationActuallyPerformed).toBe(false);
      expect(receipt.messageActuallySent).toBe(false);
      expect(receipt.providerActuallyExecuted).toBe(false);
      expect(receipt.commandActuallyExecuted).toBe(false);
      expect(receipt.toolActuallyExecuted).toBe(false);
      expect(receipt.gatewayMutationActuallyCalled).toBe(false);
      expect(receipt.sessionMutationActuallyPerformed).toBe(false);
      expect(receipt.sourceModuleCopied).toBe(false);
      expect(receipt.nativeReplacementAuthorized).toBe(false);
    });
    expect(normalized.nextGateRecommended).toBe('future-controlled-live-mutation-execution-gate');
  });
});
