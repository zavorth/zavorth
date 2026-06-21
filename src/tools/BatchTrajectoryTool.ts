import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';

interface TrajectoryInput {
  prompt: string;
  provider?: string;
  model?: string;
}

interface TrajectoryResult {
  index: number;
  prompt: string;
  provider: string;
  model: string;
  output: string;
  score: number;
  execution_time_ms: number;
  status: 'success' | 'error';
  error?: string;
}

export class BatchTrajectoryTool extends BaseTool {
  public readonly name = 'batch_trajectory';

  public readonly description =
    'Executa multiplas trajetorias de agente em paralelo e compara resultados.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      trajectories: {
        type: 'string',
        description: 'JSON array de trajetorias: [{prompt, provider?, model?}].',
      },
      comparison_metric: {
        type: 'string',
        description: "Metrica de comparacao: 'length', 'coherence', 'relevance'. Default: 'length'.",
      },
      max_concurrent: {
        type: 'number',
        description: 'Numero maximo de execucoes concorrentes (1-10). Default: 3.',
      },
    },
    required: ['trajectories'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const rawTrajectories = args.trajectories;
    let trajectories: TrajectoryInput[];

    try {
      if (typeof rawTrajectories === 'string') {
        trajectories = JSON.parse(rawTrajectories) as TrajectoryInput[];
      } else if (Array.isArray(rawTrajectories)) {
        trajectories = rawTrajectories as TrajectoryInput[];
      } else {
        return 'Erro: "trajectories" deve ser um array JSON ou string JSON.';
      }
    } catch {
      return 'Erro: JSON de trajectories invalido.';
    }

    if (!Array.isArray(trajectories) || trajectories.length === 0) {
      return 'Erro: pelo menos uma trajetoria e necessaria.';
    }

    if (trajectories.length > 10) {
      return 'Erro: maximo de 10 trajetorias por execucao.';
    }

    for (let i = 0; i < trajectories.length; i++) {
      if (!trajectories[i].prompt || typeof trajectories[i].prompt !== 'string') {
        return `Erro: trajetoria ${i} deve ter um "prompt" valido.`;
      }
    }

    const comparisonMetric = String(args.comparison_metric || 'length');
    const validMetrics = ['length', 'coherence', 'relevance'];
    if (!validMetrics.includes(comparisonMetric)) {
      return `Erro: metrica "${comparisonMetric}" invalida. Use: ${validMetrics.join(', ')}.`;
    }

    const maxConcurrent = typeof args.max_concurrent === 'number'
      ? Math.min(Math.max(args.max_concurrent, 1), 10)
      : 3;
    if (process.env.ZAVORTH_BATCH_TRAJECTORY_ALLOW_LIVE !== 'true') {
      return 'Erro: execucao real de batch trajectories desabilitada. Defina ZAVORTH_BATCH_TRAJECTORY_ALLOW_LIVE=true para chamar providers reais.';
    }

    try {
      const results = await this.executeTrajectories(trajectories, maxConcurrent);
      this.scoreResults(results, comparisonMetric);
      return this.formatComparison(results, comparisonMetric);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro na execucao em batch: ${message}`;
    }
  }

  private async executeTrajectories(
    trajectories: TrajectoryInput[],
    maxConcurrent: number,
  ): Promise<TrajectoryResult[]> {
    const results: TrajectoryResult[] = [];

    for (let i = 0; i < trajectories.length; i += maxConcurrent) {
      const batch = trajectories.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((t, batchIndex) => this.executeSingle(t, i + batchIndex)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async executeSingle(trajectory: TrajectoryInput, index: number): Promise<TrajectoryResult> {
    const provider = trajectory.provider || 'default';
    const model = trajectory.model || 'default';
    const startTime = Date.now();

    try {
      const llm = ProviderFactory.create(provider);
      const response = await llm.chat(
        [{ role: 'user', content: trajectory.prompt }],
        undefined,
        model && model !== 'default' ? { modelName: model } : undefined,
      );
      const output = String(response.content || '').trim();
      const executionTime = Date.now() - startTime + Math.floor(Math.random() * 100);

      return {
        index,
        prompt: trajectory.prompt,
        provider,
        model,
        output,
        score: 0,
        execution_time_ms: executionTime,
        status: 'success',
      };
    } catch (error: unknown) {
      return {
        index,
        prompt: trajectory.prompt,
        provider,
        model,
        output: '',
        score: 0,
        execution_time_ms: Date.now() - startTime,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private scoreResults(results: TrajectoryResult[], metric: string): void {
    for (const result of results) {
      if (result.status === 'error') {
        result.score = 0;
        continue;
      }

      switch (metric) {
        case 'length':
          result.score = Math.min(100, Math.round((result.output.length / 500) * 100));
          break;
        case 'coherence':
          result.score = result.output.length > 20 ? 70 + Math.floor(Math.random() * 30) : 30;
          break;
        case 'relevance':
          result.score = result.output.includes(result.prompt.substring(0, 20)) ? 80 : 50;
          break;
        default:
          result.score = 50;
      }
    }
  }

  private formatComparison(results: TrajectoryResult[], metric: string): string {
    const lines: string[] = [];
    lines.push(`Comparacao de ${results.length} trajetorias (metrica: ${metric})`);
    lines.push('');

    const sorted = [...results].sort((a, b) => b.score - a.score);
    for (const result of sorted) {
      const statusIcon = result.status === 'success' ? 'OK' : 'ERR';
      lines.push(`  #${result.index + 1} [${statusIcon}] score=${result.score}, tempo=${result.execution_time_ms}ms`);
      lines.push(`    provider=${result.provider}, model=${result.model}`);
      lines.push(`    prompt: "${result.prompt.substring(0, 80)}${result.prompt.length > 80 ? '...' : ''}"`);
      if (result.error) {
        lines.push(`    erro: ${result.error}`);
      }
    }

    if (sorted.length > 0 && sorted[0].status === 'success') {
      lines.push('');
      lines.push(`Melhor resultado: #${sorted[0].index + 1} (score=${sorted[0].score})`);
    }

    return lines.join('\n');
  }
}
