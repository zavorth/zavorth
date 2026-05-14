#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'dist', 'zavorth-cli.js');

if (!fs.existsSync(cliPath)) {
  console.error([
    'Zavorth could not start.',
    '',
    'Cause: dist/zavorth-cli.js was not found.',
    'This usually means the repo was not built yet, or the installed package is missing its build output.',
    '',
    'If you are running from a cloned repo:',
    '  npm install',
    '  npm run build',
    '  npm run setup',
    '  npm run go',
    '  npm run doctor',
    '',
    'If setup or go still fail:',
    '  npm run doctor',
    '',
    'If this happened through npx or a package install, reinstall Zavorth or report a package integrity issue.',
  ].join('\n'));
  process.exit(1);
}

const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ZAVORTH_PUBLIC_CLI: '1',
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error([
    'Zavorth could not start.',
    `Cause: ${result.error.message}`,
    'Next: run zavorth doctor',
  ].join('\n'));
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
