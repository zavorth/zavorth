import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4DTestTargetBlockerId,
  ZavorthWave4DTestTargetRequirementId,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/236-wave-4d-real-message-send-test-target-provisioning-plan.md';
const NEXT_DOC = 'docs/237-wave-4d-final-dry-run-against-approved-test-target.md';
const PRIOR_DOC = 'docs/235-wave-4c3-session-storage-schema-parity-absorption-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4DRealMessageSendTestTargetProvisioningPlan.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const REQUIREMENTS: ZavorthWave4DTestTargetRequirementId[] = [
  'explicit-test-sandbox-marking',
  'native-target-session-channel-transport-resolution',
  'secretref-secure-resolver',
  'policy-test-send-allowed',
  'approval-grant-required',
  'idempotency-key',
  'rate-limit',
  'audit-receipt',
  'rollback-compensation-recall',
  'dry-run-before-live',
  'content-redacted-derived-only',
];

const DEFAULT_BLOCKERS: ZavorthWave4DTestTargetBlockerId[] = [
  'missing-approval-grant',
  'rollback-compensation-missing',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain('raw user message body that must never migrate');
  expect(serialized).not.toContain('unredacted private message fixture');
  expect(serialized).not.toContain('attachment binary fixture that must never migrate');
}

describe('Wave 4D real message send test target provisioning plan', () => {
  it('documents 236 as test target provisioning with no send or transport open', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4d-real-message-send-test-target-provisioning-plan-ready`');
    expect(content).toContain('ZavorthWave4DRealMessageSendTestTargetProvisioningPlan.ts');
    expect(content).toContain('ZavorthWave4DRealMessageSendTestTargetProvisioningPlan/v1');
    expect(content).toContain('ZavorthWave4DTestTargetCandidate/v1');
    expect(content).toContain('wave4dTestTargetProvisioningPlanCreated=true');
    expect(content).toContain('realMessageSendActuallyPerformed=false');
    expect(content).toContain('transportActuallyOpened=false');
    expect(content).toContain('testTargetRequiredForFutureSend=true');
    expect(content).toContain('approvalRequiredForFutureSend=true');
    expect(content).toContain('dryRunRequiredBeforeFutureSend=true');
    REQUIREMENTS.forEach((requirement) => expect(content).toContain(requirement));
    expect(content).toContain('Final Dry-Run Follow-Up');
    expect(content).toContain(NEXT_DOC);
    expect(content).toContain('Do not advance beyond `237`');
    assertNoRawSecretOrContent(content);
  });

  it('updates tracking docs and the 235 handoff for 236', () => {
    expect(read(PRIOR_DOC)).toContain('Wave 4D Test Target Follow-Up');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`236` continues Wave 4D');
  });

  it('exports the Wave 4D test target provisioning boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4DRealMessageSendTestTargetProvisioningPlan/v1');
    expect(boundary).toContain('ZavorthWave4DTestTargetRequirement/v1');
    expect(boundary).toContain('ZavorthWave4DTestTargetCandidate/v1');
    expect(boundary).toContain('ZavorthWave4DTestTargetProvisioningGate');
    expect(index).toContain("from './ZavorthWave4DRealMessageSendTestTargetProvisioningPlan.js'");
    expect(index).toContain('ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_TEST_TARGET_PROVISIONING_PLAN_RUNTIME_ID');
  });

  it('lists complete test target requirements and acceptable target types', () => {
    const plan = createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture();

    expect(plan.normalization.decision).toBe('wave4d-real-message-send-test-target-provisioning-plan-ready');
    expect(plan.requirementIds()).toEqual(REQUIREMENTS);
    expect(plan.acceptableTargetTypeIds()).toEqual(['local-test-harness']);
    plan.normalization.requirements.forEach((requirement) => {
      expect(requirement).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4DTestTargetRequirement/v1',
        requiredForFutureSend: true,
        rawSecretSerialized: false,
        rawContentUsageAllowed: false,
      }));
      expect(requirement.evidenceGates.length).toBeGreaterThan(0);
    });
    expect(plan.normalization.acceptableTargetTypes).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetType: 'local-test-harness' }),
      expect.objectContaining({ targetType: 'dry-run-to-live-test-sink' }),
      expect.objectContaining({ targetType: 'operator-marked-external-test-target' }),
    ]));
  });

  it('prepares a test target candidate but never sends or opens transport', () => {
    const plan = createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture();

    expect(plan.candidatePreparedNotExecuted()).toBe(true);
    expect(plan.normalization.testTargetCandidate).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4DTestTargetCandidate/v1',
      candidateId: 'wave4d-first-controlled-message-send-test-target-candidate',
      candidateStatus: 'prepared-not-executed',
      targetType: 'local-test-harness',
      explicitlyMarkedTestSandbox: true,
      targetSessionChannelTransportResolvedByNativeMetadata: true,
      secretRefsAvailableAsResolver: true,
      policyAllowsTestSend: true,
      approvalGrantRequired: true,
      approvalGrantPresentNow: false,
      rateLimitRequired: true,
      receiptAuditRequired: true,
      rollbackCompensationRecallRequired: true,
      dryRunRequiredBeforeFutureSend: true,
      contentPolicy: 'redacted-derived-approved-only',
      rawContentUsageAllowed: false,
      externalTransportExecutionDependency: 'explicit-execution-dependency-not-default-runtime',
      externalExecutorDefaultRuntimeRequired: false,
      realMessageSendActuallyPerformed: false,
      transportActuallyOpened: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      externalExecutorMutationAllowed: false,
    }));
  });

  it('records default go/no-go blockers for missing approval and rollback without blocking the plan document', () => {
    const plan = createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture();

    expect(plan.normalization.decision).toBe('wave4d-real-message-send-test-target-provisioning-plan-ready');
    expect(plan.goNoGoBlockerIds()).toEqual(DEFAULT_BLOCKERS);
    DEFAULT_BLOCKERS.forEach((blocker) => {
      expect(plan.normalization.goNoGoCriteria).toEqual(expect.arrayContaining([
        expect.objectContaining({ decision: 'no-go-blocked', blockerId: blocker }),
      ]));
    });
    expect(plan.normalization.goNoGoCriteria).toEqual(expect.arrayContaining([
      expect.objectContaining({ criterionId: 'target-marked-test-sandbox', satisfiedNow: true }),
      expect.objectContaining({ criterionId: 'target-session-channel-transport-resolved', satisfiedNow: true }),
      expect.objectContaining({ criterionId: 'secretref-present-redacted', satisfiedNow: true }),
      expect.objectContaining({ criterionId: 'policy-test-send-allowed', satisfiedNow: true }),
      expect.objectContaining({ criterionId: 'dry-run-passed', satisfiedNow: true }),
    ]));
  });

  it('blocks target candidates without explicit test/sandbox marking', () => {
    const plan = createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture({
      localTestHarnessAvailable: false,
      dryRunToLiveTestSinkAvailable: false,
      externalRealChannelCandidateAvailable: true,
      externalRealChannelOperatorMarkedTest: false,
      targetMarkedTestSandbox: false,
    });

    expect(plan.normalization.decision).toBe('wave4d-real-message-send-test-target-provisioning-plan-ready');
    expect(plan.normalization.testTargetCandidate.targetType).toBe('operator-marked-external-test-target');
    expect(plan.normalization.testTargetCandidate.explicitlyMarkedTestSandbox).toBe(false);
    expect(plan.goNoGoBlockerIds()).toContain('target-not-marked-test-sandbox');
    expect(plan.normalization.acceptableTargetTypes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetType: 'operator-marked-external-test-target',
        explicitOperatorTestMarkRequired: true,
        explicitOperatorTestMarkPresent: false,
        acceptableForFutureLiveGate: false,
      }),
    ]));
    expect(plan.normalization.testTargetCandidate.realMessageSendActuallyPerformed).toBe(false);
    expect(plan.normalization.testTargetCandidate.transportActuallyOpened).toBe(false);
  });

  it('records missing SecretRef, approval, policy, and dry-run as go/no-go blockers', () => {
    const plan = createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture({
      secretRefsAvailableAsResolver: false,
      policyAllowsTestSend: false,
      approvalGrantPresentNow: false,
      dryRunEvidencePresent: false,
    });

    expect(plan.goNoGoBlockerIds()).toEqual(expect.arrayContaining([
      'missing-secretref',
      'policy-rejected',
      'missing-approval-grant',
      'missing-dry-run-evidence',
    ]));
    expect(plan.normalization.testTargetCandidate.secretRefsAvailableAsResolver).toBe(false);
    expect(plan.normalization.testTargetCandidate.policyAllowsTestSend).toBe(false);
    expect(plan.normalization.testTargetCandidate.dryRunEvidencePresent).toBe(false);
    expect(plan.normalization.testTargetCandidate.realMessageSendActuallyPerformed).toBe(false);
  });

  it('records evidence from 234, 230-233, 222-225, 218-229, 235, 174-180, and 187', () => {
    const plan = createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture();

    expect(plan.normalization.evidence).toEqual({
      nativeContract: 'ZavorthWave4DTestTargetProvisioningEvidence/v1',
      realMessageSendReadinessBy234: true,
      messageSendDryRunExecutablesBy230To233: true,
      targetSessionChannelTransportValidationBy222To225: true,
      sessionHistoryMetadataAndRedactedContentBy218To229: true,
      sessionStorageSchemaParityBy235: true,
      actionGovernancePipelineBy174To180: true,
      nativeIntegrationRegistryBy187: true,
      testTargetRequiredForFutureSend: true,
      approvalRequiredForFutureSend: true,
      dryRunRequiredBeforeFutureSend: true,
      runtimeExternalExecutorRequiredForNativeReadyPaths: false,
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
    });
  });

  it('keeps provider/tool/command execution, ExternalExecutor mutation, source copy, adapter removal, raw content, and raw secrets blocked', () => {
    const plan = createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture();
    const serialized = JSON.stringify(plan.normalization);

    expect(plan.normalization.executionGate).toEqual({
      wave4dTestTargetProvisioningPlanCreated: true,
      realMessageSendActuallyPerformed: false,
      transportActuallyOpened: false,
      testTargetRequiredForFutureSend: true,
      approvalRequiredForFutureSend: true,
      dryRunRequiredBeforeFutureSend: true,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      rawContentUsageAllowed: false,
      rawSecretSerialized: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
    });
    expect(plan.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    assertNoRawSecretOrContent(serialized);
  });

  it('blocks the plan when real send, transport open, execution, mutation, migration, adapter removal, or raw secret paths are attempted', () => {
    const plan = createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture({
      realMessageSendAttempted: true,
      transportOpenAttempted: true,
      providerExecutionAttempted: true,
      toolCommandExecutionAttempted: true,
      externalExecutorMutationAttempted: true,
      newStateMigrationAttempted: true,
      sourceModuleCopyAttempted: true,
      adapterRemovalAttempted: true,
      publicExternalExecutorIdentityExposed: true,
      rawSecretSerialized: true,
    });

    expect(plan.normalization.decision).toBe('blocked');
    expect(plan.normalization.executionGate.realMessageSendActuallyPerformed).toBe(false);
    expect(plan.normalization.executionGate.transportActuallyOpened).toBe(false);
    expect(plan.normalization.executionGate.providerRealExecutionAllowed).toBe(false);
    expect(plan.normalization.executionGate.toolCommandRealExecutionAllowed).toBe(false);
    expect(plan.normalization.executionGate.externalExecutorMutationAllowed).toBe(false);
    expect(plan.normalization.executionGate.sourceModuleCopied).toBe(false);
    expect(plan.normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
  });
});
