/**
 * local state path integrity for `.zavorth/*` stores (S9).
 *
 * - Paths must resolve under the project root (or explicit allowed root).
 * - Optional realpath checks reject symlink escapes when the path exists.
 * - Atomic-ish write helper (temp + rename) reduces partial overwrite risk.
 */

import fs from 'node:fs';
import path from 'node:path';

export type LocalStatePathGuardOptions = {
  /** When true (default), require realpath(candidate) stay under realpath(root) if candidate exists. */
  checkSymlink?: boolean;
};

export function isPathInsideRoot(root: string, candidate: string): boolean {
  const r = path.resolve(root);
  const c = path.resolve(candidate);
  const relative = path.relative(r, c);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Resolve a store path under projectRoot/.zavorth/... and refuse escapes.
 */
export function resolveZavorthLocalPath(
  projectRoot: string,
  ...segments: string[]
): string {
  const root = path.resolve(projectRoot);
  const zavorthRoot = path.join(root, '.zavorth');
  const candidate = path.resolve(zavorthRoot, ...segments);
  if (!isPathInsideRoot(zavorthRoot, candidate) && candidate !== zavorthRoot) {
    throw new Error(`local state path escapes .zavorth root: ${candidate}`);
  }
  if (!isPathInsideRoot(root, candidate)) {
    throw new Error(`local state path escapes project root: ${candidate}`);
  }
  return candidate;
}

/**
 * Assert candidate stays under root; optionally reject symlink-escape via realpath.
 */
export function assertSafeLocalStatePath(
  root: string,
  candidate: string,
  label = 'path',
  options: LocalStatePathGuardOptions = {},
): string {
  const checkSymlink = options.checkSymlink !== false;
  const resolved = path.resolve(candidate);
  if (!isPathInsideRoot(root, resolved)) {
    throw new Error(`${label} must stay under root: ${resolved}`);
  }
  if (checkSymlink && fs.existsSync(resolved)) {
    try {
      const realRoot = fs.realpathSync(path.resolve(root));
      const realCandidate = fs.realpathSync(resolved);
      if (!isPathInsideRoot(realRoot, realCandidate)) {
        throw new Error(`${label} realpath escapes root (symlink?): ${realCandidate}`);
      }
      return realCandidate;
    } catch (error) {
      if (error instanceof Error && error.message.includes('realpath escapes')) {
        throw error;
      }
      // If realpath fails (race/deleted), keep resolved containment check.
    }
  }
  return resolved;
}

/**
 * Write UTF-8 text under a local state path with temp-file rename (S9 overwrite integrity).
 */
export function safeWriteLocalTextFile(
  filePath: string,
  content: string,
  options: { encoding?: BufferEncoding; mode?: number } = {},
): void {
  const encoding = options.encoding || 'utf8';
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  // Refuse writing through a symlink path that already points outside (best-effort).
  if (fs.existsSync(filePath)) {
    try {
      const st = fs.lstatSync(filePath);
      if (st.isSymbolicLink()) {
        throw new Error(`Refusing to overwrite symlink local state file: ${filePath}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Refusing')) throw error;
    }
  }
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmp, content, { encoding, mode: options.mode });
  fs.renameSync(tmp, filePath);
}
