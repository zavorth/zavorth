/**
 * Shared sensitive-path detection regex used across speculative autonomy modules.
 *
 * Matches file paths and values that look like secrets, credentials, or
 * authentication material — environment files, key pairs, token strings,
 * and OpenAI-style API keys.
 */

export const SENSITIVE_PATH_REGEX = /\b(?:\.env|id_rsa|credentials\.json|secrets?\.json|token|secret|password|api[_-]?key|sk-[a-z0-9_-]{12,})\b/i;

export function looksLikeSecret(value: string): boolean {
  return SENSITIVE_PATH_REGEX.test(value);
}
