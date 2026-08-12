#!/usr/bin/env node
'use strict';

/**
 * Sole public product entry: `zavorth` (ZAVORTH_PUBLIC_CLI -> dist/zavorth-cli.js).
 *
 *   zavorth                  → product home (offline; no Code ensure)
 *   zavorth <capability> …   → product capability layer (native / hybrid / delegated)
 *   zavorth code …           → Code TUI (packages/code; may ensure binary)
 *   zavorth __agent …        → internal agent runtime (maintainer only)
 *   ZAVORTH_LEGACY_CLI=1     → same maintainer hatch via env
 *
 * Single public bin on PATH. No second coding CLI.
 */

const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const userArgs = process.argv.slice(2);

const {
  resolveCapability,
  executeCapability,
  printProductHelp,
  printProductVersion,
} = require('./lib/zavorth-capabilities.cjs');

/**
 * Offline first-contact: bare invoke, --help/-h/help, --version/-V
 * must never ensure/download Code TUI binaries.
 * @param {string[]} argv
 * @returns {'home'|'help'|'version'|null}
 */
function offlineFirstContact(argv) {
  const args = Array.isArray(argv) ? argv : [];
  if (args.length === 0) return 'home';
  const first = String(args[0] || '').trim().toLowerCase();
  if (first === '--version' || first === '-v' || first === '-V' || first === 'version') {
    return 'version';
  }
  if (first === '--help' || first === '-h' || first === 'help') return 'help';
  return null;
}

const firstContact = offlineFirstContact(userArgs);
if (firstContact === 'version') {
  process.exitCode = printProductVersion({ projectRoot, env: process.env });
} else if (firstContact === 'help' || firstContact === 'home') {
  process.exitCode = printProductHelp({
    projectRoot,
    env: process.env,
    kind: firstContact === 'home' ? 'home' : 'help',
  });
} else {
  const { resolveEntryMode } = require('./lib/resolve-zavorth-entry.cjs');
  const resolved = resolveEntryMode(userArgs, process.env);

  if (resolved.mode === 'agent' || resolved.mode === 'legacy') {
    const { launchAgentRuntime } = require('./lib/launch-agent-runtime.cjs');
    launchAgentRuntime(resolved.args, { projectRoot, env: process.env });
  } else {
    const cap = resolveCapability(resolved.args);
    if (cap.hit) {
      void executeCapability(cap.def, cap.rest, {
        projectRoot,
        env: process.env,
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Capability failed: ${msg}\n`);
        process.exit(1);
      });
    } else {
      const { launchCodeTui } = require('./lib/launch-code-tui.cjs');
      launchCodeTui(resolved.args, { projectRoot, env: process.env });
    }
  }
}
