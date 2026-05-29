import crypto from 'crypto';

const WEAK_ZAVORTH_CONTROL_TOKEN_PATTERNS = [
  /^zavorth-access(?:-|$)/i,
  /^zavorth[_-]?access[_-]?\d{4}$/i,
  /^(changeme|change-me|password|token|dev-token|local-token)$/i,
];

export function generateZavorthControlToken(): string {
  return `bsk_cc_${crypto.randomBytes(32).toString('base64url')}`;
}

export function isWeakZavorthControlToken(token: unknown): boolean {
  const normalized = String(token || '').trim();
  if (!normalized) {
    return false;
  }
  return WEAK_ZAVORTH_CONTROL_TOKEN_PATTERNS.some((pattern) => pattern.test(normalized));
}
