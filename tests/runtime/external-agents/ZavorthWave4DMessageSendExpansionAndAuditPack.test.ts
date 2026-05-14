import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthWave4DMessageSendExpansionAndAuditPackFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4DMessageSendExpansionCriterionId,
  ZavorthWave4DMessageSendTargetClass,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/238-wave-4d-first-controlled-real-message-send.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4DFirstControlledRealMessageSend.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4DMessageSendExpansionAndAuditPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const TARGET_CLASSES: ZavorthWave4DMessageSendTargetClass[] = [
  'sandbox-test',
  'limited-approved',
  'production-blocked',
  'unknown-blocked',
];

const EXPANSION_CRITERIA: ZavorthWave4DMessageSendExpansionCriterionId[] = [
  'limited-approved-target-mark',
  'approval-grant-real',
  'dry-run-ready-for-live-approval',
  'idempotency-unused',
  'policy-recheck',
  'rate-limit',
  'rollback-compensation',
  'secretref-secure-resolver',
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

describe('Wave 4D message send expansion and audit pack', () => {
  it('documents 240 as a consolidation/expansion pack with no new send', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4d-message-send-expansion-and-audit-pack-ready`');
    expect(content).toContain('ZavorthWave4DMessageSendExpansionAndAuditPack.ts');
    expect(content).toContain('ZavorthWave4DMessageSendExpansionAndAuditPack/v1');
    expect(content).toContain('ZavorthWave4DMessageSendFirstControlledSendMilestone/v1');
    expect(content).toContain('messageSendExpansionPackCreated=true');
    expect(content).toContain('firstControlledSendMilestoneRecorded=true');
    expect(content).toContain('limitedApprovedTargetPolicyPrepared=true');
    expect(content).toContain('unrestrictedProductionSendAllowed=false');
    expect(content).toContain('newMessageActuallySentInThisPack=false');
    expect(content).toContain('provider-execution-absorption-pack');
    TARGET_CLASSES.forEach((targetClass) => expect(content).toContain(targetClass));
    EXPANSION_CRITERIA.forEach((criterion) => expect(content).toContain(criterion));
    assertNoRawSecretOrContent(content);
  });

  it('updates tracking docs and the 238 handoff for 240', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`240` consolidates Wave 4D message send');
    expect(read(PRIOR_DOC)).toContain('Expansion And Audit Pack Follow-Up');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `240`');
    expect(read(PRIOR_TEST)).toContain(DOC);
  });

  it('exports the expansion pack boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4DMessageSendExpansionAndAuditPack/v1');
    expect(boundary).toContain('ZavorthWave4DMessageSendTargetPolicy/v1');
    expect(boundary).toContain('ZavorthWave4DMessageSendExpansionCriterion/v1');
    expect(boundary).toContain('ZavorthWave4DMessageSendAuditHardening/v1');
    expect(index).toContain("from './ZavorthWave4DMessageSendExpansionAndAuditPack.js'");
    expect(index).toContain('ZAVORTH_WAVE4D_MESSAGE_SEND_EXPANSION_AND_AUDIT_PACK_RUNTIME_ID');
  });

  it('records the 238 milestone receipt, ack/status, idempotency, policy, approval, and cleanup', () => {
    const pack = createZavorthWave4DMessageSendExpansionAndAuditPackFixture();

    expect(pack.normalization.decision).toBe('wave4d-message-send-expansion-and-audit-pack-ready');
    expect(pack.normalization.firstControlledSendMilestone).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4DMessageSendFirstControlledSendMilestone/v1',
      sourceGate: '238',
      receiptDecision: 'live-send-ok',
      messageCount: 1,
      ackStatus: 'ack-recorded',
      policyRecheckAccepted: true,
      approvalGrantRealPresent: true,
      cleanupConfirmed: true,
      testHarnessSandboxEvidence: true,
      receiptRedacted: true,
      firstControlledSendMilestoneRecorded: true,
      newMessageActuallySentInThisPack: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.firstControlledSendMilestone.idempotencyKey).toContain('zavorth-wave4d-test-target-provisioning');
  });

  it('prepares target policy while blocking unrestricted production send', () => {
    const pack = createZavorthWave4DMessageSendExpansionAndAuditPackFixture();

    expect(pack.productionSendStillBlocked()).toBe(true);
    TARGET_CLASSES.forEach((targetClass) => {
      expect(pack.targetPolicy(targetClass)).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4DMessageSendTargetPolicy/v1',
        targetClass,
        futureSendAllowedByThisPack: false,
        approvalRequiredForFutureSend: true,
        dryRunRequiredForFutureSend: true,
        idempotencyRequired: true,
        unrestrictedProductionSendAllowed: false,
      }));
    });
    expect(pack.targetPolicy('limited-approved')?.policyDisposition).toBe('prepared-requires-future-explicit-gate');
    expect(pack.targetPolicy('production-blocked')?.policyDisposition).toBe('blocked-unrestricted-production');
    expect(pack.targetPolicy('unknown-blocked')?.policyDisposition).toBe('blocked-unknown');
  });

  it('defines expansion criteria and go/no-go requirements for limited-approved targets', () => {
    const pack = createZavorthWave4DMessageSendExpansionAndAuditPackFixture();

    expect(pack.normalization.expansionCriteria.map((criterion) => criterion.criterionId)).toEqual(EXPANSION_CRITERIA);
    pack.normalization.expansionCriteria.forEach((criterion) => {
      expect(criterion).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4DMessageSendExpansionCriterion/v1',
        requiredForLimitedApprovedTarget: true,
        rawSecretSerialized: false,
      }));
      expect(criterion.evidenceGates.length).toBeGreaterThan(0);
    });
    expect(pack.normalization.expansionCriteria).toEqual(expect.arrayContaining([
      expect.objectContaining({ criterionId: 'limited-approved-target-mark', goNoGo: 'no-go-without-future-gate' }),
      expect.objectContaining({ criterionId: 'approval-grant-real', goNoGo: 'go-for-future-pack-only' }),
    ]));
  });

  it('hardens audit receipts for redaction, ack/status, duplicates, degradation, cleanup, and provenance', () => {
    const pack = createZavorthWave4DMessageSendExpansionAndAuditPackFixture();

    expect(pack.normalization.auditHardening.map((item) => item.hardeningId)).toEqual([
      'redacted-receipts',
      'ack-status-recording',
      'duplicate-prevention',
      'degraded-failure-receipt',
      'transport-cleanup',
      'test-harness-provenance',
    ]);
    pack.normalization.auditHardening.forEach((item) => {
      expect(item.userFacingSecretSerialized).toBe(false);
      expect(item.rawContentSerialized).toBe(false);
      expect(item.evidence.length).toBeGreaterThan(0);
    });
  });

  it('recommends provider execution absorption while keeping provider/tool execution blocked', () => {
    const pack = createZavorthWave4DMessageSendExpansionAndAuditPackFixture();

    expect(pack.normalization.recommendation).toEqual({
      nativeContract: 'ZavorthWave4DMessageSendExpansionRecommendation/v1',
      nextDomain: 'provider-execution-absorption-pack',
      rationale: expect.any(String),
      messageSendProductionExpansionStillBlocked: true,
      providerRealExecutionAllowedByThisPack: false,
      toolCommandRealExecutionAllowedByThisPack: false,
    });
  });

  it('keeps expansion guarantees closed for production, raw content, provider/tool execution, secrets, adapter removal, and new sends', () => {
    const pack = createZavorthWave4DMessageSendExpansionAndAuditPackFixture();
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.executionGate).toEqual({
      messageSendExpansionPackCreated: true,
      firstControlledSendMilestoneRecorded: true,
      limitedApprovedTargetPolicyPrepared: true,
      unrestrictedProductionSendAllowed: false,
      approvalRequiredForFutureSend: true,
      dryRunRequiredForFutureSend: true,
      idempotencyRequired: true,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      rawContentUsageAllowed: false,
      rawSecretSerialized: false,
      adapterRemovalGlobalAllowed: false,
      newMessageActuallySentInThisPack: false,
    });
    expect(pack.newMessageSentInThisPack()).toBe(false);
    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentSerialized: false,
      sourceIdentityPublic: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    assertNoRawSecretOrContent(serialized);
  });

  it('blocks the pack if it attempts a new send, production expansion, provider/tool execution, raw content, mutation, adapter removal, or raw secrets', () => {
    const pack = createZavorthWave4DMessageSendExpansionAndAuditPackFixture({
      unrestrictedProductionSendRequested: true,
      newMessageSendAttemptedInThisPack: true,
      providerExecutionAttempted: true,
      toolCommandExecutionAttempted: true,
      rawContentUsageAttempted: true,
      externalExecutorMutationAttempted: true,
      sourceModuleCopyAttempted: true,
      adapterRemovalAttempted: true,
      rawSecretSerialized: true,
      publicExternalExecutorIdentityExposed: true,
    });

    expect(pack.normalization.decision).toBe('blocked');
    expect(pack.normalization.executionGate.unrestrictedProductionSendAllowed).toBe(false);
    expect(pack.normalization.executionGate.newMessageActuallySentInThisPack).toBe(false);
    expect(pack.normalization.executionGate.providerRealExecutionAllowed).toBe(false);
    expect(pack.normalization.executionGate.toolCommandRealExecutionAllowed).toBe(false);
    expect(pack.normalization.executionGate.rawSecretSerialized).toBe(false);
  });
});
