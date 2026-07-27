#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const historyPath = path.join(projectRoot, 'data', 'runtime', 'publish-history.json');
const remoteDistDir = path.join(projectRoot, 'remote-dist');
const compareScriptPath = path.join(projectRoot, 'scripts', 'remote-compare.ts');

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

function run(command, args, cwd = projectRoot) {
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
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }
}

function capture(command, args, cwd = projectRoot) {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', [command, ...args].map(quoteWindowsArg).join(' ')],
          {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
            encoding: 'utf8',
          },
        )
      : spawnSync(command, args, {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          encoding: 'utf8',
        });

  if (result.status !== 0) {
    if (result.error) {
      throw result.error;
    }
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }

  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

function readHistory() {
  if (!fs.existsSync(historyPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getOptionValue(argv, name) {
  const prefix = `${name}=`;
  const matched = argv.find((entry) => entry.startsWith(prefix));
  return matched ? matched.slice(prefix.length) : null;
}

function main() {
  const argv = process.argv.slice(2);
  const args = new Set(argv);
  const dryRun = args.has('--dry-run');
  const archiveId = getOptionValue(argv, '--id');
  const skipGitPush = args.has('--skip-git-push');
  const skipSmoke = args.has('--skip-smoke');
  const history = readHistory();

  if (!history.length) {
    if (dryRun) {
      console.log('[remote-rollback] dry-run: nenhum publish anterior encontrado para rollback.');
      return;
    }
    throw new Error('No publish anterior encontrado para rollback.');
  }

  const target =
    (archiveId ? history.find((entry) => entry.archive?.id === archiveId) : null) ||
    history[1] ||
    history[0];

  if (!target?.archive?.targets?.docs || !target?.archive?.targets?.remoteConsole) {
    if (dryRun) {
      console.log('[remote-rollback] dry-run: the selected publish has no usable local snapshot for rollback.');
      return;
    }
    throw new Error('The selected publish has no usable local snapshot for rollback.');
  }

  const docsSource = path.resolve(projectRoot, target.archive.targets.docs);
  const remoteConsoleSource = path.resolve(projectRoot, target.archive.targets.remoteConsole);

  if (!fs.existsSync(docsSource) || !fs.existsSync(remoteConsoleSource)) {
    throw new Error('Archived files for the selected publish are no longer available.');
  }

  console.log(`[remote-rollback] alvo: ${target.archive.id}`);
  console.log(`[remote-rollback] docs source: ${docsSource}`);
  console.log(`[remote-rollback] remote console source: ${remoteConsoleSource}`);

  const compareArgs = [
    compareScriptPath,
    `--from=${target.archive.id}`,
    '--to=current-prepared',
  ];

  try {
    if (!dryRun && fs.existsSync(path.join(remoteDistDir, 'docs')) && fs.existsSync(path.join(remoteDistDir, 'remote-console'))) {
      console.log('[remote-rollback] comparando snapshot alvo com o remote-dist current...');
      const comparisonOutput = capture(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', ...compareArgs], projectRoot);
      if (comparisonOutput) {
        process.stdout.write(`${comparisonOutput}\n`);
      }
    } else {
      console.log('[remote-rollback] previous comparison unavailable ou without remote-dist current prepared.');
    }
  } catch (error) {
    console.warn(`[remote-rollback] aviso: failure ao gerar previous comparison (${error.message || error}).`);
  }

  if (dryRun) {
    console.log('[remote-rollback] dry-run: no file or deployment changed.');
    return;
  }

  fs.rmSync(path.join(remoteDistDir, 'docs'), { recursive: true, force: true });
  fs.rmSync(path.join(remoteDistDir, 'remote-console'), { recursive: true, force: true });
  fs.cpSync(docsSource, path.join(remoteDistDir, 'docs'), { recursive: true, force: true });
  fs.cpSync(remoteConsoleSource, path.join(remoteDistDir, 'remote-console'), {
    recursive: true,
    force: true,
  });

  const publishArgs = [
    path.join('scripts', 'publish-remote.mjs'),
    '--reuse-prepared',
    '--source-archive=' + target.archive.id,
  ];
  if (skipSmoke) {
    publishArgs.push('--skip-smoke');
  }
  if (skipGitPush) {
    publishArgs.push('--skip-git-push');
  }

  console.log('[remote-rollback] republicando snapshot arquivado...');
  run(process.platform === 'win32' ? 'node' : process.execPath, publishArgs, projectRoot);
}

main();
