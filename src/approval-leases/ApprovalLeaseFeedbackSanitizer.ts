/**
 * ApprovalLeaseFeedbackSanitizer.ts
 *
 * Implements sanitization and schema verification for internal beta feedback records.
 */

import { sanitizeLeaseFeedback } from './shared/redactionPatterns.js';

export interface BetaTesterFeedback {
  scenarioId: string;
  extensionFixtureName: string;
  riskClass: string;
  leaseDecisionStatus: string;
  safeFailureReasonCode: string;
  timestamp: string;
  testerObservedOutcome: string;
  sanitizedNotes: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'info';
  reproducibility: string;
  followUpCategory: string;
}

export class ApprovalLeaseFeedbackSanitizer {
  /**
   * Sanitizes and validates a feedback record.
   * Rejects if it contains unredactable critical secrets or invalid severity/status.
   * Redacts sensitive patterns found in sanitizedNotes.
   */
  public static sanitizeFeedback(raw: Partial<BetaTesterFeedback>): BetaTesterFeedback {
    // 1. Validate mandatory fields
    if (!raw.scenarioId || raw.scenarioId.trim() === '') {
      throw new Error('scenarioId is required');
    }
    if (!raw.extensionFixtureName || raw.extensionFixtureName.trim() === '') {
      throw new Error('extensionFixtureName is required');
    }
    if (!raw.leaseDecisionStatus || raw.leaseDecisionStatus.trim() === '') {
      throw new Error('leaseDecisionStatus is required');
    }

    // 2. Validate severity
    const validSeverities = ['P0', 'P1', 'P2', 'P3', 'info'];
    if (!raw.severity || !validSeverities.includes(raw.severity)) {
      throw new Error(`Invalid severity: ${raw.severity}. Allowed: ${validSeverities.join(', ')}`);
    }

    // 3. Validate leaseDecisionStatus
    const validStatuses = ['lease_satisfied', 'lease_rejected', 'requires_approval', 'fail_closed', 'not_applicable'];
    if (!validStatuses.includes(raw.leaseDecisionStatus)) {
      throw new Error(`Invalid leaseDecisionStatus: ${raw.leaseDecisionStatus}`);
    }

    // 4. Sanitize Notes
    let notes = sanitizeLeaseFeedback(raw.sanitizedNotes || '');

    // Double check that no raw forbidden patterns escaped
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

    for (const pattern of forbiddenPatterns) {
      if (notes.includes(pattern)) {
        throw new Error(`Security Violation: Unredactable secret pattern "${pattern}" detected in feedback notes.`);
      }
    }

    return {
      scenarioId: raw.scenarioId,
      extensionFixtureName: raw.extensionFixtureName,
      riskClass: raw.riskClass || 'safe',
      leaseDecisionStatus: raw.leaseDecisionStatus,
      safeFailureReasonCode: raw.safeFailureReasonCode || 'SUCCESS',
      timestamp: raw.timestamp || new Date().toISOString(),
      testerObservedOutcome: raw.testerObservedOutcome || 'observed',
      sanitizedNotes: notes,
      severity: raw.severity,
      reproducibility: raw.reproducibility || 'always',
      followUpCategory: raw.followUpCategory || 'usability'
    };
  }
}
