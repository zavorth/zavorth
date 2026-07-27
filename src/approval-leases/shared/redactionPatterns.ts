/**
 * Shared redaction regex patterns used across approval-lease sanitizeText methods.
 *
 * Each pattern targets a specific class of sensitive data:
 * - AUTH_BEARER: Authorization headers and Bearer tokens
 * - SECRET_KEY: Secret references, API keys, ciphertext, auth tags, private keys
 * - RAW_PROMPT: Raw prompt content and SQL queries
 * - PROVIDER_RESPONSE: Provider response bodies and JSON structures
 */

export const AUTH_BEARER_REDACT_REGEX = /(?:Authorization|Bearer)\s*[:\s]\s*\S+/gi;
export const SECRET_KEY_REDACT_REGEX = /(?:secretRef|apiKey|rawKey|ciphertext|authTag|privateKey)\s*[:\s=]\s*\S+/gi;
export const RAW_PROMPT_REDACT_REGEX = /(?:rawPrompt)\s*[:\s=]\s*[^.\n]+/gi;
export const PROVIDER_RESPONSE_REDACT_REGEX = /(?:providerResponse)\s*[:\s=]\s*[^.\n]+/gi;
