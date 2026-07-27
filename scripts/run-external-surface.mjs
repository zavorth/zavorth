#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureExternalSurfaceRoot } from './lib/external-surface-roots.mjs';

function quoteWindowsArg(value) {
  const normalized = String(value ?? '');
  if (!normalized) {
    return '""';
  }

  if (!/[\s"&()<>^|%!]/.test(normalized)) {
    return normalized;
  }

  const escaped = normalized.replace(/(["^&|<>()%!])/g, '^$1');
  return `"${escaped}"`;
}

function run(command, args, cwd) {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', [command, ...args].map(quoteWindowsArg).join(' ')],
          {
            cwd,
            stdio: 'inherit',
            shell: false,
          },
        )
      : spawnSync(command, args, {
          cwd,
          stdio: 'inherit',
          shell: false,
        });

  if (result.status !== 0) {
    if (result.error) {
      throw result.error;
    }
    throw new Error(`${command} ${args.join(' ')} failed com status ${result.status}`);
  }
}

function ensureDependenciesIfNeeded(cwd, command, args) {
  const normalizedCommand = String(command || '').trim().toLowerCase();
  const shouldPrepare =
    (normalizedCommand === 'npm' || normalizedCommand === 'npm.cmd')
    && args[0] === 'run'
    && fs.existsSync(path.join(cwd, 'package.json'))
    && fs.existsSync(path.join(cwd, 'package-lock.json'))
    && !fs.existsSync(path.join(cwd, 'node_modules'));

  if (!shouldPrepare) {
    return;
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(npmCommand, ['install'], cwd);
}

function main() {
  const [, , kind, ...rest] = process.argv;
  if (!kind || rest.length === 0) {
    throw new Error('Uso: node scripts/run-external-surface.mjs <docs|web|website> <comando> [args...]');
  }

  if (kind !== 'docs' && kind !== 'web' && kind !== 'website') {
    throw new Error(`Unknown surface: ${kind}`);
  }

  const cwd = ensureExternalSurfaceRoot(kind);
  const [command, ...args] = rest;
  ensureDependenciesIfNeeded(cwd, command, args);
  run(command, args, cwd);
}

main();
