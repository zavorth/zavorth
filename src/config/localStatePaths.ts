import path from 'path';

export function resolveZavorthLocalStateDir(workspaceRoot = process.cwd()): string {
  const canonicalDir = path.resolve(workspaceRoot, '.zavorth');

  return canonicalDir;
}

export function resolveZavorthLocalStateFile(
  fileName: string,
  workspaceRoot = process.cwd(),
): string {
  const canonicalDir = path.resolve(workspaceRoot, '.zavorth');
  const canonicalFile = path.resolve(canonicalDir, fileName);

  return canonicalFile;
}
