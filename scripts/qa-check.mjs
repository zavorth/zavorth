#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { listCheckers, resolveChecker } from './lib/checker-registry.mjs';

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--list' || command === 'list') {
  const rows = listCheckers();
  if (rows.length === 0) {
    console.log('No checkers registered. Add entries to scripts/registry/checks.json.');
    process.exit(0);
  }
  for (const row of rows) {
    console.log(`${row.id.padEnd(28)} ${row.script}${row.description ? `  — ${row.description}` : ''}`);
  }
  process.exit(0);
}

const checker = resolveChecker(command);
if (!checker) {
  console.error(`Unknown checker: ${command}`);
  console.error('Run `node scripts/qa-check.mjs --list` to see registered checkers.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [checker.script, ...args.slice(1)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
