import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeMessageSendLiveRehearsalTransportBlockedFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/182-wave-2-message-send-live-rehearsal-transport-blocked.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentMessageSendLiveRehearsalTransportBlocked.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('message send live rehearsal transport blocked', () => {
  it('documents 182 as message-send flow with external transport blocked', () => {
    const content = read(DOC);

    expect(content).toContain('Status: message-send-live-rehearsal-transport-blocked-ready');
    expect(content).toContain('ZavorthExternalMessageSendIntent');
    expect(content).toContain('transport blocked receipt');
    expect(content).toContain('messageActuallySent: false');
    expect(content).toContain('externalTransportInvoked: false');
    expect(content).toContain('rawSecretSerialized: false');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the message-send transport blocked boundary', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthExternalMessageSendIntent/v1');
    expect(boundary).toContain('ZavorthExternalMessageSendTransportAdapterBoundary/v1');
    expect(boundary).toContain('normalizeMessageSendLiveRehearsalTransportBlocked');
    expect(index).toContain("from './ExternalAgentMessageSendLiveRehearsalTransportBlocked.js'");
    expect(index).toContain('ZavorthMessageSendLiveRehearsalTransportBlockedNormalization');
  });

  it('normalizes target, channel, thread, and session through Zavorth-native views', () => {
    const normalized = normalizeMessageSendLiveRehearsalTransportBlockedFixture();
    const approved = normalized.intents.find((intent) => intent.fixtureCase === 'approved-message-send-transport-blocked');

    expect(normalized.sourceReadiness).toEqual(expect.objectContaining({
      sessionHistoryReady: 'external-executor-session-history-read-only-bridge-ready',
      commandCenterReady: 'command-center-live-assimilation-ready',
      approvalGrantReady: 'approval-grant-contract-ready',
      executionHarnessReady: 'approved-mutation-execution-harness-ready',
      firstLiveMutationDecision: 'no-safe-live-mutation-target',
    }));
    expect(approved?.nativeContract).toBe('ZavorthExternalMessageSendIntent/v1');
    expect(approved?.target).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalMessageSendTarget/v1',
      channel: 'api',
      targetStatus: 'ready',
      targetValid: true,
      sourceIdsEvidenceOnly: true,
      rawTargetSerialized: false,
    }));
    expect(approved?.target.stableSessionId).toMatch(/^zavorth_session_view:/);
    expect(approved?.target.stableThreadId).toMatch(/^zavorth_thread_view:/);
    expect(approved?.target.commandCenterSessionViewId).toContain('command-center');
  });

  it('passes message send intent through policy and preflight', () => {
    const normalized = normalizeMessageSendLiveRehearsalTransportBlockedFixture();
    const approvedRow = normalized.rows.find((row) => row.fixtureCase === 'approved-message-send-transport-blocked');
    const preflight = normalized.preflights.find((candidate) => candidate.id === approvedRow?.preflightId);

    expect(preflight).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalMessageSendPreflight/v1',
      decision: 'approved',
      approvalRequired: false,
      policyAuthority: 'zavorth-policy-preflight',
      targetValid: true,
      sourcePolicyAuthority: false,
      messageActuallySent: false,
    }));
  });

  it('keeps rows without valid approval awaiting approval or blocked', () => {
    const normalized = normalizeMessageSendLiveRehearsalTransportBlockedFixture();
    const awaiting = normalized.rows.find((row) => row.fixtureCase === 'without-approval-awaiting-approval');
    const blocked = normalized.rows.find((row) => row.fixtureCase === 'policy-blocked-message-send');

    expect(awaiting).toEqual(expect.objectContaining({
      planState: 'awaiting-approval',
      receiptStatus: 'awaiting-approval',
      messageActuallySent: false,
    }));
    expect(blocked).toEqual(expect.objectContaining({
      planState: 'blocked',
      receiptStatus: 'blocked',
      messageActuallySent: false,
    }));
  });

  it('turns valid approval into approved-executable but blocks the transport', () => {
    const normalized = normalizeMessageSendLiveRehearsalTransportBlockedFixture();
    const row = normalized.rows.find((candidate) => candidate.fixtureCase === 'approved-message-send-transport-blocked');
    const approval = normalized.approvalGrants.find((candidate) => candidate.id === row?.approvalGrantId);
    const plan = normalized.dispatchPlans.find((candidate) => candidate.id === row?.dispatchPlanId);
    const boundary = normalized.transportBoundaries.find((candidate) => candidate.id === row?.transportBoundaryId);
    const receipt = normalized.receipts.find((candidate) => candidate.id === row?.receiptId);

    expect(approval).toEqual(expect.objectContaining({
      approvalState: 'approved',
      approvalGrantValid: true,
      approvedExecutable: true,
      approverIdentityRedacted: true,
    }));
    expect(plan).toEqual(expect.objectContaining({
      planState: 'approved-executable',
      transportMode: 'transport-blocked',
      executableFuture: true,
      executableNowInThisGate: false,
      idempotencyState: 'unique',
    }));
    expect(boundary).toEqual(expect.objectContaining({
      transportAdapterBoundaryCreated: true,
      transportLiveBlocked: true,
      externalTransportInvoked: false,
      commandArgTokenUsed: false,
    }));
    expect(receipt).toEqual(expect.objectContaining({
      status: 'transport-blocked',
      transportLiveBlocked: true,
      messageActuallySent: false,
      externalTransportInvoked: false,
    }));
  });

  it('redacts sensitive content in receipts and serialized output', () => {
    const normalized = normalizeMessageSendLiveRehearsalTransportBlockedFixture();
    const sensitiveReceipt = normalized.receipts.find((receipt) => receipt.fixtureCase === 'sensitive-content-redacted');
    const serialized = JSON.stringify(normalized);

    expect(sensitiveReceipt).toEqual(expect.objectContaining({
      contentPreview: '[redacted-content]',
      rawContentSerialized: false,
      redacted: true,
    }));
    expect(serialized).not.toContain('synthetic-sensitive-message-content');
    expect(serialized).not.toMatch(/bearer\s+[A-Za-z0-9._-]{8,}/i);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('uses idempotency to prevent duplicate sends', () => {
    const normalized = normalizeMessageSendLiveRehearsalTransportBlockedFixture();
    const duplicate = normalized.rows.find((row) => row.fixtureCase === 'duplicate-idempotency-transport-blocked');
    const duplicatePlan = normalized.dispatchPlans.find((plan) => plan.id === duplicate?.dispatchPlanId);
    const duplicateReceipt = normalized.receipts.find((receipt) => receipt.id === duplicate?.receiptId);

    expect(duplicatePlan).toEqual(expect.objectContaining({
      idempotencyKey: 'message-send-rehearsal:approved:1',
      idempotencyState: 'duplicate-replay',
      executableNowInThisGate: false,
    }));
    expect(duplicateReceipt?.status).toBe('idempotent-replay-transport-blocked');
    expect(duplicateReceipt?.messageActuallySent).toBe(false);
  });

  it('turns invalid targets into degraded/blocked receipts without crashing', () => {
    const normalized = normalizeMessageSendLiveRehearsalTransportBlockedFixture();
    const invalid = normalized.rows.find((row) => row.fixtureCase === 'invalid-target-degraded');
    const intent = normalized.intents.find((candidate) => candidate.id === invalid?.intentId);
    const receipt = normalized.receipts.find((candidate) => candidate.id === invalid?.receiptId);

    expect(invalid).toEqual(expect.objectContaining({
      planState: 'degraded',
      receiptStatus: 'degraded-invalid-target',
      messageActuallySent: false,
    }));
    expect(intent?.target).toEqual(expect.objectContaining({
      targetValid: false,
      targetStatus: 'unavailable',
    }));
    expect(receipt?.messageActuallySent).toBe(false);
  });

  it('keeps all execution and transport gates closed', () => {
    const normalized = normalizeMessageSendLiveRehearsalTransportBlockedFixture();

    expect(normalized.executionGate).toEqual({
      messageSendFlowModeled: true,
      transportAdapterBoundaryCreated: true,
      transportLiveBlocked: true,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      gatewayMutationActuallyCalled: false,
      sessionMutationActuallyPerformed: false,
      externalTransportInvoked: false,
      sourceAuthorityGranted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    });
    normalized.receipts.forEach((receipt) => {
      expect(receipt.messageActuallySent).toBe(false);
      expect(receipt.providerActuallyExecuted).toBe(false);
      expect(receipt.commandActuallyExecuted).toBe(false);
      expect(receipt.toolActuallyExecuted).toBe(false);
      expect(receipt.gatewayMutationActuallyCalled).toBe(false);
      expect(receipt.sessionMutationActuallyPerformed).toBe(false);
      expect(receipt.externalTransportInvoked).toBe(false);
      expect(receipt.sourceAuthorityGranted).toBe(false);
      expect(receipt.sourceModuleCopied).toBe(false);
      expect(receipt.nativeReplacementAuthorized).toBe(false);
      expect(receipt.rawSecretSerialized).toBe(false);
    });
    expect(normalized.nextGateRecommended).toBe('future-explicit-message-send-transport-gate');
  });
});
