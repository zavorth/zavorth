import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';
import {
PublishComparisonService,
  type PublishComparisonReport,
  type PublishSnapshotDescriptor,
} from './PublishComparisonService.js';

export type PublishHistoryEntry = {
  publishedAt?: string;
  branch?: string;
  commit?: string;
  archive?: {
    id?: string;
    targets?: {
      docs?: string;
      remoteConsole?: string;
    };
  };
  targets?: {
    docs?: {
      productionUrl?: string;
      deploymentUrl?: string;
    };
    remoteConsole?: {
      productionUrl?: string;
      deploymentUrl?: string;
    };
  };
};

export type PublishHistorySummary = {
  entry: PublishHistoryEntry;
  descriptor: PublishSnapshotDescriptor | null;
  index: number;
  comparisonToPrevious: PublishComparisonReport | null;
};

export class PublishHistoryService {
  constructor(
    private readonly projectRoot: string,
    private readonly comparisonService: PublishComparisonService = new PublishComparisonService(),
  ) {}

  public readHistory(historyPath: string): PublishHistoryEntry[] {
    if (!fs.existsSync(historyPath)) {
      return [];
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error: unknown) {logger.warn('[Publish History] JSON parse failed', error); return []; }
  }

  public resolveDescriptor(entry: PublishHistoryEntry): PublishSnapshotDescriptor | null {
    const archiveId = String(entry.archive?.id || '').trim();
    const docsRelative = String(entry.archive?.targets?.docs || '').trim();
    const remoteConsoleRelative = String(entry.archive?.targets?.remoteConsole || '').trim();
    if (!archiveId || !docsRelative || !remoteConsoleRelative) {
      return null;
    }

    return {
      id: archiveId,
      label: `${archiveId} (${String(entry.commit || '').slice(0, 8) || 'sem-commit'})`,
      commit: entry.commit || null,
      publishedAt: entry.publishedAt || null,
      docsPath: path.resolve(this.projectRoot, docsRelative),
      remoteConsolePath: path.resolve(this.projectRoot, remoteConsoleRelative),
    };
  }

  public summarize(entries: PublishHistoryEntry[], limit = 8): PublishHistorySummary[] {
    const sliced = entries.slice(0, limit);
    return sliced.map((entry, index) => {
      const descriptor = this.resolveDescriptor(entry);
      const previousDescriptor = this.resolveDescriptor(sliced[index + 1] || {});
      const comparisonToPrevious =
        descriptor && previousDescriptor
          ? this.comparisonService.compareSnapshots(previousDescriptor, descriptor)
          : null;

      return {
        entry,
        descriptor,
        index,
        comparisonToPrevious,
      };
    });
  }
}
