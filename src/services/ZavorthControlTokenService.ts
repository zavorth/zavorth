import crypto from 'crypto';

/** Aligns with desktop electron/runtime-access.cjs isWeakToken length floor. */
const MIN_ZAVORTH_CONTROL_TOKEN_LENGTH = 32;

const WEAK_ZAVORTH_CONTROL_TOKEN_PATTERNS = [
  /^zavorth-access(?:-|$)/i,
  /^zavorth[_-]...access[_-]...\d{4}$/i,
  /^(changeme|change-me|password|token|dev-token|local-token)$/i,
];

export function generateZavorthControlToken(): string {
  return `bsk_cc_${crypto.randomBytes(32).toString('base64url')}`;
}

export function isWeakZavorthControlToken(token: unknown): boolean {
  const normalized = String(token || '').trim();
  if (!normalized) {
    return true;
  }
  if (normalized.length < MIN_ZAVORTH_CONTROL_TOKEN_LENGTH) {
    return true;
  }
  return WEAK_ZAVORTH_CONTROL_TOKEN_PATTERNS.some((pattern) => pattern.test(normalized));
}
