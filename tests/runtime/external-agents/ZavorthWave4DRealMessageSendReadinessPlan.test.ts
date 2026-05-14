import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthWave4DRealMessageSendReadinessPlanFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4DRealMessageSendBlockerId,
  ZavorthWave4DRealMessageSendRequirementId,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/234-wave-4d-real-message-send-readiness-plan.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/233-wave-4b3-message-send-dry-run-executables-milestone-report.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport.test.ts';
const NEXT_DOC = 'docs/235-wave-4c3-session-storage-schema-parity-absorption-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4DRealMessageSendReadinessPlan.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const REQUIREMENTS: ZavorthWave4DRealMessageSendRequirementId[] = [
  'target-safe-test',
  'channel-transport-configured',
  'secretref-secure-resolver',
  'policy-preflight',
  'approval-grant-real',
  'idempotency-key',
  'rollback-compensation-recall',
  'audit-receipt',
  'rate-limit',
  'dry-run-before-live',
  'content-redacted-approved',
  'no-raw-content-leakage',
  'execution-dependency-classification',
];

const DEFAULT_BLOCKERS: ZavorthWave4DRealMessageSendBlockerId[] = [
  'channel-transport-not-configured',
  'missing-approval-grant',
  'missing-rollback-compensation',
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

describe('Wave 4D real message send readiness plan', () => {
  it('documents 234 as a readiness-only plan for future controlled real message send', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4d-real-message-send-readiness-plan-ready`');
    expect(content).toContain('ZavorthWave4DRealMessageSendReadinessPlan.ts');
    expect(content).toContain('ZavorthWave4DRealMessageSendReadinessPlan/v1');
    expect(content).toContain('ZavorthWave4DRealMessageSendRequirement/v1');
    expect(content).toContain('ZavorthWave4DRealMessageSendGoNoGoCriterion/v1');
    expect(content).toContain('ZavorthWave4DRealMessageSendCandidate/v1');
    expect(content).toContain('wave4dRealMessageSendReadinessPlanCreated=true');
    expect(content).toContain('realMessageSendActuallyPerformed=false');
    expect(content).toContain('transportActuallyOpened=false');
    expect(content).toContain('approvalRequiredForFutureSend=true');
    expect(content).toContain('dryRunRequiredBeforeFutureSend=true');
    REQUIREMENTS.forEach((requirement) => expect(content).toContain(requirement));
    expect(content).toContain('Wave 4C.3 Schema Parity Handoff');
    expect(content).toContain(NEXT_DOC);
    expect(content).toContain('Do not advance beyond `235`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 233 handoff for 234', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`234` opens Wave 4D');
    expect(read(PRIOR_DOC)).toContain('Wave 4D real message send readiness follow-up:');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `234`');
    expect(read(PRIOR_TEST)).toContain(DOC);
  });

  it('exports the Wave 4D readiness boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4DRealMessageSendReadinessPlan/v1');
    expect(boundary).toContain('ZavorthWave4DRealMessageSendRequirement/v1');
    expect(boundary).toContain('ZavorthWave4DRealMessageSendCandidate/v1');
    expect(boundary).toContain('ZavorthWave4DRealMessageSendReadinessGate');
    expect(index).toContain("from './ZavorthWave4DRealMessageSendReadinessPlan.js'");
    expect(index).toContain('ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_READINESS_PLAN_RUNTIME_ID');
  });

  it('lists every required prerequisite for a future real send', () => {
    const plan = createZavorthWave4DRealMessageSendReadinessPlanFixture();

    expect(plan.normalization.decision).toBe('wave4d-real-message-send-readiness-plan-ready');
    expect(plan.requirementIds()).toEqual(REQUIREMENTS);
    plan.normalization.requirements.forEach((requirement) => {
      expect(requirement).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4DRealMessageSendRequirement/v1',
        requiredForFutureSend: true,
        blocksFutureSendIfMissing: true,
        rawSecretSerialized: false,
        rawContentUsageAllowed: false,
      }));
      expect(requirement.evidenceGates.length).toBeGreaterThan(0);
    });
  });

  it('prepares the first send candidate but never executes or opens transport', () => {
    const plan = createZavorthWave4DRealMessageSendReadinessPlanFixture();

    expect(plan.candidatePreparedNotExecuted()).toBe(true);
    expect(plan.normalization.firstSendCandidate).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4DRealMessageSendCandidate/v1',
      candidateId: 'wave4d-first-controlled-safe-test-message-candidate',
      candidateStatus: 'prepared-not-executed',
      targetClass: 'safe-test-target',
      secretRefResolutionRequired: true,
      rawSecretSerialized: false,
      contentPolicy: 'redacted-approved-only',
      rawContentUsageAllowed: false,
      approvalStatus: 'future-real-approval-required',
      dryRunRequiredBeforeFutureSend: true,
      dryRunEvidenceGates: ['231', '232'],
      rollbackCompensationPlanRequired: true,
      recallIfAvailableRequired: true,
      auditReceiptRequired: true,
      rateLimitRequired: true,
      externalTransportExecutionDependency: 'explicit-execution-dependency-not-default-runtime',
      externalExecutorDefaultRuntimeRequired: false,
      executionActuallyPerformed: false,
      messageActuallySent: false,
      transportActuallyOpened: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      externalExecutorMutationAllowed: false,
    }));
  });

  it('records go/no-go blockers for missing transport, approval, and rollback by default', () => {
    const plan = createZavorthWave4DRealMessageSendReadinessPlanFixture();

    expect(plan.goNoGoBlockerIds()).toEqual(DEFAULT_BLOCKERS);
    DEFAULT_BLOCKERS.forEach((blocker) => {
      expect(plan.normalization.goNoGoCriteria).toEqual(expect.arrayContaining([
        expect.objectContaining({
          decision: 'no-go-blocked',
          blockerId: blocker,
        }),
      ]));
    });
    expect(plan.normalization.goNoGoCriteria).toEqual(expect.arrayContaining([
      expect.objectContaining({ criterionId: 'dry-run-passed', satisfiedNow: true }),
      expect.objectContaining({ criterionId: 'secretref-present-redacted', satisfiedNow: true }),
      expect.objectContaining({ criterionId: 'content-redacted-approved', satisfiedNow: true }),
      expect.objectContaining({ criterionId: 'policy-accepted', satisfiedNow: true }),
    ]));
  });

  it('blocks go/no-go when target, transport, SecretRef, approval, policy, rollback, or raw content are missing', () => {
    const plan = createZavorthWave4DRealMessageSendReadinessPlanFixture({
      targetSafeForTest: false,
      channelTransportConfigured: false,
      secretRefsAvailableAsResolver: false,
      operatorApprovalGrantedNow: false,
      policyPreflightAccepted: false,
      rollbackCompensationPlanAvailable: false,
      rawContentRequired: true,
      contentRedactedApproved: false,
    });

    expect(plan.normalization.decision).toBe('blocked');
    expect(plan.goNoGoBlockerIds()).toEqual([
      'channel-transport-not-configured',
      'target-not-safe',
      'raw-content-required',
      'missing-secretref',
      'policy-rejected',
      'missing-approval-grant',
      'missing-rollback-compensation',
    ]);
    expect(plan.normalization.executionGate.realMessageSendActuallyPerformed).toBe(false);
    expect(plan.normalization.executionGate.transportActuallyOpened).toBe(false);
    expect(plan.normalization.executionGate.rawContentUsageAllowed).toBe(false);
  });

  it('keeps dry-run and future approval mandatory even when all other readiness criteria are satisfied', () => {
    const plan = createZavorthWave4DRealMessageSendReadinessPlanFixture({
      channelTransportConfigured: true,
      rollbackCompensationPlanAvailable: true,
      operatorApprovalGrantedNow: true,
    });

    expect(plan.normalization.decision).toBe('wave4d-real-message-send-readiness-plan-ready');
    expect(plan.goNoGoBlockerIds()).toEqual([]);
    expect(plan.normalization.firstSendCandidate.dryRunRequiredBeforeFutureSend).toBe(true);
    expect(plan.normalization.firstSendCandidate.approvalStatus).toBe('future-real-approval-required');
    expect(plan.normalization.executionGate.approvalRequiredForFutureSend).toBe(true);
    expect(plan.normalization.executionGate.dryRunRequiredBeforeFutureSend).toBe(true);
    expect(plan.normalization.executionGate.realMessageSendActuallyPerformed).toBe(false);
  });

  it('records evidence from 182/183/230-233/218-229/222-225/174-180/187/188', () => {
    const plan = createZavorthWave4DRealMessageSendReadinessPlanFixture();

    expect(plan.normalization.evidence).toEqual({
      nativeContract: 'ZavorthWave4DRealMessageSendReadinessEvidence/v1',
      messageSendTransportBlockedRehearsalBy182: true,
      transportCapabilityDiscoveryBy183: true,
      wave4b3DryRunExecutablesBy230To233: true,
      sessionHistoryMetadataAndRedactedContentBy218To229: true,
      wave4b2ValidationReadinessBy222To225: true,
      actionGovernancePipelineBy174To180: true,
      nativeIntegrationRegistryBy187: true,
      nativeSessionHistoryRegistryBy188: true,
      dryRunMandatoryBeforeLive: true,
      approvalRequiredForFutureSend: true,
      runtimeExternalExecutorRequiredForNativeReadyPaths: false,
      externalTransportIfNeededClassifiedAsExecutionDependency: true,
      rawMessageContentSerialized: false,
      rawSecretSerialized: false,
    });
  });

  it('keeps provider/tool/command execution, ExternalExecutor mutation, source copy, adapter removal, raw content, and raw secrets blocked', () => {
    const plan = createZavorthWave4DRealMessageSendReadinessPlanFixture();
    const serialized = JSON.stringify(plan.normalization);

    expect(plan.normalization.executionGate).toEqual({
      wave4dRealMessageSendReadinessPlanCreated: true,
      realMessageSendActuallyPerformed: false,
      transportActuallyOpened: false,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      rawContentUsageAllowed: false,
      approvalRequiredForFutureSend: true,
      dryRunRequiredBeforeFutureSend: true,
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

  it('blocks the plan when any prohibited execution path is attempted', () => {
    const plan = createZavorthWave4DRealMessageSendReadinessPlanFixture({
      newCapabilityExecutionAttempted: true,
      realMessageSendAttempted: true,
      transportOpenAttempted: true,
      providerExecutionAttempted: true,
      toolCommandExecutionAttempted: true,
      externalExecutorMutationAttempted: true,
      newStateMigrationAttempted: true,
      sourceModuleCopyAttempted: true,
      adapterRemovalAttempted: true,
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
