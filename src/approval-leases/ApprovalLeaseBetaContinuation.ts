/**
 * ApprovalLeaseBetaContinuation.ts
 *
 * Implements a safe local utility for evaluating extension lease beta continuation stability.
 */

import { FeedbackTriageRecord } from './ApprovalLeaseFeedbackTriage.js';
import { FeedbackFixSelectionRecord } from './ApprovalLeaseFeedbackFixSelection.js';
import { sanitizeLeaseFeedback } from './shared/redactionPatterns.js';

export interface BetaContinuationRecord {
  continuationId: string;
  verdict: 'READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC' | 'NO_GO_EXTENSION_LEASE_BETA_CONTINUATION_BLOCKED';
  triageSummary: string;
  fixSelectionSummary: string;
  hasBlockingFeedback: boolean;
  hasBlockingFixes: boolean;
  trackedIssuesCount: number;
  createdAt: string;
}

export class ApprovalLeaseBetaContinuation {
  public static evaluateContinuation(
    triageRecords: FeedbackTriageRecord[],
    fixSelectionRecords: FeedbackFixSelectionRecord[]
  ): BetaContinuationRecord {
    const hasBlockingFeedback = triageRecords.some(r => r.blocksRollout);
    const hasBlockingFixes = fixSelectionRecords.some(r => r.blocksNextBetaCycle && r.fixPriority === 'must_fix_before_beta_continue');

    const hasP0P1Pending = triageRecords.some(r => r.severity === 'P0' || r.severity === 'P1');

    const verdict = (hasBlockingFeedback || hasBlockingFixes || hasP0P1Pending) ? 'NO_GO_EXTENSION_LEASE_BETA_CONTINUATION_BLOCKED'
      : 'READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC';

    const triageSummary = this.sanitizeText(`Continuation checked: ${triageRecords.length} triage records.`);
    const fixSelectionSummary = this.sanitizeText(`Continuation checked: ${fixSelectionRecords.length} selection records.`);

    const record: BetaContinuationRecord = {
      continuationId: `cont-${Math.random().toString(36).substr(2, 9)}`,
      verdict,
      triageSummary,
      fixSelectionSummary,
      hasBlockingFeedback,
      hasBlockingFixes,
      trackedIssuesCount: triageRecords.length,
      createdAt: new Date().toISOString()
    };

    this.verifyRecordSafety(record as unknown as Record<string, unknown>);

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
        throw new Error(`Security Violation: Forbidden field "${key}" detected in continuation record.`);
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
        throw new Error(`Security Violation: Continuation record contains forbidden token pattern "${pattern}"`);
      }
    }

    if (/[a-zA-Z]:\\Users\\/i.test(serialize) || /\/home\/[\w.-]+\//i.test(serialize)) {
      throw new Error(`Security Violation: Continuation record contains private filesystem paths.`);
    }
  }
}
