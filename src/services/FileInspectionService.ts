import fs from 'fs';
import os from 'os';
import path from 'path';
import { createPatch } from 'diff';
import { config } from '../config/index.js';
import { PolicyEngine } from '../security/PolicyEngine.js';
import { logger } from '../logger.js';

type RootKey = string;
type SearchRoot = {
  key: RootKey;
  label: string;
  absolutePath: string;
};

type FileInspectionPrepareOptions = {
  extraAllowedPaths?: string[];
};

type InspectionDescriptor = {
  mode: 'compare' | 'changes' | 'filtered_list';
  explicitPaths: string[];
  preferredRoots: RootKey[];
  desiredExtensions: string[];
  minSizeBytes: number | null;
  maxSizeBytes: number | null;
  modifiedSinceMs: number | null;
  modifiedUntilMs: number | null;
  timeFilterLabel: string | null;
};

export type FileInspectionPlan =
  | { kind: 'message'; text: string }
  | { kind: 'permission'; requestedPath: string; previewPath: string; originalRequest: string; reason: string }
  | { kind: 'result'; text: string };

type CompareResolution = {
  left: string;
  right: string;
};

// Keep natural chat inspection responsive and avoid broad traversal of personal folders.
// Deep inventory belongs to an explicit governed agent run, not the fast local-inspector path.
const MAX_SCAN_ENTRIES = 600;
const MAX_COMPARE_BYTES = 1024 * 1024;

export class FileInspectionService {
  private readonly roots: SearchRoot[];
  private readonly policyEngine: PolicyEngine;

  constructor(options?: {
    userHomeDir?: string;
    workspaceDir?: string;
    workspaceRootDir?: string;
    extraRoots?: Array<{ key: RootKey; label: string; absolutePath: string }>;
  }) {
    const homeDir = options?.userHomeDir || process.env.USERPROFILE || os.homedir();
    const workspaceDir = options?.workspaceDir || config.defaultWorkspace;
    const workspaceRootDir = options?.workspaceRootDir || config.workspaceRoot || path.dirname(workspaceDir);
    const configuredRoots: SearchRoot[] = [
      { key: 'workspace', label: 'Workspace', absolutePath: workspaceDir },
      { key: 'workspace_root', label: path.basename(workspaceRootDir) || 'Workspace root', absolutePath: workspaceRootDir },
      { key: 'downloads', label: 'Downloads', absolutePath: path.join(homeDir, 'Downloads') },
      { key: 'desktop', label: 'Desktop', absolutePath: path.join(homeDir, 'Desktop') },
      { key: 'documents', label: 'Documents', absolutePath: path.join(homeDir, 'Documents') },
      ...(options?.extraRoots || []),
    ];
    this.roots = configuredRoots.filter(
      (entry, index, all) =>
        entry.absolutePath &&
        fs.existsSync(entry.absolutePath) &&
        all.findIndex((candidate) => candidate.key === entry.key) === index,
    );
    this.policyEngine = new PolicyEngine();
  }

  public shouldHandleNaturalQuery(text: string): boolean {
    const normalized = String(text || '').trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    return /[A-Za-z]:(?:[\\/][^\n\r]+)+/.test(normalized);
  }

  public async prepare(rawRequest: string, options: FileInspectionPrepareOptions = {}): Promise<FileInspectionPlan> {
    const descriptor = this.parseRequest(rawRequest);
    const roots = this.resolveSearchRoots(descriptor.preferredRoots, options.extraAllowedPaths || []);
    if (roots.length === 0) {
      return { kind: 'message', text: 'I could not find any available local root to inspect files right now.' };
    }

    const permissionPlan = this.resolvePermissionPlan(descriptor.explicitPaths, roots, rawRequest);
    if (permissionPlan) {
      return permissionPlan;
    }

    if (descriptor.mode === 'compare') {
      return this.buildComparePlan(rawRequest, descriptor, roots);
    }

    if (descriptor.mode === 'changes') {
      return this.buildChangesPlan(descriptor, roots);
    }

    return this.buildFilteredListingPlan(descriptor, roots);
  }

