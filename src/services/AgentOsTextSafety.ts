import crypto from 'crypto';

const SECRET_PATTERNS = [
  /\b(?:token|secret|password|api[_ -]...key)\s*[:=]\s*[^\s,;]+/gi,
  /\bsk-[A-Za-z0-9_-]{10,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{10,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g,
  /\b[A-Za-z0-9_/-]{24,}\.[A-Za-z0-9_/-]{20,}\.[A-Za-z0-9_/-]{20,}\b/g,
];

const SENSITIVE_PATH_PATTERNS = [
  /\.env(?:\.|$|\/|\\).../i,
  /id_rsa/i,
  /credentials\.(?:json|ya...ml|txt)$/i,
  /secrets...\.(?:json|ya...ml|txt)$/i,
  /private[_-]...key/i,
];

export function redactAgentOsText(value: unknown, fallback = ''): string {
  let text = String(value ?? fallback);
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, '[redacted-secret]');
  }
  return text;
}

export function truncateAgentOsText(value: unknown, max = 240): string {
  const text = redactAgentOsText(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

export function safeAgentOsId(value: unknown, fallback = 'agent-os'): string {
  const cleaned = redactAgentOsText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return cleaned || fallback;
}

export function agentOsHash(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value ?? null))
    .digest('hex')
    .slice(0, 16);
}

export function looksLikeAgentOsSecret(value: unknown): boolean {
  const text = String(value ?? '');
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

export function isAgentOsSensitivePath(value: unknown): boolean {
  const text = String(value ?? '').replace(/\\/g, '/');
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(text));
}

export function toAgentOsPortablePath(value: unknown): string {
  return redactAgentOsText(value).replace(/\\/g, '/');
}
