import path from 'path';

export function normalizePathForComparison(target: string): string {
  const normalized = path.normalize(path.resolve(target));
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function isPathContained(baseDir: string, targetPath: string): boolean {
  const normalizedBase = normalizePathForComparison(baseDir);
  const normalizedTarget = normalizePathForComparison(targetPath);
  const relative = path.relative(normalizedBase, normalizedTarget);

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function uniqueNormalizedPaths(candidates: string[]): string[] {
  const unique = new Map<string, string>();

  for (const candidate of candidates) {
    const trimmed = String(candidate || '').trim();
    if (!trimmed) {
      continue;
    }

    unique.set(normalizePathForComparison(trimmed), path.resolve(trimmed));
  }

  return Array.from(unique.values());
}

export function resolveHostPath(workspaceRoot: string, targetPath: string): string {
  const normalizedTargetPath = String(targetPath || '').trim();
  if (!normalizedTargetPath) {
    return workspaceRoot;
  }

  return path.isAbsolute(normalizedTargetPath)
    ? path.resolve(normalizedTargetPath)
    : path.resolve(workspaceRoot, normalizedTargetPath);
}

export function resolveAllowedPath(input: {
  targetPath: string;
  capabilityId: string;
  workspaceRoot: string;
  allowedRoots: string[];
}): string {
  const resolvedTargetPath = resolveHostPath(input.workspaceRoot, input.targetPath);
  const allowed = input.allowedRoots.some((root) => isPathContained(root, resolvedTargetPath));

  if (!allowed) {
    throw new Error(
      `[SECURITY] ${input.capabilityId} bloqueou caminho fora do escopo permitido: '${resolvedTargetPath}'.`,
    );
  }

  return resolvedTargetPath;
}

export function buildScopeViolationResult(input: {
  capabilityId: string;
  targetPath: string;
  error: unknown;
  workspaceRoot: string;
  allowedRoots: string[];
}): {
  ok: false;
  resultSummary: string;
  stdout: null;
  stderr: string;
  exitCode: null;
  data: {
    path: string;
    allowedRoots: string[];
  };
} {
  const resolvedTargetPath = resolveHostPath(input.workspaceRoot, input.targetPath);
  const message = input.error instanceof Error ? input.error.message : String(input.error || 'scope violation');

  return {
    ok: false,
    resultSummary: `${input.capabilityId} bloqueou um caminho fora do escopo permitido.`,
    stdout: null,
    stderr: message,
    exitCode: null,
    data: {
      path: resolvedTargetPath,
      allowedRoots: input.allowedRoots,
    },
  };
}
