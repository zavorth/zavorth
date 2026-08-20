/**
 * ApprovalLeaseFeedbackTriage.ts
 *
 * Implements a safe local triage utility for extension lease beta feedback.
 */

import { BetaTesterFeedback } from './ApprovalLeaseFeedbackSanitizer.js';
import { sanitizeLeaseFeedback } from './shared/redactionPatterns.js';

export interface FeedbackTriageRecord {
  triageId: string;
  scenarioId: string;
  extensionFixtureName: string;
  riskClass: string;
  leaseDecisionStatus: string;
  safeFailureReasonCode: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'info';
  reproducibility: string;
  followUpCategory:
    | 'safety_blocker'
    | 'fail_closed_regression'
    | 'audit_safety'
    | 'drift_boundary'
    | 'revocation_expiration_boundary'
    | 'workspace_profile_boundary'
    | 'beta_usability'
    | 'tester_guidance'
    | 'test_coverage'
    | 'observation';
  sanitizedSummary: string;
  sanitizedNotes: string;
  blocksRollout: boolean;
  recommendedAction:
    | 'block_rollout'
    | 'investigate_before_rollout'
    | 'queue_beta_fix'
    | 'update_guidance'
    | 'track_observation'
    | 'no_action';
  createdAt: string;
  monotonicSequence: number;
}

export class ApprovalLeaseFeedbackTriage {
  private static sequenceCounter = 0;

  public static createTriageRecord(
    feedback: BetaTesterFeedback,
    overrides: Partial<FeedbackTriageRecord> = {}
  ): FeedbackTriageRecord {
    // 1. Validate severity
    const validSeverities = ['P0', 'P1', 'P2', 'P3', 'info'];
    const severity = overrides.severity || feedback.severity;
    if (!validSeverities.includes(severity)) {
      throw new Error(`Invalid severity: ${severity}`);
    }

    // 2. Validate category
    const validCategories = [
      'safety_blocker',
      'fail_closed_regression',
      'audit_safety',
      'drift_boundary',
      'revocation_expiration_boundary',
      'workspace_profile_boundary',
      'beta_usability',
      'tester_guidance',
      'test_coverage',
      'observation'
    ];
    let followUpCategory = overrides.followUpCategory || feedback.followUpCategory;
    if (followUpCategory === 'usability') {
      followUpCategory = 'beta_usability';
    }
    const finalCategory = followUpCategory || 'observation';
    if (!validCategories.includes(finalCategory)) {
      throw new Error(`Invalid category: ${finalCategory}`);
    }

    // 3. Validate recommended action
    const validActions = [
      'block_rollout',
      'investigate_before_rollout',
      'queue_beta_fix',
      'update_guidance',
      'track_observation',
      'no_action'
    ];
    const recommendedAction = overrides.recommendedAction || (severity === 'P0' || severity === 'P1' ? 'block_rollout' : 'queue_beta_fix');
    if (!validActions.includes(recommendedAction)) {
      throw new Error(`Invalid recommended action: ${recommendedAction}`);
    }

    // Determine blocksRollout
    const blocksRollout = severity === 'P0' || severity === 'P1' || recommendedAction === 'block_rollout';

    // 4. Sanitization and Safety Verification
    const sanitizedNotes = this.sanitizeText(overrides.sanitizedNotes || feedback.sanitizedNotes || '');
    const sanitizedSummary = this.sanitizeText(overrides.sanitizedSummary || `Sanitized triage for scenario ${feedback.scenarioId}`);

    this.sequenceCounter++;

    const record: FeedbackTriageRecord = {
      triageId: overrides.triageId || `triage-${Math.random().toString(36).substr(2, 9)}`,
      scenarioId: feedback.scenarioId,
      extensionFixtureName: feedback.extensionFixtureName,
      riskClass: feedback.riskClass,
      leaseDecisionStatus: feedback.leaseDecisionStatus,
      safeFailureReasonCode: feedback.safeFailureReasonCode,
      severity: severity as FeedbackTriageRecord['severity'],
      reproducibility: overrides.reproducibility || feedback.reproducibility || 'always',
      followUpCategory: finalCategory as FeedbackTriageRecord['followUpCategory'],
      sanitizedSummary,
      sanitizedNotes,
      blocksRollout,
      recommendedAction: recommendedAction as FeedbackTriageRecord['recommendedAction'],
      createdAt: overrides.createdAt || new Date().toISOString(),
      monotonicSequence: overrides.monotonicSequence !== undefined ? overrides.monotonicSequence : this.sequenceCounter
    };

    // Strict validation against forbidden fields/keys in the object itself
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
        throw new Error(`Security Violation: Forbidden field "${key}" detected in triage record.`);
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
        throw new Error(`Security Violation: Triage record contains forbidden token pattern "${pattern}"`);
      }
    }

    // Ensure it doesn't leak filesystem paths in stringified form
    if (/[a-zA-Z]:\\Users\\/i.test(serialize) || /\/home\/[\w.-]+\//i.test(serialize)) {
      throw new Error(`Security Violation: Triage record contains private filesystem paths.`);
    }
  }

  public static getVerdict(records: FeedbackTriageRecord[]): string {
    const hasBlocker = records.some(r => r.blocksRollout);
    if (hasBlocker) {
      return 'NO_GO_EXTENSION_LEASE_FEEDBACK_TRIAGE_BLOCKED';
    }
    return 'READY_FOR_EXTENSION_LEASE_BETA_FIX_SELECTION';
  }
}
