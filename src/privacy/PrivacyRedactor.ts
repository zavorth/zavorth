const REDACTED = '[redacted]';

const SENSITIVE_KEY_PATTERN =
  /(^|[_-])(api[_-]?key|token|secret|password|passwd|credential|authorization|cookie|session|jwt|client[_-]?secret|private[_-]?key)([_-]|$)/i;

const TEXT_REDACTIONS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}\b/gi, replacement: `$1${REDACTED}` },
  { pattern: /\b((?:api[_-]?key|token|secret|password|credential|authorization|cookie)\s*[:=]\s*)["']?[^"'\s,;]{8,}/gi, replacement: `$1${REDACTED}` },
  { pattern: /\b(sk|pk|api|key|token)[_-][A-Za-z0-9]{20,}\b/gi, replacement: REDACTED },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: REDACTED },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[email-redacted]' },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[ssn-redacted]' },
  { pattern: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, replacement: '[cpf-redacted]' },
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[card-redacted]' },
];

export type PrivacyRedactionOptions = {
  maxStringLength?: number;
  maxDepth?: number;
  maxArrayLength?: number;
};

export function redactPrivacyText(value: unknown, options: PrivacyRedactionOptions = {}): string {
  const maxStringLength = Math.max(32, options.maxStringLength || 2000);
  let text = String(value ?? '');
  for (const rule of TEXT_REDACTIONS) {
    text = text.replace(rule.pattern, rule.replacement);
  }
  text = text.replace(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g, '');
  return text.length > maxStringLength ? `${text.slice(0, maxStringLength - 3)}...` : text;
}

export function redactPrivacyValue<T = unknown>(value: T, options: PrivacyRedactionOptions = {}): T {
  const maxDepth = Math.max(1, options.maxDepth || 8);
  const maxArrayLength = Math.max(1, options.maxArrayLength || 100);
  const seen = new WeakSet<object>();

  function visit(input: unknown, depth: number, keyHint = ''): unknown {
    if (SENSITIVE_KEY_PATTERN.test(keyHint)) {
      return REDACTED;
    }
    if (typeof input === 'string') {
      return redactPrivacyText(input, options);
    }
    if (input == null || typeof input !== 'object') {
      return input;
    }
    if (depth <= 0) {
      return '[redacted-depth-limit]';
    }
    if (seen.has(input)) {
      return '[redacted-circular]';
    }
    seen.add(input);

    if (input instanceof Error) {
      return {
        name: input.name,
        message: redactPrivacyText(input.message, options),
      };
    }
    if (Array.isArray(input)) {
      return input.slice(0, maxArrayLength).map((entry) => visit(entry, depth - 1));
    }

    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(input as Record<string, unknown>)) {
      output[key] = visit(entry, depth - 1, key);
    }
    return output;
  }

  return visit(value, maxDepth) as T;
}
