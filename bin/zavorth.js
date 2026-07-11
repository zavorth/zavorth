#!/usr/bin/env node
'use strict';

/**
 * Sole public product entry: `zavorth`.
 *
 *   zavorth                  → Code TUI (packages/code)
 *   zavorth <capability> …   → product capability layer (native / hybrid / delegated)
 *   zavorth __agent …        → internal agent runtime (maintainer only)
 *   ZAVORTH_LEGACY_CLI=1     → same maintainer hatch via env
 *
 * Single public bin on PATH. No second coding CLI.
 */

const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const userArgs = process.argv.slice(2);

const { resolveEntryMode } = require('./lib/resolve-zavorth-entry.cjs');
const resolved = resolveEntryMode(userArgs, process.env);

if (resolved.mode === 'agent' || resolved.mode === 'legacy') {
  const { launchAgentRuntime } = require('./lib/launch-agent-runtime.cjs');
  launchAgentRuntime(resolved.args, { projectRoot, env: process.env });
} else {
  const {
    resolveCapability,
    executeCapability,
  } = require('./lib/zavorth-capabilities.cjs');

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
