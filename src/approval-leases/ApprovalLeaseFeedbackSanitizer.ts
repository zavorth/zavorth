/**
 * ApprovalLeaseFeedbackSanitizer.ts
 *
 * Implements sanitization and schema verification for internal beta feedback records.
 */

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

export const REDACTION_TOKENS = {
  SECRET: '[REDACTED_SECRET]',
  AUTH: '[REDACTED_AUTH]',
  PROVIDER_RESPONSE: '[REDACTED_PROVIDER_RESPONSE]',
  PROMPT: '[REDACTED_PROMPT]',
  PATH: '[REDACTED_PATH]'
};

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
    let notes = raw.sanitizedNotes || '';

    // Authorization & Bearer check
    if (/Authorization|Bearer/i.test(notes)) {
      notes = notes.replace(/Authorization\s*:\s*\S+/gi, REDACTION_TOKENS.AUTH);
      notes = notes.replace(/Bearer\s+\S+/gi, REDACTION_TOKENS.AUTH);
      notes = notes.replace(/Authorization|Bearer/gi, REDACTION_TOKENS.AUTH);
    }

    // Secrets & Keys check
    if (/secretRef|apiKey|rawKey|ciphertext|authTag|BEGIN PRIVATE KEY|privateKey/i.test(notes)) {
      notes = notes.replace(/secretRef\s*:\s*\S+/gi, REDACTION_TOKENS.SECRET);
      notes = notes.replace(/apiKey\s*:\s*\S+/gi, REDACTION_TOKENS.SECRET);
      notes = notes.replace(/rawKey\s*:\s*\S+/gi, REDACTION_TOKENS.SECRET);
      notes = notes.replace(/ciphertext\s*:\s*\S+/gi, REDACTION_TOKENS.SECRET);
      notes = notes.replace(/authTag\s*:\s*\S+/gi, REDACTION_TOKENS.SECRET);
      notes = notes.replace(/BEGIN PRIVATE KEY|privateKey/gi, REDACTION_TOKENS.SECRET);
      notes = notes.replace(/secretRef|apiKey|rawKey|ciphertext|authTag/gi, REDACTION_TOKENS.SECRET);
    }

    // Raw prompts check
    if (/rawPrompt|select\s+.*\s+from|insert\s+into|delete\s+from|update\s+.*set/i.test(notes)) {
      notes = notes.replace(/rawPrompt\s*:\s*\S+/gi, REDACTION_TOKENS.PROMPT);
      notes = notes.replace(/select\s+.*\s+from|insert\s+into|delete\s+from|update\s+.*set/gi, REDACTION_TOKENS.PROMPT);
      notes = notes.replace(/rawPrompt/gi, REDACTION_TOKENS.PROMPT);
    }

    // Provider responses check
    if (/providerResponse|choices\s*:\s*\[|response\s*:\s*\{/i.test(notes)) {
      notes = notes.replace(/providerResponse\s*:\s*\S+/gi, REDACTION_TOKENS.PROVIDER_RESPONSE);
      notes = notes.replace(/choices\s*:\s*\[|response\s*:\s*\{/gi, REDACTION_TOKENS.PROVIDER_RESPONSE);
      notes = notes.replace(/providerResponse/gi, REDACTION_TOKENS.PROVIDER_RESPONSE);
    }

    // Handler source check
    if (/function\s*\(|=>|handlerSource/i.test(notes)) {
      notes = notes.replace(/function\s*\([\s\S]*?\)|=>|handlerSource/gi, REDACTION_TOKENS.SECRET);
    }

    // Filesystem path check
    if (/[a-zA-Z]:\\[\\\w\s.-]+|\/[\w\s.-]+\/[\w\s.-]+/i.test(notes)) {
      notes = notes.replace(/[a-zA-Z]:\\[\\\w\s.-]+|\/[\w\s.-]+\/[\w\s.-]+/gi, REDACTION_TOKENS.PATH);
    }

    // Process.env check
    if (/process\.env|env\s*:/i.test(notes)) {
      notes = notes.replace(/process\.env|env\s*:/gi, REDACTION_TOKENS.SECRET);
    }

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
