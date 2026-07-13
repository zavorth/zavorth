import fs from 'node:fs';
import path from 'node:path';

export function validatePluginEntrypointPath(
  packageDir: string,
  entrypointPath: string,
): string | null {
  const packageRoot = path.resolve(packageDir);
  const candidate = path.resolve(entrypointPath);
  const relative = path.relative(packageRoot, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return 'entrypoint.module escapes the plugin package';
  }
  if (fs.existsSync(packageRoot) && fs.existsSync(candidate)) {
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return 'entrypoint.module must resolve to a regular file, not a symlink';
    }
    const realRoot = fs.realpathSync(packageRoot);
    const realCandidate = fs.realpathSync(candidate);
    const realRelative = path.relative(realRoot, realCandidate);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      return 'entrypoint.module real path escapes the plugin package';
    }
  }
  return null;
}
