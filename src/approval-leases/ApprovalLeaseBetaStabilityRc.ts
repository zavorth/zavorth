/**
 * ApprovalLeaseBetaStabilityRc.ts
 *
 * Implements a safe local utility for evaluating extension lease beta stability RC.
 */

import { BetaContinuationRecord } from './ApprovalLeaseBetaContinuation.js';
import { sanitizeLeaseFeedback } from './shared/redactionPatterns.js';

export interface BetaStabilityRcRecord {
  rcId: string;
  verdict: 'READY_FOR_EXTENSION_LEASE_BETA_CLOSEOUT_GO_NO_GO' | 'NO_GO_EXTENSION_LEASE_BETA_STABILITY_RC_BLOCKED';
  sanitizedRcSummary: string;
  createdAt: string;
}

export interface BetaStabilityRcOptions {
  idFactory?: () => string;
  now?: () => Date;
}

export class ApprovalLeaseBetaStabilityRc {
  public static evaluateRc(
    continuationRecord: BetaContinuationRecord,
    overrides: Partial<BetaStabilityRcRecord> = {},
    options: BetaStabilityRcOptions = {}
  ): BetaStabilityRcRecord {
    const verdict = continuationRecord.verdict === 'READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC'
      ? 'READY_FOR_EXTENSION_LEASE_BETA_CLOSEOUT_GO_NO_GO'
      : 'NO_GO_EXTENSION_LEASE_BETA_STABILITY_RC_BLOCKED';

    const sanitizedRcSummary = this.sanitizeText(
      overrides.sanitizedRcSummary || `Stability RC evaluation: ${continuationRecord.verdict}. Issues count: ${continuationRecord.trackedIssuesCount}`
    );

    const record: BetaStabilityRcRecord = {
      rcId: overrides.rcId || options.idFactory?.() || `rc-${Math.random().toString(36).substr(2, 9)}`,
      verdict,
      sanitizedRcSummary,
      createdAt: overrides.createdAt || (options.now?.() || new Date()).toISOString()
    };

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
        throw new Error(`Security Violation: Forbidden field "${key}" detected in RC record.`);
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
        throw new Error(`Security Violation: RC record contains forbidden token pattern "${pattern}"`);
      }
    }

    if (/[a-zA-Z]:\\Users\\/i.test(serialize) || /\/home\/[\w.-]+\//i.test(serialize)) {
      throw new Error(`Security Violation: RC record contains private filesystem paths.`);
    }
  }
}
