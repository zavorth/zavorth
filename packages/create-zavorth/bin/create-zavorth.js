#!/usr/bin/env node
'use strict';

const path = require('node:path');

const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(name);
}

function firstPositional() {
  return args.find((arg) => !arg.startsWith('-'));
}

function printHelp() {
  console.log(`Create Zavorth

Prepare a safe project bootstrap plan for Zavorth.

Usage:
  npm create zavorth@latest -- --help
  npm create zavorth@latest -- --dry-run [project-name]
  npm create zavorth@latest -- --dry-run --json [project-name]

Safe by default:
  - no files are written unless a future write-enabled gate allows it
  - no secrets are requested or stored
  - no runtime is started
  - no provider, tool, command, or transport is executed

Next after a real scaffold:
  npm install
  npm run setup
  npm run go
  npm run doctor
`);
}

function fail(message) {
  console.error([
    'Create Zavorth could not continue.',
    `Cause: ${message}`,
    'Next: run create-zavorth --help',
  ].join('\n'));
  process.exit(1);
}

if (hasFlag('--help') || hasFlag('-h')) {
  printHelp();
  process.exit(0);
}

const allowedFlags = new Set(['--dry-run', '--json']);
const unsupportedFlag = args.find((arg) => arg.startsWith('-') && !allowedFlags.has(arg));
if (unsupportedFlag) {
  fail(`unsupported option ${unsupportedFlag}`);
}

if (!hasFlag('--dry-run')) {
  fail('only --dry-run is enabled in this bootstrap package');
}

const projectName = firstPositional() || 'my-zavorth-app';
const targetDirectory = projectName;
const plan = {
  command: 'create-zavorth',
  mode: 'dry-run',
  packageName: 'create-zavorth',
  projectName,
  targetDirectory,
  filesToCreate: [
    'package.json',
    'README.md',
    '.env.example',
  ],
  commandsAfterCreate: [
    'npm install',
    'npm run setup',
    'npm run go',
    'npm run doctor',
  ],
  safety: {
    secretsWritten: false,
    runtimeStarted: false,
    providerExecuted: false,
    toolCommandExecuted: false,
    messageSent: false,
    npmPublishActuallyPerformed: false,
  },
};

if (hasFlag('--json')) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  console.log('Create Zavorth dry-run');
  console.log('');
  console.log(`Project: ${plan.projectName}`);
  console.log(`Target: ${plan.targetDirectory}`);
  console.log('');
  console.log('Files planned');
  console.log('  > package.json');
  console.log('  > README.md');
  console.log('  > .env.example');
  console.log('');
  console.log('Next after a real scaffold');
  for (const command of plan.commandsAfterCreate) {
    console.log(`  > ${command}`);
  }
  console.log('');
  console.log('Safety');
  console.log('  > no files were written');
  console.log('  > no runtime was started');
  console.log('  > no secrets were requested');
}
