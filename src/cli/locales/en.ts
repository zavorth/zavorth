/**
 * English-only first-token CLI command aliases.
 *
 * Only real synonyms (alias !== canonical). No identity no-ops (help→help).
 * Overlaps intentionally with SimpleCommandRouter short forms so both entry
 * points (normalizePublicCommandAliases + resolveZavorthSimpleCommand) agree.
 */
export const EN_COMMAND_ALIASES: Record<string, string> = {
  configure: 'setup',
  init: 'setup',
  health: 'ready',
  check: 'doctor',
  diagnose: 'doctor',
  talk: 'chat',
  converse: 'chat',
  panel: 'open',
  digest: 'learn',
  where: 'reach',
};
