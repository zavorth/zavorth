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
  console.log(`create-zavorth

Prepare a safe Zavorth project bootstrap plan.

Usage:
  create-zavorth --help
  create-zavorth --dry-run [project-name]
  create-zavorth --dry-run --json [project-name]

This bootstrap is intentionally safe:
  - no secrets are written
  - no runtime is started
  - no provider, tool, command, or transport is executed
  - no package is published

For the installed CLI path, use:
  zavorth setup
  zavorth go
  zavorth doctor
`);
}

function fail(message) {
  console.error(`create-zavorth: ${message}`);
  console.error('Run `create-zavorth --help` for the safe bootstrap options.');
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
  fail('only --dry-run is available in this package; project writes require a future explicit create-package gate.');
}

const projectName = firstPositional() || 'my-zavorth-app';
const targetDirectory = path.resolve(process.cwd(), projectName);
const plan = {
  command: 'create-zavorth',
  mode: 'dry-run',
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
  console.log('Zavorth bootstrap dry-run');
  console.log(`Project: ${plan.projectName}`);
  console.log(`Target: ${plan.targetDirectory}`);
  console.log('Files planned: package.json, README.md, .env.example');
  console.log('Next commands: npm install, npm run setup, npm run go, npm run doctor');
  console.log('No files were written. No runtime was started. No secrets were requested.');
}
