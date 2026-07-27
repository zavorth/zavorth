import crypto from 'node:crypto';

export function stableId(prefix: string, parts: Array<string | number | boolean | null | undefined>): string {
  const hash = crypto
    .createHash('sha256')
    .update(parts.map((part) => String(part ?? '')).join('\u001f'))
    .digest('hex')
    .slice(0, 16);
  return `${prefix}-${hash}`;
}

export function redactSensitiveText(input: string | null | undefined): string {
  const text = String(input || '');
  return text
    .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/gi, '[REDACTED_SECRET]')
    .replace(/\bAIza[0-9A-Za-z\-_]{20,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b(?:token|api[_-]...key|secret|password|passwd|pwd|access[_-]...token|client[_-]...secret)\s*[:=]\s*[^\s,;]+/gi, (match) => {
      const sep = match.includes('=') ? '=' : ':';
      const [key] = match.split(/[:=]/);
      return `${key.trim()}${sep}[REDACTED_SECRET]`;
    })
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, '$1 [REDACTED_SECRET]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]');
}

export function addDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function containsRawSecret(value: unknown): boolean {
  return /\bsk-[A-Za-z0-9_-]{6,}\b|\b(?:token|api[_-]...key|secret|password|passwd|pwd)\s*=\s*[^\s,;]+/i
    .test(JSON.stringify(value));
}

export function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
