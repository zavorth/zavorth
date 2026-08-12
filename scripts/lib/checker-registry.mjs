import fs from 'node:fs';
import path from 'node:path';

/**
 * Canonical registry of QA checkers. Replaces the historical pattern of
 * adding one npm script per checker. The script stays; the npm alias dies.
 */

const REGISTRY_PATH = path.resolve('scripts/registry/checks.json');

export function loadCheckerRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return { version: 1, checkers: {} };
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

export function listCheckers() {
  const registry = loadCheckerRegistry();
  return Object.entries(registry.checkers).map(([id, meta]) => ({ id, ...meta }));
}

export function resolveChecker(id) {
  const registry = loadCheckerRegistry();
  const entry = registry.checkers[id];
  if (!entry) {
    return null;
  }
  return { id, script: entry.script, description: entry.description || '' };
}
