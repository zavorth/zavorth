import type { AgentToolCapability } from './AgentSecurityPolicyEngine.js';

export type SensitiveDataFinding = {
  path: string;
  kind:
    | 'sensitive-key'
    | 'secret-assignment'
    | 'private-key'
    | 'provider-token'
    | 'bearer-token'
    | 'cloud-access-key'
    | 'jwt-token'
    | 'credential-url';
  preview: string;
};

const SENSITIVE_KEY_PATTERN =
  /(?:api[_-]?key|apiKey|access[_-]?token|accessToken|auth[_-]?token|authToken|authorization|client[_-]?secret|clientSecret|credential|password|private[_-]?key|privateKey|refresh[_-]?token|refreshToken|secret|token)/i;

const SECRET_VALUE_PATTERNS: Array<{ kind: SensitiveDataFinding['kind']; pattern: RegExp }> = [
  { kind: 'private-key', pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/i },
  { kind: 'provider-token', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { kind: 'provider-token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { kind: 'provider-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { kind: 'provider-token', pattern: /\bAIza[A-Za-z0-9_-]{30,}\b/g },
  { kind: 'cloud-access-key', pattern: /\bA(?:KIA|SIA)[A-Z0-9]{16}\b/g },
  { kind: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi },
  { kind: 'jwt-token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { kind: 'credential-url', pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@\s/]+@[^/\s]+/gi },
  {
    kind: 'secret-assignment',
    pattern: /\b[A-Za-z0-9_.-]*(?:api[_ -]?key|token|secret|password|credential|client[_ -]?secret)\s*[:=]\s*['"]?[^,'"\s;]{8,}/gi,
  },
];

const SECRET_REF_PATTERN = /^secret-ref:[a-z0-9_.:/-]+$/i;
const REDACTED_PATTERN = /^\[?(?:redacted|redacted-secret|secret-redacted)\]?$/i;

const EXFILTRATION_CAPABILITIES = new Set<AgentToolCapability>([
  'configuration',
  'credential',
  'desktop',
  'external-send',
  'mcp',
  'network',
  'plugin',
  'shell',
  'skill',
  'webhook',
]);

export function requiresSensitiveDataEgressGuard(capabilities: AgentToolCapability[]): boolean {
  return capabilities.some((capability) => EXFILTRATION_CAPABILITIES.has(capability));
}

export function detectSensitiveData(value: unknown): SensitiveDataFinding[] {
  const findings: SensitiveDataFinding[] = [];
  detectSensitiveDataInternal(value, '$', findings, new WeakSet<object>());
  return findings;
}

export function redactSensitiveText(value: unknown): string {
  let text = String(value || '');
  for (const { pattern } of SECRET_VALUE_PATTERNS) {
    text = text.replace(pattern, '[redacted-secret]');
  }
  return text;
}

export function redactSensitiveData(value: unknown): unknown {
  return redactSensitiveDataInternal(value, new WeakSet<object>());
}

function detectSensitiveDataInternal(
  value: unknown,
  path: string,
  findings: SensitiveDataFinding[],
  seen: WeakSet<object>,
): void {
  if (typeof value === 'string') {
    if (isAllowedSecretReference(value)) {
      return;
    }
    for (const { kind, pattern } of SECRET_VALUE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(value)) {
        findings.push({ path, kind, preview: preview(value) });
      }
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry, index) => detectSensitiveDataInternal(entry, `${path}[${index}]`, findings, seen));
    return;
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const entryPath = `${path}.${key}`;
    if (SENSITIVE_KEY_PATTERN.test(key) && isSensitiveKeyValue(entry)) {
      findings.push({ path: entryPath, kind: 'sensitive-key', preview: preview(entry) });
      continue;
    }
    detectSensitiveDataInternal(entry, entryPath, findings, seen);
  }
}

function redactSensitiveDataInternal(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return isAllowedSecretReference(value) ? value : redactSensitiveText(value);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveDataInternal(entry, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key) && isSensitiveKeyValue(entry) ? '[redacted-secret]'
      : redactSensitiveDataInternal(entry, seen);
  }
  return output;
}

function isSensitiveKeyValue(value: unknown): boolean {
  if (typeof value !== 'string') {
    return value !== null && value !== undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 && !isAllowedSecretReference(normalized);
}

function isAllowedSecretReference(value: string): boolean {
  const normalized = String(value || '').trim();
  return SECRET_REF_PATTERN.test(normalized) || REDACTED_PATTERN.test(normalized);
}

function preview(value: unknown): string {
  const text = redactSensitiveText(String(value || '').replace(/\s+/g, ' ').trim());
  return text.length <= 100 ? text : `${text.slice(0, 97)}...`;
}
