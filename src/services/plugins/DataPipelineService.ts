import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface PipelineStep {
  id: string;
  type: 'extract' | 'transform' | 'load' | 'filter' | 'aggregate' | 'join' | 'sort';
  config: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: unknown;
  error: string | null;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  status: 'idle' | 'running' | 'completed' | 'failed';
  created_at: string;
  last_run: string | null;
  run_count: number;
}

export class DataPipelineService {
  private readonly storageDir: string;
  private pipelines: Map<string, Pipeline> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'data-pipeline');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadPipelines();
  }

  private loadPipelines(): void {
    const p = path.join(this.storageDir, 'pipelines.json');
    if (!fs.existsSync(p)) return;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(data)) for (const pipeline of data) this.pipelines.set(pipeline.id, pipeline);
    } catch (error: any) { /* ignore */ logger.warn('[Data Pipeline] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'pipelines.json'), JSON.stringify(Array.from(this.pipelines.values()), null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public createPipeline(name: string, description: string): string {
    const id = `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.pipelines.set(id, {
      id, name, description, steps: [],
      status: 'idle', created_at: new Date().toISOString(),
      last_run: null, run_count: 0,
    });
    this.scheduleFlush();
    return `Pipeline "${name}" created (${id})`;
  }

  public addStep(pipelineId: string, type: PipelineStep['type'], config: Record<string, unknown>): string {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return `Error: pipeline "${pipelineId}" not found.`;
    const stepId = `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    pipeline.steps.push({
      id: stepId, type, config, status: 'pending', result: null, error: null,
    });
    this.scheduleFlush();
    return `Step "${type}" added to pipeline "${pipeline.name}"`;
  }

  public async runPipeline(pipelineId: string): Promise<string> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return `Error: pipeline "${pipelineId}" not found.`;

    pipeline.status = 'running';
    pipeline.last_run = new Date().toISOString();
    pipeline.run_count++;
    this.scheduleFlush();

    let currentData: unknown = null;

    for (const step of pipeline.steps) {
      step.status = 'running';
      try {
        currentData = await this.executeStep(step, currentData);
        step.status = 'completed';
        step.result = currentData;
      } catch (error: any) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : String(error);
        pipeline.status = 'failed';
        this.scheduleFlush();
        return `Pipeline failed at step "${step.type}": ${step.error}`;
      }
    }

    pipeline.status = 'completed';
    this.scheduleFlush();
    return `Pipeline "${pipeline.name}" completed successfully (${pipeline.steps.length} steps)`;
  }

  private async executeStep(step: PipelineStep, input: unknown): Promise<unknown> {
    switch (step.type) {
      case 'extract':
        return this.executeExtract(step.config);
      case 'transform':
        return this.executeTransform(step.config, input);
      case 'load':
        return this.executeLoad(step.config, input);
      case 'filter':
        return this.executeFilter(step.config, input);
      case 'aggregate':
        return this.executeAggregate(step.config, input);
      case 'sort':
        return this.executeSort(step.config, input);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async executeExtract(config: Record<string, unknown>): Promise<unknown> {
    const source = String(config.source || '');
    const format = String(config.format || 'json');

    if (!fs.existsSync(source)) throw new Error(`Source "${source}" not found.`);

    const content = fs.readFileSync(source, 'utf-8');
    switch (format) {
      case 'json': return JSON.parse(content);
      case 'csv': return this.parseCsv(content);
      case 'text': return content.split('\n');
      default: return content;
    }
  }

  private async executeTransform(config: Record<string, unknown>, input: unknown): Promise<unknown> {
    const operation = String(config.operation || '');
    const field = String(config.field || '');

    if (!Array.isArray(input)) return input;

    switch (operation) {
      case 'rename': {
        const from = String(config.from || '');
        const to = String(config.to || '');
        return input.map((item: Record<string, unknown>) => {
          if (from in item) {
            const { [from]: _, ...rest } = item;
            return { ...rest, [to]: item[from] };
          }
          return item;
        });
      }
      case 'add': {
        const value = config.value;
        return input.map((item: Record<string, unknown>) => ({ ...item, [field]: value }));
      }
      case 'remove': {
        return input.map((item: Record<string, unknown>) => {
          const { [field]: _, ...rest } = item;
          return rest;
        });
      }
      case 'compute': {
        const expression = String(config.expression || '');
        // Whitelist of safe operations only
        const safeOps: Record<string, (item: Record<string, unknown>) => unknown> = {
          'uppercase': (item) => String(item[field] || '').toUpperCase(),
          'lowercase': (item) => String(item[field] || '').toLowerCase(),
          'length': (item) => String(item[field] || '').length,
          'number': (item) => Number(item[field] || 0),
          'string': (item) => String(item[field] || ''),
          'abs': (item) => Math.abs(Number(item[field] || 0)),
          'round': (item) => Math.round(Number(item[field] || 0)),
        };
        const fn = safeOps[expression];
        if (!fn) throw new Error(`Unsafe expression "${expression}". Allowed: ${Object.keys(safeOps).join(', ')}`);
        return input.map((item: Record<string, unknown>) => ({ ...item, [field]: fn(item) }));
      }
      default:
        return input;
    }
  }

  private async executeLoad(config: Record<string, unknown>, input: unknown): Promise<unknown> {
    const destination = String(config.destination || '');
    const format = String(config.format || 'json');

    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let content: string;
    switch (format) {
      case 'json': content = JSON.stringify(input, null, 2); break;
      case 'csv': content = this.toCsv(input); break;
      case 'text': content = Array.isArray(input) ? input.join('\n') : String(input); break;
      default: content = JSON.stringify(input, null, 2);
    }

    fs.writeFileSync(destination, content, 'utf-8');
    return `Data written to ${destination}`;
  }

  private async executeFilter(config: Record<string, unknown>, input: unknown): Promise<unknown> {
    const field = String(config.field || '');
    const operator = String(config.operator || 'eq');
    const value = config.value;

    if (!Array.isArray(input)) return input;

    return input.filter((item: Record<string, unknown>) => {
      const itemValue = item[field];
      switch (operator) {
        case 'eq': return itemValue === value;
        case 'ne': return itemValue !== value;
        case 'gt': return Number(itemValue) > Number(value);
        case 'lt': return Number(itemValue) < Number(value);
        case 'gte': return Number(itemValue) >= Number(value);
        case 'lte': return Number(itemValue) <= Number(value);
        case 'contains': return String(itemValue).includes(String(value));
        default: return true;
      }
    });
  }

  private async executeAggregate(config: Record<string, unknown>, input: unknown): Promise<unknown> {
    const field = String(config.field || '');
    const operation = String(config.operation || 'count');

    if (!Array.isArray(input)) return input;

    switch (operation) {
      case 'count': return { count: input.length };
      case 'sum': return { sum: input.reduce((s: number, item: Record<string, unknown>) => s + Number(item[field] || 0), 0) };
      case 'avg': {
        const sum = input.reduce((s: number, item: Record<string, unknown>) => s + Number(item[field] || 0), 0);
        return { avg: sum / input.length };
      }
      case 'min': return { min: Math.min(...input.map((item: Record<string, unknown>) => Number(item[field] || 0))) };
      case 'max': return { max: Math.max(...input.map((item: Record<string, unknown>) => Number(item[field] || 0))) };
      case 'group': {
        const groups: Record<string, unknown[]> = {};
        for (const item of input) {
          const key = String((item as Record<string, unknown>)[field] || 'unknown');
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        }
        return groups;
      }
      default: return { count: input.length };
    }
  }

  private async executeSort(config: Record<string, unknown>, input: unknown): Promise<unknown> {
    const field = String(config.field || '');
    const order = String(config.order || 'asc');

    if (!Array.isArray(input)) return input;

    return [...input].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const va = String(a[field] ?? '');
      const vb = String(b[field] ?? '');
      const comparison = va < vb ? -1 : va > vb ? 1 : 0;
      return order === 'desc' ? -comparison : comparison;
    });
  }

  private parseCsv(content: string): Record<string, string>[] {
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => row[h] = values[i] || '');
      return row;
    });
  }

  private toCsv(data: unknown): string {
    if (!Array.isArray(data) || data.length === 0) return '';
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const rows = data.map((item: Record<string, unknown>) => headers.map((h) => String(item[h] || '')).join(','));
    return [headers.join(','), ...rows].join('\n');
  }

  public listPipelines(): string {
    if (this.pipelines.size === 0) return 'No pipelines.';
    const lines: string[] = ['Pipelines:'];
    for (const [, p] of this.pipelines) {
      const icon = { idle: '⏸️', running: '🔄', completed: '✅', failed: '❌' }[p.status];
      lines.push(`  ${icon} ${p.id}: ${p.name} (${p.steps.length} steps, ${p.run_count} runs)`);
    }
    return lines.join('\n');
  }

  public getPipeline(pipelineId: string): string {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return `Error: pipeline "${pipelineId}" not found.`;
    return [
      `Pipeline: ${pipeline.name}`,
      `  ID: ${pipeline.id}`,
      `  Description: ${pipeline.description}`,
      `  Status: ${pipeline.status}`,
      `  Steps: ${pipeline.steps.length}`,
      `  Runs: ${pipeline.run_count}`,
      `  Last run: ${pipeline.last_run || 'never'}`,
      '  Steps:',
      ...pipeline.steps.map((s) => `    ${s.id}: ${s.type} [${s.status}]`),
    ].join('\n');
  }

  public deletePipeline(pipelineId: string): string {
    if (!this.pipelines.has(pipelineId)) return `Error: pipeline "${pipelineId}" not found.`;
    this.pipelines.delete(pipelineId);
    this.scheduleFlush();
    return `Pipeline "${pipelineId}" deleted.`;
  }

  public getStats(): string {
    const pipelines = Array.from(this.pipelines.values());
    const totalSteps = pipelines.reduce((s, p) => s + p.steps.length, 0);
    const totalRuns = pipelines.reduce((s, p) => s + p.run_count, 0);
    return [
      'Data Pipeline Stats:',
      `  Pipelines: ${pipelines.length}`,
      `  Total steps: ${totalSteps}`,
      `  Total runs: ${totalRuns}`,
    ].join('\n');
  }
}
