#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ensureExternalSurfaceRoot, projectRoot } from './lib/external-surface-roots.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteRoot = ensureExternalSurfaceRoot('docs');
const vercelWebRoot = ensureExternalSurfaceRoot('web');
const outputRoot = path.join(projectRoot, 'remote-dist');

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
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }
}

function ensureDependenciesIfNeeded(cwd) {
  if (
    fs.existsSync(path.join(cwd, 'package.json'))
    && fs.existsSync(path.join(cwd, 'package-lock.json'))
    && !fs.existsSync(path.join(cwd, 'node_modules'))
  ) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    run(npmCommand, ['install'], cwd);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyDirectory(sourceDir, targetDir, options = {}) {
  ensureDir(targetDir);
  const exclude = options.exclude || new Set();

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (exclude.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath, options);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

function writeManifest(targetDir) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    policy: 'local-first',
    localOnly: [
      'src',
      'data',
      '.env',
      'AI Gateway sidecar runtime',
      'Zavorth Terminal sidecar runtime',
      'ZavorthBridge UI automation',
      'SQLite runtime state',
    ],
    remoteSafe: [
      {
        id: 'docs',
        source: 'docs-client',
        artifactPath: 'docs',
        deployTargets: ['vercel-static', 'cloudflare-pages', 'github-pages'],
      },
      {
        id: 'remote-console',
        source: 'zavorth-web',
        artifactPath: 'remote-console',
        deployTargets: ['vercel-static', 'cloudflare-pages', 'netlify'],
      },
    ],
  };

  fs.writeFileSync(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
}

function main() {
  resetDir(outputRoot);

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  ensureDependenciesIfNeeded(siteRoot);
  run(npmCommand, ['run', 'build'], siteRoot);

  const builtDocsDir = path.join(siteRoot, 'build');
  const docsOutputDir = path.join(outputRoot, 'docs');
  copyDirectory(builtDocsDir, docsOutputDir);

  const webOutputDir = path.join(outputRoot, 'remote-console');
  copyDirectory(vercelWebRoot, webOutputDir, {
    exclude: new Set(['README.md', 'legacy', '.vercel']),
  });

  writeManifest(outputRoot);

  console.log(`[remote] prepared docs at ${docsOutputDir}`);
  console.log(`[remote] prepared remote console at ${webOutputDir}`);
  console.log(`[remote] manifest written to ${path.join(outputRoot, 'manifest.json')}`);
}

main();
