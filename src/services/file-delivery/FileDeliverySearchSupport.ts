import fs from 'fs';
import path from 'path';
import type { FileDeliveryEntry, RequestDescriptor, SearchRoot } from './FileDeliveryTypes.js';
import { MAX_PENDING_CHOICES, MAX_SCAN_ENTRIES } from './FileDeliveryTypes.js';
import type { FileDeliveryPathSupport } from './FileDeliveryPathSupport.js';

export class FileDeliverySearchSupport {
  constructor(private readonly pathSupport: FileDeliveryPathSupport) {}

  public async listTopLevelEntries(root: SearchRoot, descriptor?: RequestDescriptor): Promise<FileDeliveryEntry[]> {
    const entries = await fs.promises.readdir(root.absolutePath, { withFileTypes: true });
    const resolvedEntries = await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith('.') && !this.pathSupport.shouldSkipAbsolutePath(path.join(root.absolutePath, entry.name), entry.isDirectory()))
        .slice(0, MAX_SCAN_ENTRIES)
        .map(async (entry) => {
          const absolutePath = path.join(root.absolutePath, entry.name);
          return this.pathSupport.makeEntry(absolutePath, root, await fs.promises.stat(absolutePath), entry.isDirectory() ? 70 : 60);
        }),
    );

    return resolvedEntries
      .filter((entry) => this.matchesListingFilters(entry, descriptor))
      .sort((left, right) => {
        if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1;
        return left.baseName.localeCompare(right.baseName, 'en-US');
      })
      .slice(0, MAX_PENDING_CHOICES);
  }

  public async listEntriesInDirectory(directoryEntry: FileDeliveryEntry, descriptor?: RequestDescriptor): Promise<FileDeliveryEntry[]> {
    const root = this.pathSupport.getRootForEntry(directoryEntry);
    const entries = await fs.promises.readdir(directoryEntry.absolutePath, { withFileTypes: true });
    const resolvedEntries = await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith('.') && !this.pathSupport.shouldSkipAbsolutePath(path.join(directoryEntry.absolutePath, entry.name), entry.isDirectory()))
        .slice(0, MAX_SCAN_ENTRIES)
        .map(async (entry) => {
          const absolutePath = path.join(directoryEntry.absolutePath, entry.name);
          return this.pathSupport.makeEntry(absolutePath, root, await fs.promises.stat(absolutePath), entry.isDirectory() ? 70 : 60);
        }),
    );

    return resolvedEntries
      .filter((entry) => this.matchesListingFilters(entry, descriptor))
      .sort((left, right) => {
        if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1;
        return left.baseName.localeCompare(right.baseName, 'en-US');
      })
      .slice(0, MAX_PENDING_CHOICES);
  }

  public async searchCandidates(roots: SearchRoot[], descriptor: RequestDescriptor, strictLatest = false): Promise<FileDeliveryEntry[]> {
    const matches: FileDeliveryEntry[] = [];
    let visited = 0;
    const queryTokens = descriptor.searchTerm.toLowerCase().split(/\s+/).map((token) => token.trim()).filter(Boolean);

    for (const root of roots) {
      const queue: string[] = [root.absolutePath];
      while (queue.length > 0 && visited < MAX_SCAN_ENTRIES) {
        const currentDir = queue.shift();
        if (!currentDir) continue;

        let entries: fs.Dirent[];
        try {
          entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const entry of entries) {
          if (visited >= MAX_SCAN_ENTRIES) break;
          visited += 1;
          if (entry.name.startsWith('.')) continue;

          const absolutePath = path.join(currentDir, entry.name);
          if (this.pathSupport.shouldSkipAbsolutePath(absolutePath, entry.isDirectory())) {
            continue;
          }

          let stats: fs.Stats;
          try {
            stats = await fs.promises.stat(absolutePath);
          } catch {
            continue;
          }

          const candidate = this.pathSupport.makeEntry(absolutePath, root, stats, 0);
          if (entry.isDirectory()) queue.push(absolutePath);
          if (!this.matchesTimeFilter(candidate, descriptor)) continue;

          const score = this.scoreCandidate(candidate, descriptor, queryTokens);
          if (score <= 0 && !strictLatest) continue;
          if (strictLatest && descriptor.desiredType === 'file' && candidate.isDirectory) continue;
          matches.push({ ...candidate, score });
        }
      }
    }

    return matches
      .filter((candidate) => this.matchesDesiredType(candidate, descriptor.desiredType))
      .filter((candidate) => !descriptor.desiredExtension || candidate.extension === descriptor.desiredExtension)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return right.modifiedAtMs - left.modifiedAtMs;
      })
      .slice(0, MAX_PENDING_CHOICES);
  }

  public pickLatestCandidate(candidates: FileDeliveryEntry[]): FileDeliveryEntry {
    return [...candidates].sort((left, right) => {
      if (right.modifiedAtMs !== left.modifiedAtMs) return right.modifiedAtMs - left.modifiedAtMs;
      return right.score - left.score;
    })[0];
  }

  public shouldAutoSend(candidates: FileDeliveryEntry[], descriptor: RequestDescriptor): boolean {
    if (candidates.length === 1) return true;
    const [best, second] = candidates;
    if (!best || !second) return false;
    if (best.score >= 1000 && second.score < 1000) return true;
    if (descriptor.wantsLatest && best.modifiedAtMs > second.modifiedAtMs) return true;
    return best.score >= 850 && best.score - second.score >= 150;
  }

  public matchesDesiredType(candidate: FileDeliveryEntry, desiredType: RequestDescriptor['desiredType']): boolean {
    if (desiredType === 'either') return true;
    return desiredType === 'directory' ? candidate.isDirectory : !candidate.isDirectory;
  }

  public matchesTimeFilter(candidate: FileDeliveryEntry, descriptor: RequestDescriptor): boolean {
    if (descriptor.modifiedSinceMs !== null && candidate.modifiedAtMs < descriptor.modifiedSinceMs) return false;
    if (descriptor.modifiedUntilMs !== null && candidate.modifiedAtMs >= descriptor.modifiedUntilMs) return false;
    return true;
  }

  public matchesListingFilters(entry: FileDeliveryEntry, descriptor?: RequestDescriptor): boolean {
    if (!descriptor) return true;
    if (!this.matchesTimeFilter(entry, descriptor)) return false;
    if (descriptor.desiredExtension && entry.extension !== descriptor.desiredExtension) return false;
    return true;
  }

  private scoreCandidate(candidate: FileDeliveryEntry, descriptor: RequestDescriptor, queryTokens: string[]): number {
    if (!this.matchesDesiredType(candidate, descriptor.desiredType)) return 0;
    const lowerName = candidate.baseName.toLowerCase();
    const lowerPath = candidate.relativePath.toLowerCase();
    const lowerSearch = descriptor.searchTerm.toLowerCase().trim();
    if (!lowerSearch) return descriptor.wantsLatest || descriptor.desiredExtension ? 1 : 0;

    const baseNameWithoutExtension = candidate.baseName.replace(path.extname(candidate.baseName), '').toLowerCase();
    if (lowerName === lowerSearch || baseNameWithoutExtension === lowerSearch) return 1000;
    if (lowerName.includes(lowerSearch)) return 800;

    const tokenMatches = queryTokens.filter((token) => lowerName.includes(token) || lowerPath.includes(token)).length;
    if (tokenMatches === queryTokens.length && tokenMatches > 0) return 600 + tokenMatches * 20;
    if (descriptor.desiredExtension && candidate.extension === descriptor.desiredExtension) return tokenMatches > 0 ? 450 + tokenMatches * 10 : 150;
    return tokenMatches > 0 ? 300 + tokenMatches * 10 : 0;
  }
}
