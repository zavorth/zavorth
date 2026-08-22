/**
 * Shared redaction regex patterns used across approval-lease sanitizeText methods.
 *
 * Each pattern targets a specific class of sensitive data:
 * - AUTH_BEARER: Authorization headers and Bearer tokens
 * - SECRET_KEY: Secret references, API keys, ciphertext, auth tags, private keys
 * - RAW_PROMPT: Raw prompt content and SQL queries
 * - PROVIDER_RESPONSE: Provider response bodies and JSON structures
 */

export const REDACTION_TOKENS = {
  PROMPT: '[REDACTED_PROMPT]',
  PROVIDER_RESPONSE: '[REDACTED_PROVIDER_RESPONSE]',
  AUTH: '[REDACTED_AUTH]',
  SECRET: '[REDACTED_SECRET]',
  PATH: '[REDACTED_PATH]',
  PAYLOAD: '[REDACTED_PAYLOAD]',
} as const;
export const SECRET_KEY_REDACT_REGEX = /(?:secretRef|apiKey|rawKey|ciphertext|authTag|privateKey)\s*[:\s=]\s*\S+/gi;
export const RAW_PROMPT_REDACT_REGEX = /(?:rawPrompt)\s*[:\s=]\s*[^.\n]+/gi;
export const PROVIDER_RESPONSE_REDACT_REGEX = /(?:providerResponse)\s*[:\s=]\s*[^.\n]+/gi;

/**
 * Consolidated sanitization for approval-lease feedback text.
 * Redacts authorization tokens, secrets, prompts, provider responses,
 * handler source, env vars, filesystem paths, and forbidden keyword patterns.
 */
export function sanitizeLeaseFeedback(text: string): string {
  let sanitized = text;

  // Remove private filesystem paths when avoidable (do this first to protect paths from other redactions)
  sanitized = sanitized.replace(/[a-zA-Z]:\\[\w\s.-]+|\/[\w\s.-]+(?:[/\\][\w\s.-]+)+/gi, '[REDACTED_PATH]');

  // Redact Authorization/Bearer patterns and their token values (up to punctuation or end)
  sanitized = sanitized.replace(/(?:Authorization|Bearer)\s*[:\s]\s*[^.,;\s]+(?:\s+[^.,;\s]+){0,3}/gi, '[REDACTED_AUTH]');

  // Redact secrets, keys, ciphertext, authTag and values following them
  sanitized = sanitized.replace(/(?:secretRef|apiKey|rawKey|ciphertext|authTag|privateKey)\s*[:\s=]\s*\S+/gi, '[REDACTED_SECRET]');

  // Redact rawPrompt and values/SQL queries
  sanitized = sanitized.replace(/(?:rawPrompt)\s*[:\s=]\s*[^.\n]+/gi, '[REDACTED_PROMPT]');
  sanitized = sanitized.replace(/select\s+.*\s+from|insert\s+into|delete\s+from|update\s+.*set/gi, '[REDACTED_PROMPT]');

  // Redact providerResponse and json/choices
  sanitized = sanitized.replace(/(?:providerResponse)\s*[:\s=]\s*[^.\n]+/gi, '[REDACTED_PROVIDER_RESPONSE]');
  sanitized = sanitized.replace(/choices\s*:\s*\[|response\s*:\s*\{/gi, '[REDACTED_PROVIDER_RESPONSE]');

  // Redact handler source / functions
  sanitized = sanitized.replace(/function\s*\([\s\S]*?\)|=>|handlerSource/gi, '[REDACTED_SECRET]');

  // Redact env / process.env
  sanitized = sanitized.replace(/process\.env\S*/gi, '[REDACTED_SECRET]');
  sanitized = sanitized.replace(/env\s*[:\s=]\s*\S+/gi, '[REDACTED_SECRET]');

  // General forbidden word replacements
  const patterns = [
    { regex: /Authorization/gi, replacement: '[REDACTED_AUTH]' },
    { regex: /Bearer/gi, replacement: '[REDACTED_AUTH]' },
    { regex: /secretRef/gi, replacement: '[REDACTED_SECRET]' },
    { regex: /apiKey/gi, replacement: '[REDACTED_SECRET]' },
    { regex: /rawKey/gi, replacement: '[REDACTED_SECRET]' },
    { regex: /ciphertext/gi, replacement: '[REDACTED_SECRET]' },
    { regex: /authTag/gi, replacement: '[REDACTED_SECRET]' },
    { regex: /BEGIN PRIVATE KEY/gi, replacement: '[REDACTED_SECRET]' },
    { regex: /privateKey/gi, replacement: '[REDACTED_SECRET]' },
    { regex: /rawPrompt/gi, replacement: '[REDACTED_PROMPT]' },
    { regex: /providerResponse/gi, replacement: '[REDACTED_PROVIDER_RESPONSE]' },
    { regex: /handlerSource/gi, replacement: '[REDACTED_SECRET]' },
    { regex: /process\.env/gi, replacement: '[REDACTED_SECRET]' },
    { regex: /toolExecutionPayload/gi, replacement: '[REDACTED_PAYLOAD]' },
    { regex: /providerPayload/gi, replacement: '[REDACTED_PAYLOAD]' }
  ];

  for (const p of patterns) {
    sanitized = sanitized.replace(p.regex, p.replacement);
  }

  // Redact secret token patterns (more specific to avoid false positives)
  sanitized = sanitized.replace(/\bsecret(?:Ref|Key|Token)?\b/gi, '[REDACTED_SECRET]');
  sanitized = sanitized.replace(/\btoken\b/gi, '[REDACTED_SECRET]');

  return sanitized;
}