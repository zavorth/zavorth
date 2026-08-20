/**
 * ApprovalLeaseFeedbackFixSelection.ts
 *
 * Implements a safe local fix-selection gate utility.
 */

import { FeedbackTriageRecord } from './ApprovalLeaseFeedbackTriage.js';
import { sanitizeLeaseFeedback } from './shared/redactionPatterns.js';

export interface FeedbackFixSelectionRecord {
  selectionId: string;
  triageId: string;
  scenarioId: string;
  extensionFixtureName: string;
  riskClass: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'info';
  followUpCategory: string;
  safeFailureReasonCode: string;
  recommendedAction:
    | 'block_rollout'
    | 'investigate_before_rollout'
    | 'queue_beta_fix'
    | 'update_guidance'
    | 'track_observation'
    | 'no_action';
  selectedForFix: boolean;
  selectionReason: string;
  fixPriority: 'must_fix_before_beta_continue' | 'should_fix_in_beta' | 'can_defer' | 'observation_only';
  sanitizedSummary: string;
  blocksNextBetaCycle: boolean;
  createdAt: string;
  monotonicSequence: number;
}

export class ApprovalLeaseFeedbackFixSelection {
  private static sequenceCounter = 0;

  public static createFixSelectionRecord(
    triageRecord: FeedbackTriageRecord,
    overrides: Partial<FeedbackFixSelectionRecord> = {}
  ): FeedbackFixSelectionRecord {
    // Determine priority
    let fixPriority: FeedbackFixSelectionRecord['fixPriority'] = 'observation_only';
    if (triageRecord.severity === 'P0' || triageRecord.severity === 'P1') {
      fixPriority = 'must_fix_before_beta_continue';
    } else if (triageRecord.severity === 'P2') {
      fixPriority = 'should_fix_in_beta';
    } else if (triageRecord.severity === 'P3') {
      fixPriority = 'can_defer';
    } else {
      fixPriority = 'observation_only';
    }

    if (overrides.fixPriority) {
      fixPriority = overrides.fixPriority;
    }

    // Validate priority
    const validPriorities = ['must_fix_before_beta_continue', 'should_fix_in_beta', 'can_defer', 'observation_only'];
    if (!validPriorities.includes(fixPriority)) {
      throw new Error(`Invalid fix priority: ${fixPriority}`);
    }

    // Validate recommendedAction
    const recommendedAction = overrides.recommendedAction || triageRecord.recommendedAction;
    const validActions = [
      'block_rollout',
      'investigate_before_rollout',
      'queue_beta_fix',
      'update_guidance',
      'track_observation',
      'no_action'
    ];
    if (!validActions.includes(recommendedAction)) {
      throw new Error(`Invalid recommended action: ${recommendedAction}`);
    }

    // Validate severity
    const severity = overrides.severity || triageRecord.severity;
    const validSeverities = ['P0', 'P1', 'P2', 'P3', 'info'];
    if (!validSeverities.includes(severity)) {
      throw new Error(`Invalid severity: ${severity}`);
    }

    // Determine properties
    const blocksNextBetaCycle = fixPriority === 'must_fix_before_beta_continue';
    const selectedForFix = fixPriority === 'must_fix_before_beta_continue' || fixPriority === 'should_fix_in_beta';

    const selectionReason = this.sanitizeText(overrides.selectionReason || `Fix selection for triage ${triageRecord.triageId}`);
    const sanitizedSummary = this.sanitizeText(overrides.sanitizedSummary || triageRecord.sanitizedSummary);

    this.sequenceCounter++;

    const record: FeedbackFixSelectionRecord = {
      selectionId: overrides.selectionId || `select-${Math.random().toString(36).substr(2, 9)}`,
      triageId: triageRecord.triageId,
      scenarioId: triageRecord.scenarioId,
      extensionFixtureName: triageRecord.extensionFixtureName,
      riskClass: triageRecord.riskClass,
      severity,
      followUpCategory: overrides.followUpCategory || triageRecord.followUpCategory,
      safeFailureReasonCode: triageRecord.safeFailureReasonCode,
      recommendedAction: recommendedAction as any,
      selectedForFix,
      selectionReason,
      fixPriority,
      sanitizedSummary,
      blocksNextBetaCycle,
      createdAt: overrides.createdAt || new Date().toISOString(),
      monotonicSequence: overrides.monotonicSequence !== undefined ? overrides.monotonicSequence : this.sequenceCounter
    };

    // Verify record safety to prevent leak/bypass/unauthorised markers
    this.verifyRecordSafety(record);

    return record;
  }

  public static sanitizeText(text: string): string {
    return sanitizeLeaseFeedback(text);
  }

  private static verifyRecordSafety(record: Record<string, unknown>): void {
    const forbiddenKeys = [
      'rawPrompt',
      'providerResponse',
      'authorization',
      'Authorization',
      'Bearer',
      'secretRef',
      'apiKey',
      'rawKey',
      'ciphertext',
      'authTag',
      'handlerSource',
      'env',
      'process.env',
      'privateKey',
      'toolExecutionPayload',
      'providerPayload'
    ];

    for (const key of forbiddenKeys) {
      if (key in record) {
        throw new Error(`Security Violation: Forbidden field "${key}" detected in fix selection record.`);
      }
    }

    const forbiddenPatterns = [
      'Bearer',
      'secretRef',
      'rawKey',
      'ciphertext',
      'authTag',
      'Authorization',
      'rawPrompt',
      'providerResponse',
      'BEGIN PRIVATE KEY',
      'process.env'
    ];

    const serialize = JSON.stringify(record);
    for (const pattern of forbiddenPatterns) {
      if (serialize.includes(pattern)) {
        throw new Error(`Security Violation: Fix selection record contains forbidden token pattern "${pattern}"`);
      }
    }

    if (/[a-zA-Z]:\\Users\\/i.test(serialize) || /\/home\/[\w.-]+\//i.test(serialize)) {
      throw new Error(`Security Violation: Fix selection record contains private filesystem paths.`);
    }
  }

  public static getVerdict(records: FeedbackFixSelectionRecord[]): string {
    const hasBlockingMustFix = records.some(r => r.blocksNextBetaCycle && r.fixPriority === 'must_fix_before_beta_continue');
    if (hasBlockingMustFix) {
      return 'READY_FOR_EXTENSION_LEASE_BETA_FIX_IMPLEMENTATION';
    }

    const hasAnyFixSelected = records.some(r => r.selectedForFix);
    if (hasAnyFixSelected) {
      return 'READY_FOR_EXTENSION_LEASE_BETA_FIX_IMPLEMENTATION';
    }

    return 'READY_FOR_EXTENSION_LEASE_BETA_CONTINUATION_WITH_NO_BLOCKING_FIXES';
  }
}
