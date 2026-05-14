import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthExternalActionDispatchDesignFixtureRecords,
  normalizeZavorthExternalActionDispatchDesignFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/174-wave-2-controlled-action-dispatch-design.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentControlledActionDispatchDesign.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('controlled action dispatch design', () => {
  it('documents 174 as design-only controlled action dispatch', () => {
    const content = read(DOC);

    expect(content).toContain('Status: controlled-action-dispatch-design-ready');
    expect(content).toContain('docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md -> authenticated-health-ok');
    expect(content).toContain('docs/173-wave-1-command-center-live-assimilation.md -> command-center-live-assimilation-ready');
    expect(content).toContain('nativeContract: ZavorthExternalActionIntent/v1');
    expect(content).toContain('nativeContract: ZavorthExternalActionPreflight/v1');
    expect(content).toContain('nativeContract: ZavorthExternalActionApprovalRequest/v1');
    expect(content).toContain('nativeContract: ZavorthExternalActionDispatchPlan/v1');
    expect(content).toContain('nativeContract: ZavorthExternalActionReceipt/v1');
    expect(content).toContain('executionActuallyPerformed: false');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the design boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthControlledActionDispatchDesign/v1');
    expect(boundary).toContain('ZavorthExternalActionIntent/v1');
    expect(boundary).toContain('ZavorthExternalActionPreflight/v1');
    expect(boundary).toContain('GOVERNED_EXECUTOR_BOUNDARY');
    expect(index).toContain("from './ExternalAgentControlledActionDispatchDesign.js'");
    expect(index).toContain('ZavorthExternalActionDispatchPlan');
  });

  it('maps source-derived capability evidence into ZavorthExternalActionIntent rows', () => {
    const records = createZavorthExternalActionDispatchDesignFixtureRecords();
    const normalized = normalizeZavorthExternalActionDispatchDesignFixture();

    expect(records).toHaveLength(5);
    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthControlledActionDispatchDesign/v1',
      decision: 'controlled-action-dispatch-design-ready',
      readOnlyDesignOnly: true,
      commandCenterAssimilationReady: true,
    }));
    expect(normalized.supportedControlLevels).toEqual([
      'read-only',
      'dry-run',
      'approval-required',
      'blocked',
      'executable-future',
    ]);
    expect(normalized.intents.map((intent) => intent.actionKind).sort()).toEqual([
      'command-tool-execution',
      'gateway-method-call',
      'message-send',
      'provider-execution',
      'session-history-mutation',
    ]);
    normalized.intents.forEach((intent) => {
      expect(intent.nativeContract).toBe('ZavorthExternalActionIntent/v1');
      expect(intent.capability.sourceCapabilityAuthority).toBe(false);
      expect(intent.capability.sourceIdentityPublic).toBe(false);
      expect(intent.sourceAuthorityGranted).toBe(false);
      expect(intent.sourceModuleCopied).toBe(false);
      expect(intent.nativeReplacementAuthorized).toBe(false);
      expect(intent.rawSecretSerialized).toBe(false);
    });
  });

  it('runs every intent through Zavorth policy preflight', () => {
    const normalized = normalizeZavorthExternalActionDispatchDesignFixture();
    const decisionsByKind = Object.fromEntries(
      normalized.preflights.map((preflight) => [preflight.actionKind, preflight.decision]),
    );

    expect(normalized.preflights).toHaveLength(normalized.intents.length);
    expect(decisionsByKind['gateway-method-call']).toBe('allowed-dry-run');
    expect(decisionsByKind['message-send']).toBe('approval-required');
    expect(decisionsByKind['provider-execution']).toBe('approval-required');
    expect(decisionsByKind['command-tool-execution']).toBe('blocked');
    expect(decisionsByKind['session-history-mutation']).toBe('blocked');
    normalized.preflights.forEach((preflight) => {
      expect(preflight.policyAuthority).toBe('zavorth-policy-preflight');
      expect(preflight.sourcePolicyAuthority).toBe(false);
      expect(preflight.sourceApprovalHintAuthority).toBe(false);
      expect(preflight.executionActuallyPerformed).toBe(false);
    });
  });

  it('turns mutable intents into approval requests and dangerous intents into blocked plans', () => {
    const normalized = normalizeZavorthExternalActionDispatchDesignFixture();
    const approvalStates = Object.fromEntries(
      normalized.approvalRequests.map((request) => [request.actionKind, request.approvalState]),
    );
    const planStates = Object.fromEntries(
      normalized.dispatchPlans.map((plan) => [plan.actionKind, plan.planState]),
    );

    expect(approvalStates['message-send']).toBe('pending-human-approval');
    expect(approvalStates['provider-execution']).toBe('pending-human-approval');
    expect(approvalStates['command-tool-execution']).toBe('not-requested-for-blocked');
    expect(approvalStates['session-history-mutation']).toBe('not-requested-for-blocked');
    expect(approvalStates['gateway-method-call']).toBe('unneeded-for-dry-run');
    expect(planStates['message-send']).toBe('approval-pending');
    expect(planStates['provider-execution']).toBe('approval-pending');
    expect(planStates['command-tool-execution']).toBe('blocked');
    expect(planStates['session-history-mutation']).toBe('blocked');
    expect(planStates['gateway-method-call']).toBe('dry-run-only');
  });

  it('never executes dispatch plans in this gate and uses the governed executor boundary only as metadata', () => {
    const normalized = normalizeZavorthExternalActionDispatchDesignFixture();

    expect(normalized.governedExecutorBoundary).toEqual({
      entrypoint: 'AgentRunService',
      resultContract: 'UniversalAgentExecutorResult',
      directExternalInvocationAllowed: false,
      approvalResumeRequiredForRiskyRuns: true,
      failureSemanticsRequired: true,
    });
    normalized.dispatchPlans.forEach((plan) => {
      expect(plan.governedExecutorBoundary.directExternalInvocationAllowed).toBe(false);
      expect(plan.dispatchDeferredToFutureGate).toBe(true);
      expect(plan.executionActuallyPerformed).toBe(false);
      expect(plan.messageActuallySent).toBe(false);
      expect(plan.providerActuallyExecuted).toBe(false);
      expect(plan.commandActuallyExecuted).toBe(false);
      expect(plan.gatewayMutationActuallyCalled).toBe(false);
      expect(plan.sessionMutationActuallyPerformed).toBe(false);
      expect(plan.sourceAuthorityGranted).toBe(false);
      expect(plan.sourceModuleCopied).toBe(false);
      expect(plan.nativeReplacementAuthorized).toBe(false);
      expect(plan.rawSecretSerialized).toBe(false);
    });
  });

  it('emits simulated audit receipts without side effects', () => {
    const normalized = normalizeZavorthExternalActionDispatchDesignFixture();
    const receiptStatuses = normalized.receipts.map((receipt) => receipt.status).sort();

    expect(receiptStatuses).toEqual([
      'approval-requested',
      'approval-requested',
      'blocked-by-policy',
      'blocked-by-policy',
      'simulated-dry-run',
    ]);
    normalized.receipts.forEach((receipt) => {
      expect(receipt.nativeContract).toBe('ZavorthExternalActionReceipt/v1');
      expect(receipt.auditAuthority).toBe('zavorth-audit-receipt');
      expect(receipt.simulated).toBe(true);
      expect(receipt.sideEffectFree).toBe(true);
      expect(receipt.executionActuallyPerformed).toBe(false);
      expect(receipt.rawSecretSerialized).toBe(false);
    });
  });

  it('serializes no raw credentials or source identity authority', () => {
    const normalized = normalizeZavorthExternalActionDispatchDesignFixture();
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toMatch(/ExternalExecutor|external-executor/);
    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(serialized).not.toMatch(/bearer\s+[A-Za-z0-9._-]{8,}/i);
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      serializedOutputContainsSensitiveFixture: false,
    });
  });

  it('keeps all required execution and mutation guarantees false', () => {
    const normalized = normalizeZavorthExternalActionDispatchDesignFixture();

    expect(normalized.executionGate).toEqual({
      executionActuallyPerformed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      gatewayMutationActuallyCalled: false,
      sessionMutationActuallyPerformed: false,
      sourceAuthorityGranted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-controlled-action-dispatch-fixture-or-dry-run-only-gate');
  });
});
