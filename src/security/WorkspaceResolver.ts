import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';function normalizePath(target: string): string {
  return path.resolve(target).replace(/\\/g, '/');
}

function normalizeForComparison(target: string): string {
  const normalized = path.normalize(path.resolve(target));
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function toPortablePath(target: string): string {
  return normalizePath(target).replace(/\\/g, '/');
}

function isPathContained(baseDir: string, targetPath: string): boolean {
  const normalizedBase = normalizeForComparison(baseDir);
  const normalizedTarget = normalizeForComparison(targetPath);
  const relative = path.relative(normalizedBase, normalizedTarget);

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function findPolicyFile(): string | null {
  let dir = __dirname;
  for (let i = 0; i < 5; i += 1) {
    const candidate = path.join(dir, 'config', 'security-policy.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }

  const fallback = path.resolve(process.cwd(), 'config', 'security-policy.json');
  return fs.existsSync(fallback) ? fallback : null;
}

function readPolicyAllowedWorkspaces(): string[] {
  const policyPath = findPolicyFile();
  if (!policyPath) {
    return [];
  }

  try {
    const raw = fs.readFileSync(policyPath, 'utf8');
    const parsed = JSON.parse(raw) as { allowed_workspaces?: unknown };
    if (!Array.isArray(parsed.allowed_workspaces)) {
      return [];
    }

    return parsed.allowed_workspaces
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => normalizePath(entry));
  } catch (error: unknown) {logger.warn('[Workspace Resolver] JSON parse failed', error); return []; }
}

function uniqueNormalizedPaths(candidates: string[]): string[] {
  const unique = new Map<string, string>();

  for (const candidate of candidates) {
    const trimmed = String(candidate || '').trim();
    if (!trimmed) {
      continue;
    }

    unique.set(normalizeForComparison(trimmed), normalizePath(trimmed));
  }

  return Array.from(unique.values());
}

function findNamedRoot(roots: string[], matcher: (entry: string) => boolean): string | null {
  const existing = roots.find(
    (entry) => matcher(toPortablePath(entry).toLowerCase()) && fs.existsSync(entry),
  );
  if (existing) {
    return normalizePath(existing);
  }

  const match = roots.find((entry) => matcher(toPortablePath(entry).toLowerCase()));
  return match ? normalizePath(match) : null;
}

export class WorkspaceResolver {
  public static resolveAlias(workspaceHint: string): string {
    const aliases = this.getAliases();
    const hint = String(workspaceHint || '').trim().toLowerCase();
    return aliases[hint] || workspaceHint;
  }

  public static resolve(workspaceHint: string | null | undefined): string {
    if (!workspaceHint || workspaceHint.trim().length === 0 || workspaceHint.trim().toUpperCase() === 'AUTO') {
      return normalizePath(config.defaultWorkspace);
    }

    return normalizePath(this.resolveAlias(workspaceHint));
  }

  public static validate(workspaceHint: string | null | undefined): string {
    const resolved = this.resolve(workspaceHint);
    const allowed = this.getAllowedRoots().some((root) => isPathContained(root, resolved));

    if (!allowed) {
      throw new Error(`[SECURITY] Workspace nao autorizado: '${resolved}'`);
    }

    if (!fs.existsSync(resolved)) {
      throw new Error(`[SECURITY] Workspace nao encontrado: '${resolved}'`);
    }

    return resolved;
  }

  public static isWorkspaceAllowed(workspaceHint: string | null | undefined): boolean {
    try {
      this.validate(workspaceHint);
      return true;
    } catch (error: unknown) {logger.warn('[Workspace Resolver] filesystem operation failed', error); return false; }
  }

  public static ensurePathInsideWorkspace(baseDir: string, targetPath: string): string {
    const absoluteBase = normalizePath(baseDir);
    const rawTarget = path.isAbsolute(targetPath)
      ? targetPath
      : path.join(absoluteBase, targetPath);
    const absoluteTarget = normalizePath(rawTarget);

    if (!isPathContained(absoluteBase, absoluteTarget)) {
      throw new Error(
        `[SECURITY] Path Traversal evitado. O caminho '${targetPath}' tentou sair do workspace '${baseDir}'.`,
      );
    }

    return absoluteTarget;
  }

  public static getAllowedRoots(): string[] {
    return uniqueNormalizedPaths([
      config.workspaceRoot,
      config.defaultWorkspace,
      ...readPolicyAllowedWorkspaces(),
    ]);
  }

  public static getAliases(): Record<string, string> {
    const workspaceRoot = normalizePath(config.workspaceRoot);
    const defaultWorkspace = normalizePath(config.defaultWorkspace);
    const workspaceParent = normalizePath(path.dirname(workspaceRoot));
    const allowedRoots = this.getAllowedRoots();
    const meuprojetoFallback = normalizePath(path.join(workspaceParent, 'MeuProjeto'));
    const meuprojeto =
      findNamedRoot(allowedRoots, (entry) => entry.endsWith('/meuprojeto')) ||
      meuprojetoFallback;
    const core = workspaceRoot;

    return {
      meuprojeto,
      core,
      zavorth: defaultWorkspace,
      current_workspace: defaultWorkspace,
      default: defaultWorkspace,
      root: workspaceRoot,
    };
  }
}
