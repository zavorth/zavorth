import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { DesktopResourceSnapshot } from '../contracts/DesktopResourceContract.js';
import { compactDesktopResourceHistoryEntries } from '../core/MinimalDesktopResourceHistoryCompactor.js';
import { DesktopResourceClassifierService } from './DesktopResourceClassifierService.js';
import { DesktopResourceCollectorService } from './DesktopResourceCollectorService.js';
import { logger } from '../logger.js';

type DesktopResourcePlaneRuntime = {
  latestFilePath?: string;
  historyFilePath?: string;
  now?: () => Date;
  maxHistoryEntries?: number;
  collector?: Pick<DesktopResourceCollectorService, 'collect'>;
  classifier?: Pick<DesktopResourceClassifierService, 'buildSnapshot'>;
};

export class DesktopResourcePlaneService {
  private readonly latestFilePath: string;
  private readonly historyFilePath: string;
  private readonly now: () => Date;
  private readonly maxHistoryEntries: number;
  private readonly collector: Pick<DesktopResourceCollectorService, 'collect'>;
  private readonly classifier: Pick<DesktopResourceClassifierService, 'buildSnapshot'>;
  private lastSnapshot: DesktopResourceSnapshot | null = null;

  constructor(runtime: DesktopResourcePlaneRuntime = {}) {
    this.latestFilePath = runtime.latestFilePath || config.desktopResourceLatestFile;
    this.historyFilePath = runtime.historyFilePath || config.desktopResourceHistoryFile;
    this.now = runtime.now || (() => new Date());
    this.maxHistoryEntries = Math.max(10, Number(runtime.maxHistoryEntries || config.desktopResourceHistoryMaxEntries || 60) || 60);
    this.collector = runtime.collector || new DesktopResourceCollectorService();
    this.classifier = runtime.classifier || new DesktopResourceClassifierService();
  }

  public async inspectLive(
    options: {
      preferCachedWithinMs?: number;
    } = {},
  ): Promise<DesktopResourceSnapshot> {
    const preferCachedWithinMs = Math.max(0, Number(options.preferCachedWithinMs || 0) || 0);
    const cached = this.readLatest();
    if (cached && preferCachedWithinMs > 0) {
      const ageMs = Math.max(0, this.now().getTime() - new Date(cached.generatedAt).getTime());
      if (Number.isFinite(ageMs) && ageMs <= preferCachedWithinMs) {
        this.lastSnapshot = cached;
        return cached;
      }
    }

    const collection = await this.collector.collect();
    const snapshot = this.classifier.buildSnapshot(collection);
    this.persistSnapshot(snapshot);
    this.lastSnapshot = snapshot;
    return snapshot;
  }

  public readLatest(): DesktopResourceSnapshot | null {
    if (this.lastSnapshot) {
      return this.lastSnapshot;
    }
    if (!fs.existsSync(this.latestFilePath)) {
      return null;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.latestFilePath, 'utf8')) as DesktopResourceSnapshot;
      this.lastSnapshot = parsed;
      return parsed;
    } catch (error: unknown) {logger.warn('[Desktop Resource Plane] JSON parse failed', error); return null; }
  }

  public renderReport(snapshot: DesktopResourceSnapshot): string {
    const lines = [
      'Desktop Resource Plane',
      '',
      `Host: memoria ${snapshot.host.usedPhysicalMemoryMb}/${snapshot.host.totalVisibleMemoryMb} MB | carga ${snapshot.host.memoryLoadPercent ?? 'n/d'}% | postura ${snapshot.host.pressure}.`,
      `Totais: zavorth ${snapshot.totals.zavorthMemoryMb} MB | companions ${snapshot.totals.companionMemoryMb} MB | externos ${snapshot.totals.externalMemoryMb} MB.`,
      '',
      'Grupos em destaque:',
    ];

    for (const group of snapshot.groups.slice(0, 6)) {
      lines.push(
        `- ${group.label}: ${group.metrics.workingSetMb} MB | ${group.pressure} | ${group.summary}`,
      );
      if (group.actions.length > 0) {
        const actionPreview = group.actions
          .slice(0, 2)
          .map((action) => `${action.label}${action.requiresApproval ? ' (approval)' : ''}`)
          .join(', ');
        lines.push(`  Acoes: ${actionPreview}`);
      }
    }

    if (snapshot.topConsumers.length > 0) {
      lines.push('', 'Top processos:');
      for (const item of snapshot.topConsumers.slice(0, 6)) {
        lines.push(`- ${item.label}: ${item.metrics.workingSetMb} MB | ${item.summary}`);
      }
    }

    if (snapshot.recommendations.length > 0) {
      lines.push('', 'Recomendacoes:');
      for (const recommendation of snapshot.recommendations.slice(0, 5)) {
        lines.push(`- ${recommendation}`);
      }
    }

    if (snapshot.warnings.length > 0) {
      lines.push('', 'Alertas:');
      for (const warning of snapshot.warnings.slice(0, 5)) {
        lines.push(`- ${warning}`);
      }
    }

    return lines.join('\n');
  }

  private persistSnapshot(snapshot: DesktopResourceSnapshot): void {
    fs.mkdirSync(path.dirname(this.latestFilePath), { recursive: true });
    fs.writeFileSync(this.latestFilePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

    fs.mkdirSync(path.dirname(this.historyFilePath), { recursive: true });
    const existing = this.readHistoryEntries();
    existing.push(snapshot);
    const trimmed = existing.slice(-this.maxHistoryEntries);
    const compacted = compactDesktopResourceHistoryEntries(trimmed, {
      now: this.now,
      policy: {
        keepFullSnapshots: Math.min(2, this.maxHistoryEntries),
      },
    });
    fs.writeFileSync(this.historyFilePath, `${compacted.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');
  }

  private readHistoryEntries(): unknown[] {
    if (!fs.existsSync(this.historyFilePath)) {
      return [];
    }
    const entries: unknown[] = [];
    for (const line of fs.readFileSync(this.historyFilePath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        entries.push(JSON.parse(trimmed));
      } catch (error: unknown) {// Corrupted history lines are ignored on the next successful snapshot write.
      logger.warn('[Desktop Resource Plane] JSON parse failed', error);
    }
    }
    return entries;
  }
}
