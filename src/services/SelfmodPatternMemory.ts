import fs from 'fs';
import path from 'path';
import type {
  SelfmodOptimizationAnalysis,
  SelfmodPatternMemoryEntry,
  SelfmodPatternMemorySnapshot,
  SelfmodPatternSignal,
} from '../contracts/SelfmodOptimizationContract.js';

export class SelfmodPatternMemory {
  private readonly filePath: string;
  private readonly maxEntries: number;

  constructor(options: { filePath: string; maxEntries?: number }) {
    this.filePath = options.filePath;
    this.maxEntries = Math.max(8, Number(options.maxEntries || 40));
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
  }

  public rememberPreview(input: {
    goal: string;
    relativePaths: string[];
    analysis: SelfmodOptimizationAnalysis;
  }): void {
    this.updateEntry(input, (entry) => {
      entry.previewCount += 1;
      entry.averageRollbackConfidence = this.recomputeAverageRollbackConfidence(
        entry.averageRollbackConfidence,
        entry.previewCount,
        input.analysis.rollbackConfidence,
      );
      entry.lastRuntimeRiskLevel = input.analysis.runtimeRisk.level;
    });
  }

  public rememberApply(input: {
    goal: string;
    relativePaths: string[];
    analysis?: SelfmodOptimizationAnalysis | null;
  }): void {
    this.updateEntry(input, (entry) => {
      entry.applyCount += 1;
      if (input.analysis) {
        entry.lastRuntimeRiskLevel = input.analysis.runtimeRisk.level;
        entry.averageRollbackConfidence = this.recomputeAverageRollbackConfidence(
          entry.averageRollbackConfidence,
          Math.max(1, entry.previewCount),
          input.analysis.rollbackConfidence,
        );
      }
    });
  }

  public rememberRollback(input: {
    goal: string;
    relativePaths: string[];
    analysis?: SelfmodOptimizationAnalysis | null;
  }): void {
    this.updateEntry(input, (entry) => {
      entry.rollbackCount += 1;
      if (input.analysis) {
        entry.lastRuntimeRiskLevel = input.analysis.runtimeRisk.level;
      }
    });
  }

  public summarizeSignals(input: {
    goal: string;
    relativePaths: string[];
  }): SelfmodPatternSignal[] {
    const snapshot = this.readSnapshot();
    const relevant = snapshot.entries
      .filter((entry) => this.overlaps(entry.pathSignature, input.relativePaths))
      .sort((left, right) => right.previewCount - left.previewCount)
      .slice(0, 3);

    const signals: SelfmodPatternSignal[] = [];
    for (const entry of relevant) {
      if (entry.rollbackCount > 0) {
        signals.push({
          key: `${entry.key}:rollback`,
          strength: entry.rollbackCount >= 2 ? 'high' : 'medium',
          summary: `Padrao parecido ja precisou de rollback ${entry.rollbackCount} vez(es).`,
        });
      }
      if (entry.previewCount >= 2) {
        signals.push({
          key: `${entry.key}:repeat`,
          strength: entry.previewCount >= 4 ? 'high' : 'low',
          summary: `Mudancas parecidas ja apareceram ${entry.previewCount} vez(es) no selfmod.`,
        });
      }
      if (entry.averageRollbackConfidence < 0.65) {
        signals.push({
          key: `${entry.key}:confidence`,
          strength: 'medium',
          summary: `Historico parecido teve confianca media de rollback em ${Math.round(entry.averageRollbackConfidence * 100)}%.`,
        });
      }
    }

    return signals.slice(0, 4);
  }

  private updateEntry(
    input: {
      goal: string;
      relativePaths: string[];
      analysis?: SelfmodOptimizationAnalysis | null;
    },
    mutate: (entry: SelfmodPatternMemoryEntry) => void,
  ): void {
    const snapshot = this.readSnapshot();
    const key = this.buildKey(input.relativePaths);
    const normalizedPaths = this.buildPathSignature(input.relativePaths);
    const now = new Date().toISOString();
    const existing = snapshot.entries.find((entry) => entry.key === key);
    const entry: SelfmodPatternMemoryEntry = existing || {
      key,
      goalSample: String(input.goal || '').trim().slice(0, 180) || 'selfmod goal',
      pathSignature: normalizedPaths,
      previewCount: 0,
      applyCount: 0,
      rollbackCount: 0,
      averageRollbackConfidence: input.analysis?.rollbackConfidence || 0.8,
      lastRuntimeRiskLevel: input.analysis?.runtimeRisk.level || 'low',
      lastSeenAt: now,
    };
    entry.goalSample = entry.goalSample || (String(input.goal || '').trim().slice(0, 180) || 'selfmod goal');
    entry.pathSignature = normalizedPaths;
    entry.lastSeenAt = now;
    mutate(entry);

    const nextEntries = [
      entry,
      ...snapshot.entries.filter((candidate) => candidate.key !== key),
    ].slice(0, this.maxEntries);

    this.writeSnapshot({
      updatedAt: now,
      entries: nextEntries,
    });
  }

  private readSnapshot(): SelfmodPatternMemorySnapshot {
    if (!fs.existsSync(this.filePath)) {
      return {
        updatedAt: new Date().toISOString(),
        entries: [],
      };
    }

    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as SelfmodPatternMemorySnapshot;
    } catch {
      return {
        updatedAt: new Date().toISOString(),
        entries: [],
      };
    }
  }

  private writeSnapshot(snapshot: SelfmodPatternMemorySnapshot): void {
    fs.writeFileSync(this.filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  private buildKey(relativePaths: string[]): string {
    return this.buildPathSignature(relativePaths).join('|') || 'selfmod:misc';
  }

  private buildPathSignature(relativePaths: string[]): string[] {
    return Array.from(new Set(relativePaths
      .map((entry) => String(entry || '').trim().replace(/\\/g, '/'))
      .filter(Boolean)
      .map((entry) => entry.split('/').slice(0, 2).join('/'))))
      .sort();
  }

  private overlaps(storedSignature: string[], relativePaths: string[]): boolean {
    const current = new Set(this.buildPathSignature(relativePaths));
    return storedSignature.some((entry) => current.has(entry));
  }

  private recomputeAverageRollbackConfidence(
    currentAverage: number,
    sampleCount: number,
    newValue: number,
  ): number {
    if (sampleCount <= 1) {
      return newValue;
    }
    return ((currentAverage * (sampleCount - 1)) + newValue) / sampleCount;
  }
}
