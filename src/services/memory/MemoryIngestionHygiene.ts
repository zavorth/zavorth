/**
 * Ingestion hygiene for memory persistence: strips skill/command scaffolding
 * and prompt machinery so stored memories contain what the operator meant,
 * not wrapper syntax, trust-boundary boilerplate, or role delimiters.
 */

const UNTRUSTED_WRAPPER_PATTERN = new RegExp(
  '<\\s*(?:untrusted_[a-z_]+|learned_preferences)(?:\\s[^>]*)?>[\\s\\S]*?<\\s*/\\s*(?:untrusted_[a-z_]+|learned_preferences)\\s*>',
  'gi',
);

const ROLE_DELIMITER_PATTERN = /\[SYSTEM\]|\[INST\]|<<SYS>>|<\|im_start\|>|<\|system\|>|<\|user\|>|<\|assistant\|>|<\/system>/gi;

const TRUST_BOUNDARY_LINE_PATTERN =
  /^\s*(?:TRUST_BOUNDARY:.*|RELEVANT MEMORIES RETRIEVED FROM LONG-TERM MEMORY:.*|PERSISTENT USER MEMORY:.*|Most relevant memories for this conversation:.*|Memorys recentes:.*|CONTEXTO DE WORKSPACE:.*|CONTEXTO DA CONVERSA ANTERIOR:.*)$/gim;

const LEADING_COMMAND_TOKEN_PATTERN = /^\s*(?:zavorth\s+)?\/[a-z0-9][a-z0-9._:-]*\s+/gim;

export function stripMemoryScaffolding(text: string): string {
  return String(text || '')
    .replace(UNTRUSTED_WRAPPER_PATTERN, ' ')
    .replace(ROLE_DELIMITER_PATTERN, ' ')
    .replace(TRUST_BOUNDARY_LINE_PATTERN, '')
    .replace(LEADING_COMMAND_TOKEN_PATTERN, '')
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