  private parseRequest(rawRequest: string): InspectionDescriptor {
    const normalized = String(rawRequest || '').trim();
    const lowered = normalized.toLowerCase();
    const explicitPaths = this.extractExplicitPaths(normalized);

    return {
      mode: this.detectMode(lowered),
      explicitPaths,
      preferredRoots: this.detectRootHints(lowered),
      desiredExtensions: this.detectDesiredExtensions(lowered),
      minSizeBytes: this.parseSizeFilter(lowered, 'min'),
      maxSizeBytes: this.parseSizeFilter(lowered, 'max'),
      modifiedSinceMs: this.parseTimeFilter(lowered).sinceMs,
      modifiedUntilMs: this.parseTimeFilter(lowered).untilMs,
      timeFilterLabel: this.parseTimeFilter(lowered).label,
    };
  }

  private detectMode(lowered: string): InspectionDescriptor['mode'] {
    if (['compare', 'diff'].some((term) => lowered.includes(term))) {
      return 'compare';
    }

    return 'filtered_list';
  }

  private extractExplicitPaths(rawRequest: string): string[] {
    const fromQuotes = Array.from(rawRequest.matchAll(/["']([^"']*[\\/][^"']+)["']/g)).map((match) =>
      String(match[1] || '').trim(),
    );
    const fromDrivePaths = Array.from(rawRequest.matchAll(/[A-Za-z]:(?:[\\/][^\s"']+)+/g)).map((match) =>
      String(match[0] || '').trim().replace(/[.,;:!...]+$/, ''),
    );

    return Array.from(new Set([...fromQuotes, ...fromDrivePaths])).filter(Boolean).slice(0, 2);
  }

  private detectRootHints(_loweredRequest: string): RootKey[] {
    const roots: RootKey[] = [];
    return roots.length > 0 ? roots : ['workspace', 'workspace_root', 'downloads', 'desktop', 'documents'];
  }

  private detectDesiredExtensions(_loweredRequest: string): string[] {
    const extensions = new Set<string>();
    const pushAll = (...values: string[]) => values.forEach((value) => extensions.add(value));

    return Array.from(extensions);
  }

  private parseSizeFilter(_loweredRequest: string, _mode: 'min' | 'max'): number | null {
    return null;
  }

  private parseTimeFilter(_loweredRequest: string): { sinceMs: number | null; untilMs: number | null; label: string | null } {
    return { sinceMs: null, untilMs: null, label: null };
  }

  private resolveSearchRoots(preferredRoots: RootKey[], extraAllowedPaths: string[]): SearchRoot[] {
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

  private resolvePermissionPlan(
    explicitPaths: string[],
    roots: SearchRoot[],
    originalRequest: string,
  ): FileInspectionPlan | null {
    for (const explicitPath of explicitPaths) {
      const expanded = explicitPath.startsWith('~')
        ? path.join(process.env.USERPROFILE || os.homedir(), explicitPath.slice(1))
        : explicitPath;
      const absolutePath = path.resolve(expanded);
      if (!fs.existsSync(absolutePath) || this.shouldSkipAbsolutePath(absolutePath)) {
        continue;
      }

      const allowed = roots.some((root) => this.isPathInsideRoot(root.absolutePath, absolutePath));
      if (allowed) {
        continue;
      }

      const requestedPath = fs.statSync(absolutePath).isDirectory() ? absolutePath : path.dirname(absolutePath);
      return {
        kind: 'permission',
        requestedPath,
        previewPath: requestedPath,
        originalRequest,
        reason: 'This path exists, but is not released for local Zavorth inspection yet.',
      };
    }

    return null;
  }

  private async buildComparePlan(
    rawRequest: string,
    descriptor: InspectionDescriptor,
    roots: SearchRoot[],
  ): Promise<FileInspectionPlan> {
    const resolved = await this.resolveCompareTargets(rawRequest, descriptor, roots);
    if (!resolved) {
      return {
        kind: 'message',
        text: 'Could not identify the two files to compare. Provide two quoted paths or absolute paths.',
      };
    }

    const leftBuffer = await fs.promises.readFile(resolved.left);
    const rightBuffer = await fs.promises.readFile(resolved.right);
    const leftStats = await fs.promises.stat(resolved.left);
    const rightStats = await fs.promises.stat(resolved.right);
    const leftName = path.basename(resolved.left);
    const rightName = path.basename(resolved.right);

    if (leftBuffer.equals(rightBuffer)) {
      return {
        kind: 'result',
        text: [
          `Comparison entre ${leftName} and ${rightName}`,
          '',
          'Os dois files are identicos.',
          `Size: ${this.formatBytes(leftStats.size)} and ${this.formatBytes(rightStats.size)}`,
          `Modificados em: ${this.formatDateTime(leftStats.mtimeMs)} | ${this.formatDateTime(rightStats.mtimeMs)}`,
        ].join('\n'),
      };
    }

    const isTextPair =
      leftStats.size <= MAX_COMPARE_BYTES &&
      rightStats.size <= MAX_COMPARE_BYTES &&
      !this.looksBinary(leftBuffer) &&
      !this.looksBinary(rightBuffer);

    if (!isTextPair) {
      return {
        kind: 'result',
        text: [
          `Comparison entre ${leftName} and ${rightName}`,
          '',
          'Files differ, but at least one is too large or binary for safe textual diff.',
          `Size: ${this.formatBytes(leftStats.size)} vs ${this.formatBytes(rightStats.size)}`,
          `Locais: ${resolved.left} | ${resolved.right}`,
        ].join('\n'),
      };
    }

    const patch = createPatch(
      `${leftName} -> ${rightName}`,
      leftBuffer.toString('utf8'),
      rightBuffer.toString('utf8'),
      'before',
      'after',
    );
    const diffLines = patch
      .split(/\r?\n/)
      .filter((line) => line.startsWith('+') || line.startsWith('-'))
      .slice(0, 24);

    return {
      kind: 'result',
      text: [
        `Comparison entre ${leftName} and ${rightName}`,
        '',
        `Size: ${this.formatBytes(leftStats.size)} vs ${this.formatBytes(rightStats.size)}`,
        `changes destacadas:`,
        ...diffLines.map((line) => line),
        ...(patch.split(/\r?\n/).filter((line) => line.startsWith('+') || line.startsWith('-')).length > diffLines.length
          ? ['... (diff truncado para caber no Telegram)']
          : []),
      ].join('\n'),
    };
  }

  private async buildChangesPlan(
    descriptor: InspectionDescriptor,
    roots: SearchRoot[],
  ): Promise<FileInspectionPlan> {
    const root = this.resolvePrimaryRoot(descriptor, roots);
    const items = await this.scanFiles(root.absolutePath, descriptor);
    const changed = items
      .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)
      .slice(0, 12);

    if (changed.length === 0) {
      return {
        kind: 'message',
        text: `Could not find changed files ${descriptor.timeFilterLabel || 'in the requested period'} em ${root.label}.`,
      };
    }

    return {
      kind: 'result',
      text: [
        `Changed files ${descriptor.timeFilterLabel || 'recently'} em ${root.label}`,
        '',
        ...changed.map((entry, index) =>
          `${index + 1}. ${entry.relativePath} - ${this.formatDateTime(entry.modifiedAtMs)} - ${this.formatBytes(entry.sizeBytes)}`,
        ),
      ].join('\n'),
    };
  }

  private async buildFilteredListingPlan(
    descriptor: InspectionDescriptor,
    roots: SearchRoot[],
  ): Promise<FileInspectionPlan> {
    const root = this.resolvePrimaryRoot(descriptor, roots);
    const items = await this.scanFiles(root.absolutePath, descriptor);
    const filtered = items
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en-US'))
      .slice(0, 12);

    if (filtered.length === 0) {
      return {
        kind: 'message',
        text: `Could not find compatible files in ${root.label} with the requested filters.`,
      };
    }

    const filterSummary = [
      descriptor.desiredExtensions.length > 0 ? `tipos ${descriptor.desiredExtensions.join(', ')}` : null,
      descriptor.minSizeBytes ? `maiores que ${this.formatBytes(descriptor.minSizeBytes)}` : null,
      descriptor.maxSizeBytes ? `menores que ${this.formatBytes(descriptor.maxSizeBytes)}` : null,
      descriptor.timeFilterLabel,
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      kind: 'result',
      text: [
        `Itens encontrados em ${root.label}${filterSummary ? ` (${filterSummary})` : ''}`,
        '',
        ...filtered.map((entry, index) =>
          `${index + 1}. ${entry.relativePath} - ${this.describeEntryKind(entry)} - ${this.formatBytes(entry.sizeBytes)} - ${this.formatDateTime(entry.modifiedAtMs)}`,
        ),
      ].join('\n'),
    };
  }

  private async resolveCompareTargets(
    rawRequest: string,
    descriptor: InspectionDescriptor,
    roots: SearchRoot[],
  ): Promise<CompareResolution | null> {
    if (descriptor.explicitPaths.length >= 2) {
      const left = this.resolvePathWithinRoots(descriptor.explicitPaths[0], roots);
      const right = this.resolvePathWithinRoots(descriptor.explicitPaths[1], roots);
      if (left && right && fs.statSync(left).isFile() && fs.statSync(right).isFile()) {
        return { left, right };
      }
    }

    const quotedNames = Array.from(rawRequest.matchAll(/["']([^"']+)["']/g))
      .map((match) => String(match[1] || '').trim())
      .filter((value) => value && !value.includes('\\') && !value.includes('/'));
    if (quotedNames.length >= 2) {
      const left = await this.findFileByName(quotedNames[0], roots);
      const right = await this.findFileByName(quotedNames[1], roots);
      if (left && right) {
        return { left, right };
      }
    }

    return null;
  }

  private async findFileByName(baseName: string, roots: SearchRoot[]): Promise<string | null> {
    const lowered = baseName.toLowerCase();
    for (const root of roots) {
      const queue: string[] = [root.absolutePath];
      let visited = 0;
      while (queue.length > 0 && visited < MAX_SCAN_ENTRIES) {
        const currentDir = queue.shift();
        if (!currentDir) {
          continue;
        }

        let entries: fs.Dirent[];
        try {
          entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        } catch (error: unknown) {continue;
        }

        for (const entry of entries) {
          visited += 1;
          const absolutePath = path.join(currentDir, entry.name);
          if (this.shouldSkipAbsolutePath(absolutePath, entry.isDirectory())) {
            continue;
          }
          if (entry.isDirectory()) {
            queue.push(absolutePath);
            continue;
          }
          if (entry.name.toLowerCase() === lowered) {
            return absolutePath;
          }
        }
      }
    }

    return null;
  }

  private resolvePrimaryRoot(descriptor: InspectionDescriptor, roots: SearchRoot[]): SearchRoot {
    if (descriptor.explicitPaths.length > 0) {
      const resolved = this.resolvePathWithinRoots(descriptor.explicitPaths[0], roots);
      if (resolved) {
        const asDirectory = fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
        return {
          key: 'explicit',
          label: path.basename(asDirectory) || asDirectory,
          absolutePath: asDirectory,
        };
      }
    }

    return roots[0];
  }

  private async scanFiles(basePath: string, descriptor: InspectionDescriptor): Promise<Array<{ relativePath: string; absolutePath: string; modifiedAtMs: number; sizeBytes: number; extension: string }>> {
    const matches: Array<{ relativePath: string; absolutePath: string; modifiedAtMs: number; sizeBytes: number; extension: string }> = [];
    const queue: string[] = [basePath];
    let visited = 0;

    while (queue.length > 0 && visited < MAX_SCAN_ENTRIES) {
      const currentDir = queue.shift();
      if (!currentDir) {
        continue;
      }

      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch (error: unknown) {continue;
      }

      for (const entry of entries) {
        visited += 1;
        const absolutePath = path.join(currentDir, entry.name);
        if (this.shouldSkipAbsolutePath(absolutePath, entry.isDirectory())) {
          continue;
        }
        if (entry.isDirectory()) {
          queue.push(absolutePath);
          continue;
        }

        let stats: fs.Stats;
        try {
          stats = await fs.promises.stat(absolutePath);
        } catch (error: unknown) {continue;
        }

        const extension = path.extname(absolutePath).toLowerCase();
        if (descriptor.desiredExtensions.length > 0 && !descriptor.desiredExtensions.includes(extension)) {
          continue;
        }
        if (descriptor.minSizeBytes !== null && stats.size < descriptor.minSizeBytes) {
          continue;
        }
        if (descriptor.maxSizeBytes !== null && stats.size > descriptor.maxSizeBytes) {
          continue;
        }
        if (descriptor.modifiedSinceMs !== null && stats.mtimeMs < descriptor.modifiedSinceMs) {
          continue;
        }
        if (descriptor.modifiedUntilMs !== null && stats.mtimeMs >= descriptor.modifiedUntilMs) {
          continue;
        }

        matches.push({
          relativePath: path.relative(basePath, absolutePath).replace(/\\/g, '/'),
          absolutePath,
          modifiedAtMs: stats.mtimeMs,
          sizeBytes: stats.size,
          extension,
        });
      }
    }

    return matches;
  }

  private resolvePathWithinRoots(rawPath: string, roots: SearchRoot[]): string | null {
    const expanded = rawPath.startsWith('~')
      ? path.join(process.env.USERPROFILE || os.homedir(), rawPath.slice(1))
      : rawPath;
    const absolutePath = path.resolve(expanded);
    const allowed = roots.some((root) => this.isPathInsideRoot(root.absolutePath, absolutePath));
    if (!allowed || this.shouldSkipAbsolutePath(absolutePath) || !fs.existsSync(absolutePath)) {
      return null;
    }

    return absolutePath;
  }

  private isPathInsideRoot(rootPath: string, targetPath: string): boolean {
    const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
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

    const rootPath = fs.statSync(absolutePath).isDirectory() ? absolutePath : path.dirname(absolutePath);
    return {
      key: `approved_inspection_root_${index}`,
      label: path.basename(rootPath) || rootPath,
      absolutePath: rootPath,
    };
  }

  private shouldSkipAbsolutePath(absolutePath: string, isDirectoryHint?: boolean): boolean {
    const baseName = path.basename(absolutePath).toLowerCase();
    if (this.policyEngine.isPathBlocked(absolutePath)) {
      return true;
    }

    if (
      ['.git', '.next', 'build', 'coverage', 'dist', 'node_modules', 'tmp'].includes(baseName) &&
      (isDirectoryHint ?? this.safeIsDirectory(absolutePath))
    ) {
      return true;
    }

    return false;
  }

  private safeIsDirectory(targetPath: string): boolean {
    try {
      return fs.statSync(targetPath).isDirectory();
    } catch (error: unknown) {logger.warn('[File] filesystem operation failed', error); return false; }
  }

  private looksBinary(buffer: Buffer): boolean {
    for (let index = 0; index < Math.min(buffer.length, 512); index += 1) {
      if (buffer[index] === 0) {
        return true;
      }
    }
    return false;
  }

  private formatBytes(sizeBytes: number): string {
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private formatDateTime(timestampMs: number): string {
    return new Date(timestampMs).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
  }

  private describeEntryKind(entry: { extension: string }): string {
    const extension = String(entry.extension || '').toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(extension)) return 'imagem';
    if (['.html', '.htm'].includes(extension)) return 'html';
    if (['.json'].includes(extension)) return 'json';
    if (['.md'].includes(extension)) return 'markdown';
    if (['.css'].includes(extension)) return 'css';
    if (['.js', '.jsx', '.ts', '.tsx'].includes(extension)) return 'code';
    return 'file';
  }
}
