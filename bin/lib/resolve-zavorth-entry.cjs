'use strict';

/**
 * Pure entry-mode resolver for the sole public `zavorth` CLI.
 *
 * Returns:
 *   { mode: 'tui' | 'legacy', args: string[] }
 *
 * Rules (argv = user args after node/script):
 * 1) ZAVORTH_AGENT_RUNTIME or ZAVORTH_LEGACY_CLI truthy → agent runtime (maintainer)
 * 2) first arg '__agent' → agent runtime with remaining args
 * 3) first arg 'code' → TUI with remaining args (compat strip)
 * 4) else → TUI with all user args
 *
 * Product commands (chat, memory, …) use the agent runtime *internally* via
 * capabilities — users never need this hatch for daily use.
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isTruthyEnv(value) {
  if (value == null) return false;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

/**
 * @param {string[]|undefined|null} argv
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>|undefined|null} env
 * @returns {{ mode: 'tui'|'agent', args: string[] }}
 */
function resolveEntryMode(argv, env) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const e = env && typeof env === 'object' ? env : {};

  if (isTruthyEnv(e.ZAVORTH_AGENT_RUNTIME) || isTruthyEnv(e.ZAVORTH_LEGACY_CLI)) {
    return { mode: 'agent', args };
  }

  const first = String(args[0] || '').toLowerCase();
  // Maintainer-only internal agent-runtime entry (not advertised).
  if (first === '__agent') {
    return { mode: 'agent', args: args.slice(1) };
  }
  if (first === 'code') {
    return { mode: 'tui', args: args.slice(1) };
  }
  return { mode: 'tui', args };
}

module.exports = {
  resolveEntryMode,
  isTruthyEnv,
};
