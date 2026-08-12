/**
 * Sanitizes secrets in free-form text before persistence or display.
 *
 * Invariants:
 * - Never log raw secrets in receipts, memory, or metrics.
 * - Preserve key names in `key=value` pairs so operators can rotate specific entries.
 * - Redact only values that look credential-like; short strings stay visible for debugging.
 */

const SENSITIVE_KEY = /\b(?:api[_-]?key|token|secret|password|authorization|bearer|credential)\s*[:=]\s*/i;

const EXPLICIT_SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bhf_[A-Za-z0-9]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
];

const KEYED_SECRET_PATTERN = /\b(?:api[_-]?key|token|secret|password|authorization|bearer|credential)\s*[:=]\s*["']?([A-Za-z0-9_+/=.-]{8,})/gi;

export function redactSecrets(input: unknown): string {
  let text = String(input || '');

  for (const pattern of EXPLICIT_SECRET_PATTERNS) {
    text = text.replace(pattern, '[REDACTED_SECRET]');
  }

  text = text.replace(KEYED_SECRET_PATTERN, (match) => {
    const keyMatch = match.match(SENSITIVE_KEY);
    if (!keyMatch) {
      return '[REDACTED_SECRET]';
    }
    const value = match.slice(keyMatch[0].length);
    const unquoted = value.replace(/^["']|["']$/g, '');
    if (unquoted.length < 8) {
      return match;
    }
    return `${keyMatch[0]}[REDACTED_SECRET]`;
  });

  return text;
}
