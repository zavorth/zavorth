
import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

interface SkillMetric {
  skill_name: string;
  rating: number;
  notes: string;
  execution_time_ms: number;
  recorded_at: string;
}

interface SkillMetricsFile {
  skill_name: string;
  metrics: SkillMetric[];
  average_rating: number;
  average_execution_time_ms: number;
  total_executions: number;
  last_updated: string;
}

export class SkillFeedbackCollectorTool extends BaseTool {
  public readonly name = 'skill_feedback';

  public readonly description =
    'Collects skill execution feedback for continuous self-improvement.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      skill_name: {
        type: 'string',
        description: 'Nome da skill.',
      },
      action: {
        type: 'string',
        description: "Acao: 'record', 'review', 'optimize'.",
      },
      rating: {
        type: 'number',
        description: 'Rating from 1 to 5 (only for action=record).',
      },
      notes: {
        type: 'string',
        description: 'Notes about execution.',
      },
      execution_time_ms: {
        type: 'number',
        description: 'Execution time in milliseconds.',
      },
    },
    required: ['skill_name'],
  };

  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'skill-metrics');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const skillName = String(args.skill_name || '');
    if (!skillName) {
      return 'Error: the "skill_name" parameter is required.';
    }

    const action = String(args.action || 'record');
    const validActions = ['record', 'review', 'optimize'];
    if (!validActions.includes(action)) {
      return `Error: invalid action "${action}" is invalid. Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'record':
          return this.recordMetric(args, skillName);
        case 'review':
          return this.reviewMetrics(skillName);
        case 'optimize':
          return this.optimizeSuggestion(skillName);
        default:
          return `Error: action "${action}" is not implemented.`;
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Skill Feedback Collector] operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Skill feedback error: ${message}`;
  }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private metricsPath(skillName: string): string {
    const safeName = skillName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storageDir, `${safeName}.json`);
  }

  private loadMetrics(skillName: string): SkillMetricsFile {
    const filePath = this.metricsPath(skillName);
    if (!fs.existsSync(filePath)) {
      return {
        skill_name: skillName,
        metrics: [],
        average_rating: 0,
        average_execution_time_ms: 0,
        total_executions: 0,
        last_updated: new Date().toISOString(),
      };
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SkillMetricsFile;
  }

  private saveMetrics(data: SkillMetricsFile): void {
    fs.writeFileSync(this.metricsPath(data.skill_name), JSON.stringify(data, null, 2), 'utf-8');
  }

  private recordMetric(args: Record<string, unknown>, skillName: string): string {
    const rating = typeof args.rating === 'number' ? args.rating : 3;
    if (rating < 1 || rating > 5) {
      return 'Error: rating deve estar entre 1 e 5.';
    }

    const executionTimeMs = typeof args.execution_time_ms === 'number' ? args.execution_time_ms : 0;
    const notes = typeof args.notes === 'string' ? args.notes : '';

    const data = this.loadMetrics(skillName);
    const metric: SkillMetric = {
      skill_name: skillName,
      rating,
      notes,
      execution_time_ms: executionTimeMs,
      recorded_at: new Date().toISOString(),
    };

    data.metrics.push(metric);
    data.total_executions = data.metrics.length;
    data.average_rating = data.metrics.reduce((sum, m) => sum + m.rating, 0) / data.metrics.length;
    data.average_execution_time_ms = data.metrics.reduce((sum, m) => sum + m.execution_time_ms, 0) / data.metrics.length;
    data.last_updated = new Date().toISOString();

    this.saveMetrics(data);
    return `Feedback registrado para skill "${skillName}": rating=${rating}, tempo=${executionTimeMs}ms.`;
  }

  private reviewMetrics(skillName: string): string {
    const data = this.loadMetrics(skillName);
    if (data.metrics.length === 0) {
      return `No metrics recorded for skill "${skillName}".`;
    }

    const lines: string[] = [];
    lines.push(`Metricas da skill: ${skillName}`);
    lines.push(`  - Total de execucoes: ${data.total_executions}`);
    lines.push(`  - Rating medio: ${data.average_rating.toFixed(2)}`);
    lines.push(`  - Average execution time: ${data.average_execution_time_ms.toFixed(0)}ms`);
    lines.push(`  - Ultimo registro: ${data.last_updated}`);

    const recentMetrics = data.metrics.slice(-5);
    lines.push(`\nUltimas ${recentMetrics.length} execucoes:`);
    for (const m of recentMetrics) {
      lines.push(`  - [${m.recorded_at}] rating=${m.rating}, tempo=${m.execution_time_ms}ms${m.notes ? `, notas: ${m.notes}` : ''}`);
    }

    return lines.join('\n');
  }

  private optimizeSuggestion(skillName: string): string {
    const data = this.loadMetrics(skillName);
    if (data.metrics.length < 3) {
      return `Insufficient data to optimize skill "${skillName}". At least 3 runs required.`;
    }

    const lines: string[] = [];
    lines.push(`Optimization suggestions for skill: ${skillName}`);
    lines.push('');

    if (data.average_rating < 3) {
      lines.push('- ALERTA: Rating medio abaixo de 3. Revisar logica principal da skill.');
    } else if (data.average_rating < 4) {
      lines.push('- Rating medio moderado. Considerar melhorias incrementais.');
    } else {
      lines.push('- Rating medio alto. Skill esta performando bem.');
    }

    if (data.average_execution_time_ms > 10000) {
      lines.push('- High average execution time (>10s). Consider caching or I/O optimization.');
    } else if (data.average_execution_time_ms > 5000) {
      lines.push('- Moderate average execution time (>5s). Monitor trend.');
    }

    const recentRatings = data.metrics.slice(-5).map((m) => m.rating);
    const isDeclining = recentRatings.every((r, i) => i === 0 || r <= recentRatings[i - 1]);
    if (isDeclining && recentRatings.length >= 3) {
      lines.push('- ALERTA: Tendencia de queda nas avaliacoes recentes. Investigar regressoes.');
    }

    const lowRatingNotes = data.metrics.filter((m) => m.rating <= 2 && m.notes).map((m) => m.notes);
    if (lowRatingNotes.length > 0) {
      lines.push(`\nNotes from low-rated runs (${lowRatingNotes.length}):`);
      for (const note of lowRatingNotes.slice(0, 3)) {
        lines.push(`  - ${note}`);
      }
    }

    return lines.join('\n');
  }
}
