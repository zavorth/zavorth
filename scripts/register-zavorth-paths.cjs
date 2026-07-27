'use strict';

/**
 * Runtime path resolver for compiled `dist/` entrypoints.
 *
 * TypeScript `paths` map `@zavorth/*` → `src/*` at typecheck time, but Node
 * does not honor tsconfig paths. Preload this hook before loading dist:
 *
 *   node -r ./scripts/register-zavorth-paths.cjs dist/host.js
 *   node -r ./scripts/register-zavorth-paths.cjs dist/index.js
 *
 * Also used by the host supervisor when forking a .js worker.
 */

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const projectRoot = path.resolve(__dirname, '..');

/** @type {Record<string, string>} */
const ALIAS_ROOTS = {
  '@zavorth/config': 'config',
  '@zavorth/services': 'services',
  '@zavorth/contracts': 'contracts',
  '@zavorth/runtime': 'runtime',
  '@zavorth/domain': 'domain',
  '@zavorth/security': 'security',
  '@zavorth/storage': 'storage',
  '@zavorth/providers': 'providers',
  '@zavorth/adapters': 'adapters',
  '@zavorth/skills': 'skills',
  '@zavorth/core': 'core',
  '@zavorth/agent': 'agent',
  '@zavorth/autonomy': 'autonomy',
  '@zavorth/canvas': 'canvas',
};

function preferDistOrSrc(relDir) {
  const distDir = path.join(projectRoot, 'dist', relDir);
  if (fs.existsSync(distDir)) {
    return distDir;
  }
  return path.join(projectRoot, 'src', relDir);
}

function candidateFiles(basePath) {
  const candidates = [];
  if (basePath.endsWith('.js') || basePath.endsWith('.cjs') || basePath.endsWith('.mjs')) {
    candidates.push(basePath);
  } else {
    candidates.push(`${basePath}.js`, path.join(basePath, 'index.js'), basePath);
  }
  return candidates;
}

function resolveAlias(request) {
  for (const [prefix, relDir] of Object.entries(ALIAS_ROOTS)) {
    if (request !== prefix && !request.startsWith(`${prefix}/`)) {
      continue;
    }
    const root = preferDistOrSrc(relDir);
    const rest =
      request === prefix ? 'index.js'
        : request.slice(prefix.length + 1);
    for (const candidate of candidateFiles(path.join(root, rest))) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }
  return null;
}

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function zavorthResolveFilename(request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@zavorth/')) {
    const resolved = resolveAlias(request);
    if (resolved) {
      return resolved;
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

module.exports = {
  projectRoot,
  resolveAlias,
  ALIAS_ROOTS,
};
