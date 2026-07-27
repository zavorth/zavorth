import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { AutoRepairReport } from './AutoRepairService.js';
import { logger } from '../logger.js';

export type AutoRepairIncidentMemoryEntry = {
  recordedAt: string;
  status: string;
  goal: string;
  reason: string;
  requestedBy: string;
  targetFile: string | null;
  domains: string[];
  plannerSummary: string | null;
  finalSummary: string;
  lastError: string | null;
  validationFailures: string[];
  bootstrapFailures: string[];
  warnings: string[];
};

type AutoRepairIncidentMemoryServiceOptions = {
  filePath?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class AutoRepairIncidentMemoryService {
  private readonly filePath: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(options: AutoRepairIncidentMemoryServiceOptions = {}) {
    this.filePath =
      options.filePath || path.resolve(config.operationalMemoryDir, 'autorepair-incidents.json');
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = options.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = options.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readEntries(): AutoRepairIncidentMemoryEntry[] {
    if (!this.existsSync(this.filePath)) {
      return [];
    }

    try {
      const parsed = JSON.parse(this.readFileSync(this.filePath, 'utf8')) as AutoRepairIncidentMemoryEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error: unknown) {logger.warn('[Auto Repair Incident Memory] JSON parse failed', error); return []; }
  }

  public recordRun(report: AutoRepairReport, domains: string[]): void {
    const entries = this.readEntries();
    const lastAttempt = report.attempts[report.attempts.length - 1];
    const validationFailures = report.attempts
      .flatMap((attempt) => attempt.validation || [])
      .filter((step) => step.status === 'failed')
      .map((step) => `${step.label}: ${String(step.output || '').trim()}`.trim())
      .filter(Boolean);
    const bootstrapFailures = report.bootstrapRepair.steps
      .filter((step) => step.status === 'failed')
      .map((step) => `${step.title}: ${String(step.error || step.output || '').trim()}`.trim())
      .filter(Boolean);

    const entry: AutoRepairIncidentMemoryEntry = {
      recordedAt: report.finishedAt || report.startedAt,
      status: report.status,
      goal: report.goal,
      reason: report.reason,
      requestedBy: report.requestedBy,
      targetFile: lastAttempt?.targetFile || report.planner?.targetFile || null,
      domains: Array.from(new Set(domains.filter(Boolean))),
      plannerSummary: report.planner?.summary || null,
      finalSummary: report.summary,
      lastError: lastAttempt?.error || null,
      validationFailures: validationFailures.slice(0, 8),
      bootstrapFailures: bootstrapFailures.slice(0, 6),
      warnings: report.warnings.slice(0, 8),
    };

    const nextEntries = [entry, ...entries].slice(0, 60);
    this.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.writeFileSync(this.filePath, JSON.stringify(nextEntries, null, 2), 'utf8');
  }

  public summarizeForPlanner(): string {
    const entries = this.readEntries();
    if (entries.length === 0) {
      return 'Auto-repair operational history: no persisted memory exists yet.';
    }

    const repeatedTargets = new Map<string, number>();
    const repeatedFailures = new Map<string, number>();

    for (const entry of entries) {
      if (entry.targetFile) {
        repeatedTargets.set(entry.targetFile, (repeatedTargets.get(entry.targetFile) || 0) + 1);
      }
      for (const failure of entry.validationFailures) {
        const label = failure.split(':')[0]?.trim() || failure;
        repeatedFailures.set(label, (repeatedFailures.get(label) || 0) + 1);
      }
    }

    const recentLines = entries.slice(0, 5).map((entry) => {
      const parts = [
        entry.recordedAt,
        entry.status,
        entry.targetFile || 'without-file',
        entry.lastError || entry.finalSummary,
      ];
      return `- ${parts.join(' | ')}`;
    });
    const topTargets = Array.from(repeatedTargets.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([target, count]) => `${target} (${count})`);
    const topFailures = Array.from(repeatedFailures.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([label, count]) => `${label} (${count})`);

    const lines = [
      'Historico operational recente do autorepair',
      `Registros: ${entries.length}.`,
      topTargets.length > 0 ? `Alvos recorrentes: ${topTargets.join(' | ')}.` : 'Alvos recorrentes: nenhum.',
      topFailures.length > 0 ? `Recurring failures: ${topFailures.join(' | ')}.` : 'Recurring failures: none.',
      'Latests incidentes:',
      ...recentLines,
    ];

    return lines.join('\n');
  }

  public summarizeForStatus(): string {
    const entries = this.readEntries();
    if (entries.length === 0) {
      return 'Operational memory: no persisted incidents yet.';
    }

    const latest = entries[0];
    const recurringTarget = this.findTopOccurrence(
      entries.map((entry) => entry.targetFile).filter((value): value is string => Boolean(value)),
    );
    const recurringFailure = this.findTopOccurrence(
      entries.flatMap((entry) =>
        entry.validationFailures.map((failure) => failure.split(':')[0]?.trim() || failure).filter(Boolean),
      ),
    );

    const parts = [
      `Operational memory: ${entries.length} registro(s).`,
      `Latest incident: ${latest?.status || 'n/d'} em ${latest?.targetFile || 'without-file'}.`,
    ];

    if (recurringTarget) {
      parts.push(`Alvo recorrente: ${recurringTarget.label} (${recurringTarget.count}).`);
    }

    if (recurringFailure) {
      parts.push(`Failure recorrente: ${recurringFailure.label} (${recurringFailure.count}).`);
    }

    return parts.join(' ');
  }

  private findTopOccurrence(values: string[]): { label: string; count: number } | null {
    if (values.length === 0) {
      return null;
    }

    const counts = new Map<string, number>();
    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }

    const [label, count] =
      Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0] || [];
    if (!label || !count) {
      return null;
    }

    return { label, count };
  }
}
