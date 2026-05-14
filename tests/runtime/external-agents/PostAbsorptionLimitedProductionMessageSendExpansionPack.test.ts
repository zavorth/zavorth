import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE_FLAG,
  createZavorthLimitedProductionMessageSendExpansionPackFixture,
  createZavorthLimitedProductionMessageSendSource,
  normalizeZavorthLimitedProductionMessageSendExpansionPack,
  createZavorthLimitedProductionMessageSendFeatureFlagGate,
  ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXPANSION_PACK_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthLimitedProductionMessageSendSource,
  ZavorthLimitedProductionPreLiveCheckId,
  ZavorthLimitedProductionMessageSendTargetClass,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/255-post-absorption-limited-production-message-send-expansion-pack.md';
const PRIOR_238 = 'docs/238-wave-4d-first-controlled-real-message-send.md';
const PRIOR_240 = 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md';
const DRY_RUN_231 = 'docs/231-wave-4b3-message-send-dry-run-executable.md';
const TEST_TARGET_236 = 'docs/236-wave-4d-real-message-send-test-target-provisioning-plan.md';
const FINAL_DRY_RUN_237 = 'docs/237-wave-4d-final-dry-run-against-approved-test-target.md';
const OPS_251 = 'docs/251-post-absorption-parallel-hardening-pack.md';
const BOUNDARY = 'src/runtime/external-agents/PostAbsorptionLimitedProductionMessageSendExpansionPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const TARGET_CLASSES: ZavorthLimitedProductionMessageSendTargetClass[] = [
  'sandbox-test',
  'limited-production-approved',
  'production-blocked',
  'unknown-blocked',
];

const REQUIRED_CHECKS: ZavorthLimitedProductionPreLiveCheckId[] = [
  'target-allowlist',
  'channel-allowlist',
  'transport-allowlist',
  'approval-grant',
  'rate-limit',
  'idempotency-key',
  'duplicate-prevention',
  'rollback-compensation',
  'audit-receipt',
  'dry-run-immediate-before-live',
  'policy-recheck',
  'secretref-secure-resolver',
  'content-redaction-approval',
  'target-session-channel-transport-validation',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(?<![A-Za-z])sk-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain('raw user message body that must never migrate');
  expect(serialized).not.toContain('unredacted private message fixture');
}

