#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(projectRoot, 'scripts', 'command-catalog.json');

const args = process.argv.slice(2);
const list = args.includes('--list');
const commandName = args.find((entry) => !entry.startsWith('--'));
const passthroughIndex = args.indexOf('--');
const passthroughArgs = passthroughIndex >= 0 ? args.slice(passthroughIndex + 1) : [];

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const commands = catalog.commands || {};

if (list || !commandName) {
  console.log('Zavorth command catalog');
  console.log('');
  console.log('usage: npm run command -- <nome> [-- args]');
  console.log('');
  for (const [name, entry] of Object.entries(commands)) {
    const status = entry.status || 'legacy';
    console.log(`${name.padEnd(34)} ${status.padEnd(12)} ${entry.description || entry.command}`);
  }
  process.exit(list ? 0 : 1);
}

const entry = commands[commandName];
if (!entry) {
  console.error(`[command] command not found in catalog: ${commandName}`);
  console.error('[command] use: npm run command:list');
  process.exit(1);
}

const command = passthroughArgs.length > 0
  ? `${entry.command} ${passthroughArgs.map(quoteShellArg).join(' ')}`
  : entry.command;

const result = spawnSync(command, {
  cwd: projectRoot,
  shell: true,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[command] failure ao run ${commandName}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 0);

function quoteShellArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) {
    return text;
  }
  return `"${text.replace(/(["\\$`])/g, '\\$1')}"`;
}
