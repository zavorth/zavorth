/**
 * Path sanitization for Learned Knowledge hub/API surfaces.
 * Avoid leaking absolute host paths (home dirs, drive letters) in JSON responses.
 */

import fs from 'node:fs';
import path from 'node:path';

export function isPathInside(child: string, parent: string): boolean {
  const c = path.resolve(child);
  const p = path.resolve(parent);
  if (c === p) return true;
  const prefix = p.endsWith(path.sep) ? p : `${p}${path.sep}`;
  return c.startsWith(prefix);
}

/**
 * Public-safe path for API/UI: relative to project when possible, else (external)/basename.
 */
export function toPublicPath(absOrRel: string | null | undefined, projectRoot: string): string | null {
  const raw = String(absOrRel || '').trim();
  if (!raw) return null;
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(raw);
  if (isPathInside(resolved, root)) {
    const rel = path.relative(root, resolved).replace(/\\/g, '/');
    return rel || '.';
  }
  return `(external)/${path.basename(resolved)}`;
}

/**
 * Resolve real path when possible; null if unreadable.
 */
export function safeRealpath(target: string): string | null {
  try {
    return fs.realpathSync(path.resolve(target));
  } catch {
    try {
      return path.resolve(target);
    } catch {
      return null;
    }
  }
}