describe('Post-absorption limited production message send expansion pack', () => {
  let source: ZavorthLimitedProductionMessageSendSource;
  let pack: ReturnType<typeof createZavorthLimitedProductionMessageSendExpansionPackFixture>;

  beforeAll(() => {
    source = createZavorthLimitedProductionMessageSendSource();
    pack = createZavorthLimitedProductionMessageSendExpansionPackFixture();
  });

  it('documents 255 as a limited production message send policy boundary with no automatic send', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `limited-production-message-send-expansion-ready`');
    expect(content).toContain('PostAbsorptionLimitedProductionMessageSendExpansionPack.ts');
    expect(content).toContain('ZavorthLimitedProductionMessageSendExpansionPack/v1');
    expect(content).toContain('ZavorthLimitedProductionMessageSendFeatureFlagGate/v1');
    expect(content).toContain('ZavorthLimitedProductionTargetPolicy/v1');
    expect(content).toContain('ZavorthLimitedProductionPreLiveCheck/v1');
    expect(content).toContain('ZavorthLimitedProductionMessageSendReceipt/v1');
    expect(content).toContain(ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE_FLAG);
    expect(content).toContain('limitedProductionMessageSendExpansionPackCreated=true');
    expect(content).toContain('unrestrictedProductionSendAllowed=false');
    expect(content).toContain('limitedProductionSendRequiresExplicitApproval=true');
    expect(content).toContain('limitedProductionSendRequiresFeatureFlag=true');
    expect(content).toContain('dryRunRequiredBeforeLimitedProductionSend=true');
    expect(content).toContain('policyRecheckRequired=true');
    expect(content).toContain('idempotencyRequired=true');
    expect(content).toContain('messageActuallySent=false');
    expect(content).toContain('Do not advance to `256`');
    assertNoRawSecretOrContent(content);
  });

  it('uses Wave 4D and message dry-run evidence without relaxing unrestricted production', () => {
    const doc = read(DOC);

    [PRIOR_238, PRIOR_240, DRY_RUN_231, TEST_TARGET_236, FINAL_DRY_RUN_237, OPS_251].forEach((evidence) => {
      expect(doc).toContain(evidence);
    });
    expect(read(PRIOR_240)).toContain('unrestrictedProductionSendAllowed=false');
    expect(read(PRIOR_240)).toContain('limitedApprovedTargetPolicyPrepared=true');
    expect(read(PRIOR_238)).toContain('realMessageSendAllowedOnlyForApprovedTestTarget=true');
    expect(read(DRY_RUN_231)).toContain('realMessageSendAllowed=false');
  });

  it('exports the limited production send boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthLimitedProductionMessageSendExpansionPack/v1');
    expect(boundary).toContain('ZavorthLimitedProductionMessageSendFeatureFlagGate/v1');
    expect(boundary).toContain('ZavorthLimitedProductionTargetPolicy/v1');
    expect(boundary).toContain('ZavorthLimitedProductionPreLiveCheck/v1');
    expect(boundary).toContain('ZavorthLimitedProductionMessageSendReceipt/v1');
    expect(index).toContain("from './PostAbsorptionLimitedProductionMessageSendExpansionPack.js'");
    expect(index).toContain('ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXPANSION_PACK_RUNTIME_ID');
  });

  it('defaults to policy-only and does not send', () => {
    expect(pack.normalization.decision).toBe('limited-production-message-send-expansion-ready');
    expect(pack.normalization.receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthLimitedProductionMessageSendReceipt/v1',
      mode: 'policy-only',
      policyOnlyReceipt: true,
      liveLimitedSendEligible: false,
      messageActuallySent: false,
      transportActuallyOpened: false,
      unrestrictedProductionSendAllowed: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      rawContentUsageAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(pack.messageActuallySent()).toBe(false);
  });

  it('classifies targets and blocks unknown or production-blocked targets', () => {
    TARGET_CLASSES.forEach((targetClass) => {
      expect(pack.targetPolicy(targetClass)).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthLimitedProductionTargetPolicy/v1',
        targetClass,
        targetApprovalRequired: true,
        allowlistRequired: true,
        rateLimitRequired: true,
        idempotencyRequired: true,
        rollbackCompensationRequired: true,
        auditReceiptRequired: true,
        unrestrictedProductionSendAllowed: false,
        messageActuallySentByPolicy: false,
        rawSecretSerialized: false,
      }));
    });
    expect(pack.targetPolicy('limited-production-approved')?.allowedForLimitedProductionConsideration).toBe(true);
    expect(pack.targetPolicy('production-blocked')?.disposition).toBe('blocked-production');
    expect(pack.targetPolicy('unknown-blocked')?.disposition).toBe('blocked-unknown');

    ['production-blocked', 'unknown-blocked'].forEach((targetClass) => {
      const blocked = createZavorthLimitedProductionMessageSendExpansionPackFixture({
        requestedMode: 'live-limited-send',
        targetClass: targetClass as ZavorthLimitedProductionMessageSendTargetClass,
      }, true);
      expect(blocked.normalization.decision).toBe('live-limited-send-blocked-target');
      expect(blocked.messageActuallySent()).toBe(false);
    });
  });

  it('requires approval, allowlists, rate limit, dry-run, idempotency, and every pre-live check', () => {
    expect(pack.normalization.preLiveChecks.map((check) => check.checkId)).toEqual(REQUIRED_CHECKS);
    pack.normalization.preLiveChecks.forEach((check) => {
      expect(check.required).toBe(true);
      expect(check.blocksLiveSendWhenMissing).toBe(true);
      expect(check.satisfied).toBe(true);
      expect(check.rawSecretSerialized).toBe(false);
    });

    const missingApproval = createZavorthLimitedProductionMessageSendExpansionPackFixture({
      requestedMode: 'live-limited-send',
      explicitApprovalPresent: false,
    }, true);
    const missingRateLimit = createZavorthLimitedProductionMessageSendExpansionPackFixture({
      requestedMode: 'live-limited-send',
      rateLimitConfigured: false,
    }, true);
    const duplicate = createZavorthLimitedProductionMessageSendExpansionPackFixture({
      requestedMode: 'live-limited-send',
      idempotencyKeyAlreadyUsed: true,
    }, true);

    expect(missingApproval.normalization.decision).toBe('live-limited-send-blocked-prelive-check');
    expect(missingApproval.preLiveCheck('approval-grant')?.satisfied).toBe(false);
    expect(missingRateLimit.normalization.decision).toBe('live-limited-send-blocked-prelive-check');
    expect(missingRateLimit.preLiveCheck('rate-limit')?.satisfied).toBe(false);
    expect(duplicate.normalization.decision).toBe('live-limited-send-blocked-prelive-check');
    expect(duplicate.preLiveCheck('duplicate-prevention')?.satisfied).toBe(false);
  });

  it('blocks missing SecretRef, rejected policy, missing content approval, stale dry-run, and missing validation', () => {
    const cases: Array<[Partial<ZavorthLimitedProductionMessageSendSource>, ZavorthLimitedProductionPreLiveCheckId]> = [
      [{ secretRefResolverReady: false }, 'secretref-secure-resolver'],
      [{ policyRecheckAccepted: false }, 'policy-recheck'],
      [{ contentRedactedApproved: false }, 'content-redaction-approval'],
      [{ dryRunImmediatelyBeforeLiveReady: false }, 'dry-run-immediate-before-live'],
      [{ targetSessionChannelTransportValidated: false }, 'target-session-channel-transport-validation'],
      [{ targetAllowlisted: false }, 'target-allowlist'],
      [{ channelAllowlisted: false }, 'channel-allowlist'],
      [{ transportAllowlisted: false }, 'transport-allowlist'],
    ];

    cases.forEach(([override, checkId]) => {
      const blocked = createZavorthLimitedProductionMessageSendExpansionPackFixture({
        requestedMode: 'live-limited-send',
        ...override,
      }, true);

      expect(blocked.normalization.decision).toBe('live-limited-send-blocked-prelive-check');
      expect(blocked.preLiveCheck(checkId)?.satisfied).toBe(false);
      expect(blocked.messageActuallySent()).toBe(false);
    });
  });

  it('requires the feature flag before live-limited-send can become eligible', () => {
    const flagOff = createZavorthLimitedProductionMessageSendExpansionPackFixture({
      requestedMode: 'live-limited-send',
    }, false);
    const flagOn = createZavorthLimitedProductionMessageSendExpansionPackFixture({
      requestedMode: 'live-limited-send',
    }, true);

    expect(flagOff.normalization.decision).toBe('live-limited-send-blocked-feature-flag');
    expect(flagOff.normalization.receipt.featureFlag.enabled).toBe(false);
    expect(flagOff.liveSendEligible()).toBe(false);
    expect(flagOff.messageActuallySent()).toBe(false);
    expect(flagOn.normalization.decision).toBe('live-limited-send-eligible-no-automatic-send');
    expect(flagOn.liveSendEligible()).toBe(true);
    expect(flagOn.messageActuallySent()).toBe(false);
    expect(flagOn.normalization.receipt.transportActuallyOpened).toBe(false);
  });

  it('keeps provider/tool/command execution, raw content, source mutation, adapter removal, and secrets blocked', () => {
    const prohibitedCases: Array<keyof ZavorthLimitedProductionMessageSendSource> = [
      'unrestrictedProductionSendRequested',
      'rawContentUsageAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'externalExecutorMutationAttempted',
      'sourceModuleCopyAttempted',
      'adapterRemovalAttempted',
      'publicExternalExecutorIdentityExposed',
      'rawSecretSerialized',
    ];

    prohibitedCases.forEach((key) => {
      const normalization = normalizeZavorthLimitedProductionMessageSendExpansionPack({
        generatedAt: '2026-05-01T21:01:00.000Z',
        runtimeId: ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXPANSION_PACK_RUNTIME_ID,
        source: { ...source, requestedMode: 'live-limited-send', [key]: true } as unknown as ZavorthLimitedProductionMessageSendSource,
        featureFlag: createZavorthLimitedProductionMessageSendFeatureFlagGate(true),
      });

      expect(normalization.decision).toBe('live-limited-send-blocked-prohibited');
      expect(normalization.executionGate.unrestrictedProductionSendAllowed).toBe(false);
      expect(normalization.executionGate.rawContentUsageAllowed).toBe(false);
      expect(normalization.executionGate.providerRealExecutionAllowed).toBe(false);
      expect(normalization.executionGate.toolCommandRealExecutionAllowed).toBe(false);
      expect(normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
      expect(normalization.executionGate.messageActuallySent).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
    });
  });

  it('generates a redacted policy-only safety report and exact execution guarantees', () => {
    expect(pack.normalization.safetyReport).toEqual({
      nativeContract: 'ZavorthLimitedProductionMessageSendSafetyReport/v1',
      unrestrictedProductionStillBlocked: true,
      targetEnablementCriteria: REQUIRED_CHECKS,
      remainingBlockers: expect.arrayContaining([
        'unrestricted-production-send',
        'missing-feature-flag',
        'missing-pre-live-dry-run',
        'missing-policy-recheck',
        'missing-secretref-resolver',
        'missing-content-approval',
        'duplicate-idempotency-key',
        'provider-tool-command-execution',
      ]),
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.executionGate).toEqual({
      limitedProductionMessageSendExpansionPackCreated: true,
      unrestrictedProductionSendAllowed: false,
      limitedProductionSendRequiresExplicitApproval: true,
      limitedProductionSendRequiresFeatureFlag: true,
      dryRunRequiredBeforeLimitedProductionSend: true,
      policyRecheckRequired: true,
      idempotencyRequired: true,
      rawContentUsageAllowed: false,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      rawSecretSerialized: false,
      adapterRemovalGlobalAllowed: false,
      messageActuallySent: false,
    });
  });

  it('keeps serialized output redacted and free of raw secrets or raw content', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentSerialized: false,
      sourceIdentityPublic: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(pack.normalization.nextGateRecommended).toBe('post-absorption-release-monitoring-observability-polish-pack');
    assertNoRawSecretOrContent(serialized);
  });
});
