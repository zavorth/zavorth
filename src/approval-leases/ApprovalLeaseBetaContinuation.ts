/**
 * ApprovalLeaseBetaContinuation.ts
 *
 * Implements a safe local utility for evaluating extension lease beta continuation stability.
 */

import { FeedbackTriageRecord } from './ApprovalLeaseFeedbackTriage.js';
import { FeedbackFixSelectionRecord } from './ApprovalLeaseFeedbackFixSelection.js';
import {
  AUTH_BEARER_REDACT_REGEX,
  SECRET_KEY_REDACT_REGEX,
  RAW_PROMPT_REDACT_REGEX,
  PROVIDER_RESPONSE_REDACT_REGEX,
} from './shared/redactionPatterns.js';

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

    this.verifyRecordSafety(record);

    return record;
  }

  public static sanitizeText(text: string): string {
    let sanitized = text;

    // Redact Authorization/Bearer patterns and whatever follows them
    sanitized = sanitized.replace(/(?:Authorization|Bearer)\s*[:\s]\s*\S+/gi, '[REDACTED_AUTH]');

    // Redact secrets, keys, ciphertext, authTag and values following them
    sanitized = sanitized.replace(/(?:secretRef|apiKey|rawKey|ciphertext|authTag|privateKey)\s*[:\s=]\s*\S+/gi, '[REDACTED_SECRET]');

    // Redact rawPrompt and values/SQL queries
    sanitized = sanitized.replace(/(?:rawPrompt)\s*[:\s=]\s*[^.\n]+/gi, '[REDACTED_PROMPT]');
    sanitized = sanitized.replace(/select\s+.*\s+from|insert\s+into|delete\s+from|update\s+.*set/gi, '[REDACTED_PROMPT]');

    // Redact providerResponse and json/choices
    sanitized = sanitized.replace(/(?:providerResponse)\s*[:\s=]\s*[^.\n]+/gi, '[REDACTED_PROVIDER_RESPONSE]');
    sanitized = sanitized.replace(/choices\s*:\s*\[|response\s*:\s*\{/gi, '[REDACTED_PROVIDER_RESPONSE]');

    // Redact handler source / functions
    sanitized = sanitized.replace(/function\s*\([\s\S]*?\)|=>|handlerSource/gi, '[REDACTED_SECRET]');

    // Redact env / process.env
    sanitized = sanitized.replace(/process\.env\S*/gi, '[REDACTED_SECRET]');
    sanitized = sanitized.replace(/env\s*[:\s=]\s*\S+/gi, '[REDACTED_SECRET]');

    // General forbidden word replacements
    const patterns = [
      { regex: /Authorization/gi, replacement: '[REDACTED_AUTH]' },
      { regex: /Bearer/gi, replacement: '[REDACTED_AUTH]' },
      { regex: /secretRef/gi, replacement: '[REDACTED_SECRET]' },
      { regex: /apiKey/gi, replacement: '[REDACTED_SECRET]' },
      { regex: /rawKey/gi, replacement: '[REDACTED_SECRET]' },
      { regex: /ciphertext/gi, replacement: '[REDACTED_SECRET]' },
      { regex: /authTag/gi, replacement: '[REDACTED_SECRET]' },
      { regex: /BEGIN PRIVATE KEY/gi, replacement: '[REDACTED_SECRET]' },
      { regex: /privateKey/gi, replacement: '[REDACTED_SECRET]' },
      { regex: /rawPrompt/gi, replacement: '[REDACTED_PROMPT]' },
      { regex: /providerResponse/gi, replacement: '[REDACTED_PROVIDER_RESPONSE]' },
      { regex: /handlerSource/gi, replacement: '[REDACTED_SECRET]' },
      { regex: /process\.env/gi, replacement: '[REDACTED_SECRET]' },
      { regex: /toolExecutionPayload/gi, replacement: '[REDACTED_PAYLOAD]' },
      { regex: /providerPayload/gi, replacement: '[REDACTED_PAYLOAD]' }
    ];

    for (const p of patterns) {
      sanitized = sanitized.replace(p.regex, p.replacement);
    }

    // Remove private filesystem paths when avoidable
    sanitized = sanitized.replace(/[a-zA-Z]:\\[\\\w\s.-]+|\/[\w\s.-]+\/[\w\s.-]+/gi, '[REDACTED_PATH]');

    // Redact secret token patterns
    sanitized = sanitized.replace(/\b\w*secret\w*\b/gi, '[REDACTED_SECRET]');
    sanitized = sanitized.replace(/\b\w*token\w*\b/gi, '[REDACTED_SECRET]');

    return sanitized;
  }

  private static verifyRecordSafety(record: any): void {
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
