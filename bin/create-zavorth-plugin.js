#!/usr/bin/env node
'use strict';

/**
 * Root convenience wrapper for create-zavorth-plugin.
 * Delegates to packages/create-zavorth-plugin (standalone scaffold CLI).
 */

const path = require('node:path');

const packageBin = path.resolve(
  __dirname,
  '..',
  'packages',
  'create-zavorth-plugin',
  'bin',
  'create-zavorth-plugin.js',
);

try {
  require(packageBin);
} catch (error) {
  console.error('create-zavorth-plugin: could not load package CLI.');
  console.error(`Expected: ${packageBin}`);
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Install or restore packages/create-zavorth-plugin, then retry.');
  process.exit(1);
}
