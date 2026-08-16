'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Launch the internal agent runtime (`dist/zavorth-cli.js`).
 *
 * Used by:
 *  - product delegated capabilities (`zavorth chat`, `zavorth memory`, …)
 *  - maintainer hatch (`zavorth __agent …` / ZAVORTH_AGENT_RUNTIME=1)
 *
 * This is part of the product CLI surface under the single public bin `zavorth`.
 * It is not a second PATH product.
 *
 * @param {string[]} userArgs
 * @param {{
 *   projectRoot?: string,
 *   env?: NodeJS.ProcessEnv,
 *   cwd?: string,
 *   exit?: boolean,
 * }} [options]
 * @returns {import('node:child_process').SpawnSyncReturns<Buffer>|void}
 */
function launchAgentRuntime(userArgs, options) {
  const opts = options || {};
  const projectRoot = opts.projectRoot || path.resolve(__dirname, '..', '..');
  const mainJsPath = path.join(projectRoot, 'dist', 'cli', 'main.js');
  const legacyCliPath = path.join(projectRoot, 'dist', 'zavorth-cli.js');
  const cliPath = fs.existsSync(mainJsPath) ? mainJsPath : legacyCliPath;
  const cwd = opts.cwd || process.cwd();
  const baseEnv = opts.env || process.env;
  const shouldExit = opts.exit !== false;
  const args = Array.isArray(userArgs) ? userArgs : [];

  if (!fs.existsSync(cliPath)) {
    console.error(
      [
        'Zavorth agent runtime build not found.',
        '',
        'Cause: dist/zavorth-cli.js was not found.',
        'Some product commands (chat, memory, workflows, …) need this build.',
        '',
        'From a cloned repo:',
        '  npm install',
        '  npm run build',
        '',
        'Public entry remains: zavorth  (Code TUI + all product commands).',
      ].join('\n'),
    );
    if (shouldExit) process.exit(1);
    return;
  }

  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    env: {
      ...baseEnv,
      ZAVORTH_PUBLIC_CLI: '1',
      ZAVORTH_AGENT_RUNTIME: '1',
      // Compat for older agent code that still reads the previous name
      ZAVORTH_LEGACY_CLI: '1',
    },
    stdio: 'inherit',
    windowsHide: false,
  });

  if (result.error) {
    console.error(
      [
        'Zavorth could not start the agent runtime.',
        `Cause: ${result.error.message}`,
        'Next: run zavorth doctor',
      ].join('\n'),
    );
    if (shouldExit) process.exit(1);
    return result;
  }

  if (shouldExit) {
    process.exit(typeof result.status === 'number' ? result.status : 1);
  }
  return result;
}

/** @deprecated use launchAgentRuntime — kept for require() compatibility */
function launchLegacyCli(userArgs, options) {
  return launchAgentRuntime(userArgs, options);
}

module.exports = {
  launchAgentRuntime,
  launchLegacyCli,
};
