import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type PublishSnapshotDescriptor = {
  id: string;
  label: string;
  commit?: string | null;
  publishedAt?: string | null;
  docsPath?: string | null;
  remoteConsolePath?: string | null;
};

export type DirectoryComparisonReport = {
  label: string;
  fromPath: string;
  toPath: string;
  fromFileCount: number;
  toFileCount: number;
  added: string[];
  removed: string[];
  changed: string[];
  unchangedCount: number;
};

export type PublishComparisonReport = {
  comparedAt: string;
  from: PublishSnapshotDescriptor;
  to: PublishSnapshotDescriptor;
  commitChanged: boolean;
  targets: {
    docs: DirectoryComparisonReport | null;
    remoteConsole: DirectoryComparisonReport | null;
  };
  overall: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
  summary: string;
};

type FileManifestEntry = {
  relativePath: string;
  size: number;
  sha256: string;
};

export class PublishComparisonService {
  public compareSnapshots(
    from: PublishSnapshotDescriptor,
    to: PublishSnapshotDescriptor,
  ): PublishComparisonReport {
    const docs = this.compareDirectoryPair('docs', from.docsPath, to.docsPath);
    const remoteConsole = this.compareDirectoryPair(
      'remote-console',
      from.remoteConsolePath,
      to.remoteConsolePath,
    );

    const overall = {
      added: (docs?.added.length || 0) + (remoteConsole?.added.length || 0),
      removed: (docs?.removed.length || 0) + (remoteConsole?.removed.length || 0),
      changed: (docs?.changed.length || 0) + (remoteConsole?.changed.length || 0),
      unchanged: (docs?.unchangedCount || 0) + (remoteConsole?.unchangedCount || 0),
    };

    const commitChanged = String(from.commit || '').trim() !== String(to.commit || '').trim();
    const summaryParts = [
      `${from.label} -> ${to.label}`,
      commitChanged ? 'commit mudou' : 'mesmo commit',
      `+${overall.added}`,
      `-${overall.removed}`,
      `~${overall.changed}`,
      `=${overall.unchanged}`,
    ];

    return {
      comparedAt: new Date().toISOString(),
      from,
      to,
      commitChanged,
      targets: {
        docs,
        remoteConsole,
      },
      overall,
      summary: summaryParts.join(' | '),
    };
  }

  private compareDirectoryPair(
    label: string,
    fromPath: string | null | undefined,
    toPath: string | null | undefined,
  ): DirectoryComparisonReport | null {
    const normalizedFrom = String(fromPath || '').trim();
    const normalizedTo = String(toPath || '').trim();
    if (!normalizedFrom || !normalizedTo) {
      return null;
    }

    const fromManifest = this.buildManifest(normalizedFrom);
    const toManifest = this.buildManifest(normalizedTo);
    const fromMap = new Map(fromManifest.map((entry) => [entry.relativePath, entry] as const));
    const toMap = new Map(toManifest.map((entry) => [entry.relativePath, entry] as const));
    const allPaths = Array.from(new Set([...fromMap.keys(), ...toMap.keys()])).sort((a, b) => a.localeCompare(b));

    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    let unchangedCount = 0;

    for (const relativePath of allPaths) {
      const left = fromMap.get(relativePath);
      const right = toMap.get(relativePath);

      if (!left && right) {
        added.push(relativePath);
        continue;
      }
      if (left && !right) {
        removed.push(relativePath);
        continue;
      }
      if (!left || !right) {
        continue;
      }

      if (left.sha256 !== right.sha256 || left.size !== right.size) {
        changed.push(relativePath);
        continue;
      }

      unchangedCount += 1;
    }

    return {
      label,
      fromPath: normalizedFrom,
      toPath: normalizedTo,
      fromFileCount: fromManifest.length,
      toFileCount: toManifest.length,
      added,
      removed,
      changed,
      unchangedCount,
    };
  }

  private buildManifest(rootDir: string): FileManifestEntry[] {
    if (!fs.existsSync(rootDir)) {
      return [];
    }

    const entries: FileManifestEntry[] = [];
    const stack = [rootDir];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const children = fs.readdirSync(current, { withFileTypes: true });
      for (const child of children) {
        const fullPath = path.join(current, child.name);
        if (child.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (!child.isFile()) {
          continue;
        }

        const content = fs.readFileSync(fullPath);
        entries.push({
          relativePath: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
          size: content.length,
          sha256: crypto.createHash('sha256').update(content).digest('hex'),
        });
      }
    }

    return entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  }
}
