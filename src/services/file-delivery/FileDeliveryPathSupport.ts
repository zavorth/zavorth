import fs from 'fs';
import os from 'os';
import path from 'path';
import { PolicyEngine } from '../../security/PolicyEngine.js';
import type {
  FileDeliveryEntry,
  FileDeliveryStats,
  RootKey,
  SearchRoot,
} from './FileDeliveryTypes.js';
import { GENERATED_DIRECTORY_NAMES } from './FileDeliveryTypes.js';
import { logger } from '../../logger.js';

export class FileDeliveryPathSupport {
  constructor(
    private readonly roots: SearchRoot[],
    private readonly policyEngine: PolicyEngine,
  ) {}

  public resolveSearchRoots(preferredRoots: RootKey[], extraAllowedPaths: string[] = []): SearchRoot[] {
    const preferredOrder = new Set(preferredRoots);
    const baseRoots = [
      ...this.roots.filter((root) => preferredOrder.has(root.key)),
      ...this.roots.filter((root) => !preferredOrder.has(root.key)),
    ];
    const extraRoots = extraAllowedPaths
      .map((value, index) => this.createExtraRoot(value, index))
      .filter((value): value is SearchRoot => Boolean(value));

    return [
      ...baseRoots,
      ...extraRoots.filter(
        (extra) => !baseRoots.some((root) => path.resolve(root.absolutePath) === path.resolve(extra.absolutePath)),
      ),
    ];
  }

  public resolveExplicitPath(explicitPath: string, roots: SearchRoot[]): FileDeliveryEntry | null {
    const expanded = this.expandUserPath(explicitPath);
    const absolutePath = path.resolve(expanded);
    const containingRoot = roots.find((root) => this.isPathInsideRoot(root.absolutePath, absolutePath));
    if (!containingRoot || this.shouldSkipAbsolutePath(absolutePath) || !fs.existsSync(absolutePath)) {
      return null;
    }
    return this.makeEntry(absolutePath, containingRoot, fs.statSync(absolutePath), 9999);
  }

  public resolvePermissionPath(explicitPath: string): string | null {
    const expanded = this.expandUserPath(explicitPath);
    const absolutePath = path.resolve(expanded);
    if (!fs.existsSync(absolutePath) || this.shouldSkipAbsolutePath(absolutePath)) {
      return null;
    }

    try {
      const stats = fs.statSync(absolutePath);
      return stats.isDirectory() ? absolutePath : path.dirname(absolutePath);
    } catch (error) { logger.warn('[File Delivery Path] filesystem operation failed', error); return null; }
  }

  public makeEntry(absolutePath: string, root: SearchRoot, stats: FileDeliveryStats, score: number): FileDeliveryEntry {
    const relativePath = path.relative(root.absolutePath, absolutePath) || path.basename(absolutePath);
    return {
      absolutePath,
      baseName: path.basename(absolutePath),
      extension: stats.isDirectory() ? '' : path.extname(absolutePath).toLowerCase(),
      isDirectory: stats.isDirectory(),
      relativePath: relativePath.replace(/\\/g, '/'),
      rootKey: root.key,
      rootLabel: root.label,
      score,
      sizeBytes: stats.size,
      modifiedAtMs: stats.mtimeMs,
    };
  }

  public getRootForEntry(entry: FileDeliveryEntry): SearchRoot {
    return this.roots.find((root) => root.key === entry.rootKey) || {
      key: entry.rootKey,
      label: entry.rootLabel,
      absolutePath: path.dirname(entry.absolutePath),
    };
  }

  public isPathInsideRoot(rootPath: string, targetPath: string): boolean {
    const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  public shouldSkipAbsolutePath(absolutePath: string, isDirectoryHint?: boolean): boolean {
    const baseName = path.basename(absolutePath).toLowerCase();

    if (this.policyEngine.isPathBlocked(absolutePath)) {
      return true;
    }

    if (GENERATED_DIRECTORY_NAMES.has(baseName) && (isDirectoryHint ?? this.safeIsDirectory(absolutePath))) {
      return true;
    }

    return false;
  }

  public findNamedRootMatch(roots: SearchRoot[], searchTerm: string): SearchRoot | null {
    const normalizedSearch = this.normalizeComparableText(searchTerm);
    if (!normalizedSearch) {
      return null;
    }

    const queryTokens = normalizedSearch.split(/\s+/).filter(Boolean);
    for (const root of roots) {
      const haystack = this.normalizeComparableText(`${root.label} ${path.basename(root.absolutePath)}`);
      if (!haystack) {
        continue;
      }

      const matchesAllTokens = queryTokens.every((token) => this.matchesLooseToken(haystack, token));
      if (matchesAllTokens) {
        return root;
      }
    }

    return null;
  }

  public stripRootNameFromSearchTerm(searchTerm: string, root: SearchRoot): string {
    const rootTokens = this.normalizeComparableText(`${root.label} ${path.basename(root.absolutePath)}`)
      .split(/\s+/)
      .filter(Boolean);
    const nextTokens = this.normalizeComparableText(searchTerm)
      .split(/\s+/)
      .filter((token) => !rootTokens.some((rootToken) => this.matchesLooseToken(rootToken, token)));

    return nextTokens.join(' ').trim();
  }

  private createExtraRoot(rawPath: string, index: number): SearchRoot | null {
    const normalizedPath = String(rawPath || '').trim();
    if (!normalizedPath) {
      return null;
    }

    const absolutePath = path.resolve(normalizedPath);
    if (!fs.existsSync(absolutePath) || this.shouldSkipAbsolutePath(absolutePath)) {
      return null;
    }

    let rootPath = absolutePath;
    try {
      if (fs.statSync(absolutePath).isFile()) {
        rootPath = path.dirname(absolutePath);
      }
    } catch (error) { logger.warn('[File Delivery Path] filesystem operation failed', error); return null; }

    return {
      key: `approved_root_${index}`,
      label: path.basename(rootPath) || rootPath,
      absolutePath: rootPath,
    };
  }

  private expandUserPath(rawPath: string): string {
    return rawPath.startsWith('~') ? path.join(process.env.USERPROFILE || os.homedir(), rawPath.slice(1)) : rawPath;
  }

  private normalizeComparableText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private matchesLooseToken(haystack: string, token: string): boolean {
    if (!token) {
      return true;
    }

    const compactToken = token.replace(/s$/i, '');
    return haystack.includes(token) || (compactToken.length > 2 && haystack.includes(compactToken));
  }

  private safeIsDirectory(targetPath: string): boolean {
    try {
      return fs.statSync(targetPath).isDirectory();
    } catch (error) { logger.warn('[File Delivery Path] filesystem operation failed', error); return false; }
  }
}
