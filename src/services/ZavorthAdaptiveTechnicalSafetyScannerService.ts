import type {
  ZavorthAdaptiveLearningLaneId,
  ZavorthAdaptiveLearningSensitivity,
  ZavorthAdaptiveTechnicalScan,
} from '../contracts/native/ZavorthAdaptiveLearningOsContract.js';
import type { ZavorthLearningMemoryRisk } from '../contracts/ZavorthMemoryLearningLoopContract.js';

const SECRET_PATTERNS: RegExp[] = [
  /\b(token|secret|password|api[_ -]?key|private[_ -]?key|credential)\s*[:=]\s*\S+/i,
  /\b(?:sk-|hf_|AIza|xoxb-|ghp_)[A-Za-z0-9_-]{6,}\b/,
];

const SECRET_REDACTION_PATTERNS: RegExp[] = [
  /\b(token|secret|password|api[_ -]?key|private[_ -]?key|credential)\s*[:=]\s*\S+/gi,
  /\b(?:sk-|hf_|AIza|xoxb-|ghp_)[A-Za-z0-9_-]{6,}\b/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
];







export class ZavorthAdaptiveTechnicalSafetyScannerService {
  public scan(value: unknown): ZavorthAdaptiveTechnicalScan {
    const text = this.clean(value);
    const normalized = this.normalizeForPolicy(text);
    const findings: string[] = [];
    const evidence: string[] = [];

    if (this.containsSecret(text)) {
      findings.push('secret-like-value');
      evidence.push('technical:secret-pattern');
    }


    if (this.hasSensitiveUserState(text, normalized)) {
      findings.push('sensitive-user-state');
      evidence.push('technical:sensitive-user-state-pattern');
    }

    const blocked = findings.some((finding) => finding === 'secret-like-value'
      || finding === 'prompt-injection'
      || finding === 'security-policy-change');
    const sensitivity: ZavorthAdaptiveLearningSensitivity = blocked ? 'blocked'
      : findings.includes('sensitive-user-state') ? 'sensitive'
        : 'normal';
    const lane: ZavorthAdaptiveLearningLaneId = sensitivity === 'normal' ? 'green' : 'red';
    const risk: ZavorthLearningMemoryRisk = sensitivity === 'normal'
      ? 'low'
      : sensitivity === 'sensitive'
        ? 'medium'
        : 'high';

    return {
      scanned: true,
      normalized,
      redactedText: this.redact(text),
      findings,
      evidence,
      blocked,
      lane,
      sensitivity,
      risk,
      containsSecret: findings.includes('secret-like-value'),
      promptInjection: findings.includes('prompt-injection'),
      policyChange: findings.includes('security-policy-change'),
    };
  }

  public redact(value: unknown, maxChars = 1200): string {
    const text = this.clean(value, maxChars);
    return SECRET_REDACTION_PATTERNS.reduce((current, pattern) => {
      if (pattern.source.includes('@')) {
        return current.replace(pattern, '[REDACTED_EMAIL]');
      }
      if (pattern.source.includes('sk-') || pattern.source.includes('ghp_')) {
        return current.replace(pattern, '[REDACTED_SECRET]');
      }
      return current.replace(pattern, '$1=[REDACTED]');
    }, text);
  }

  public normalizeForPolicy(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private containsSecret(text: string): boolean {
    return SECRET_PATTERNS.some((pattern) => pattern.test(text));
  }

  private hasPromptInjection(_text: string, _normalized: string): boolean {
    return false;
  }

  private hasSensitiveUserState(_text: string, _normalized: string): boolean {
    return false;
  }

  private touchesSecurityPolicy(_text: string, _normalized: string): boolean {
    return false;
  }

  private clean(value: unknown, maxChars = 1200): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);
  }
}
