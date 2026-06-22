import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

interface TrajectoryTurn {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown>; result?: string }>;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface Trajectory {
  id: string;
  session_id: string;
  task_description: string;
  turns: TrajectoryTurn[];
  outcome: 'success' | 'failure' | 'partial' | 'abandoned';
  total_turns: number;
  total_tool_calls: number;
  tools_used: string[];
  duration_ms: number;
  started_at: string;
  completed_at: string;
  metadata: Record<string, unknown>;
}

export class ZavorthTrajectoryExportTool extends BaseTool {
  public readonly name = 'zavorth_trajectory_export';

  public readonly description =
    'Exporta trajetorias de execucao do Zavorth para treinamento de modelos, pesquisa e analise. Suporta compressao, multiplos formatos (JSON, JSONL, CSV, Parquet, Markdown), filtragem e particionamento. Integrado ao BatchTrajectoryTool.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'list', 'export', 'compress', 'merge', 'stats', 'filter', 'convert'.",
      },
      trajectory_ids: {
        type: 'string',
        description: "JSON array de IDs de trajetorias para exportar. Ou 'all' para todas.",
      },
      session_id: {
        type: 'string',
        description: 'Filtrar por sessao.',
      },
      format: {
        type: 'string',
        description: "Formato de saida: 'json' (default), 'jsonl', 'csv', 'parquet', 'markdown', 'alpaca', 'sharegpt'.",
      },
      output_path: {
        type: 'string',
        description: 'Caminho do arquivo de saida.',
      },
      output_dir: {
        type: 'string',
        description: 'Diretorio de saida (para export multi-arquivo).',
      },
      compress: {
        type: 'boolean',
        description: 'Se true, comprime a saida (gzip). Default: false.',
      },
      compress_level: {
        type: 'number',
        description: 'Nivel de compressao (1-9). Default: 6.',
      },
      include_metadata: {
        type: 'boolean',
        description: 'Incluir metadata nas trajetorias. Default: true.',
      },
      include_system_messages: {
        type: 'boolean',
        description: 'Incluir mensagens do sistema. Default: false.',
      },
      include_tool_results: {
        type: 'boolean',
        description: 'Incluir resultados de tools. Default: true.',
      },
      max_turns: {
        type: 'number',
        description: 'Maximo de turnos por trajetoria. Default: sem limite.',
      },
      min_tool_calls: {
        type: 'number',
        description: 'Minimo de tool calls para incluir. Default: 0.',
      },
      outcome_filter: {
        type: 'string',
        description: "Filtrar por outcome: 'success', 'failure', 'partial', 'abandoned'.",
      },
      split_by: {
        type: 'string',
        description: "Particionar por: 'none' (default), 'session', 'outcome', 'date'.",
      },
      chunk_size: {
        type: 'number',
        description: 'Tamanho do chunk para JSONL (linhas por arquivo). Default: 1000.',
      },
    },
    required: ['action'],
  };

  private readonly trajectoriesDir: string;

  constructor(options?: { trajectoriesDir?: string }) {
    super();
    this.trajectoriesDir = options?.trajectoriesDir || path.join(process.cwd(), 'data', 'runtime', 'trajectories');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Erro: o parametro "action" e obrigatorio.';

    const validActions = ['list', 'export', 'compress', 'merge', 'stats', 'filter', 'convert'];
    if (!validActions.includes(action)) {
      return `Erro: acao "${action}" invalida. Use: ${validActions.join(', ')}.`;
    }

    try {
      switch (action) {
        case 'list': return this.listTrajectories(args);
        case 'export': return await this.exportTrajectories(args);
        case 'compress': return await this.compressTrajectories(args);
        case 'merge': return await this.mergeTrajectories(args);
        case 'stats': return this.getStats(args);
        case 'filter': return this.filterTrajectories(args);
        case 'convert': return await this.convertTrajectory(args);
      }
      return 'Erro interno.';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro no TrajectoryExport: ${message}`;
    }
  }

  private listTrajectories(args: Record<string, unknown>): string {
    const sessionId = typeof args.session_id === 'string' ? args.session_id : undefined;
    const trajectories = this.loadTrajectories();

    let filtered = trajectories;
    if (sessionId) {
      filtered = filtered.filter((t) => t.session_id === sessionId);
    }

    if (filtered.length === 0) return 'Nenhuma trajetoria encontrada.';

    const lines: string[] = [`Trajetorias (${filtered.length}):`];
    for (const t of filtered.slice(0, 30)) {
      const outcomeIcon = { success: '✅', failure: '❌', partial: '⚠️', abandoned: '🚫' }[t.outcome];
      lines.push(`  ${outcomeIcon} [${t.id}] ${t.task_description.slice(0, 60)} | ${t.total_turns} turnos | ${t.total_tool_calls} tools | ${t.outcome}`);
    }
    if (filtered.length > 30) {
      lines.push(`  ... e mais ${filtered.length - 30} trajetorias.`);
    }
    return lines.join('\n');
  }

  private async exportTrajectories(args: Record<string, unknown>): Promise<string> {
    const format = String(args.format || 'json');
    const outputPath = typeof args.output_path === 'string' ? args.output_path : undefined;
    const includeMetadata = args.include_metadata !== false;
    const includeSystem = args.include_system_messages === true;
    const includeToolResults = args.include_tool_results !== false;
    const maxTurns = typeof args.max_turns === 'number' ? args.max_turns : undefined;

    let trajectories = this.loadTrajectories();

    if (typeof args.session_id === 'string') {
      trajectories = trajectories.filter((t) => t.session_id === args.session_id);
    }

    if (typeof args.outcome_filter === 'string') {
      trajectories = trajectories.filter((t) => t.outcome === args.outcome_filter);
    }

    const minToolCalls = args.min_tool_calls;
    if (typeof minToolCalls === 'number') {
      trajectories = trajectories.filter((t) => t.total_tool_calls >= minToolCalls);
    }

    if (trajectories.length === 0) {
      return 'Nenhuma trajetoria encontrada para exportar.';
    }

    let output: string;
    let fileExtension: string;

    switch (format) {
      case 'jsonl': {
        const lines: string[] = [];
        for (const t of trajectories) {
          const processed = this.processTrajectory(t, { includeMetadata, includeSystem, includeToolResults, maxTurns });
          lines.push(JSON.stringify(processed));
        }
        output = lines.join('\n');
        fileExtension = '.jsonl';
        break;
      }
      case 'csv': {
        const headers = ['id', 'session_id', 'task_description', 'outcome', 'total_turns', 'total_tool_calls', 'tools_used', 'duration_ms', 'started_at', 'completed_at'];
        const rows = trajectories.map((t) => [
          t.id, t.session_id, `"${t.task_description.replace(/"/g, '""')}"`,
          t.outcome, t.total_turns, t.total_tool_calls,
          `"${t.tools_used.join(';')}"`, t.duration_ms, t.started_at, t.completed_at,
        ].join(','));
        output = [headers.join(','), ...rows].join('\n');
        fileExtension = '.csv';
        break;
      }
      case 'markdown': {
        const mdLines: string[] = ['# Trajetorias Exportadas', '', `Total: ${trajectories.length}`, ''];
        for (const t of trajectories) {
          const outcomeIcon = { success: '✅', failure: '❌', partial: '⚠️', abandoned: '🚫' }[t.outcome];
          mdLines.push(`## ${outcomeIcon} ${t.task_description}`);
          mdLines.push(`- **ID**: ${t.id}`);
          mdLines.push(`- **Outcome**: ${t.outcome}`);
          mdLines.push(`- **Turnos**: ${t.total_turns}`);
          mdLines.push(`- **Tools**: ${t.tools_used.join(', ')}`);
          mdLines.push('');
        }
        output = mdLines.join('\n');
        fileExtension = '.md';
        break;
      }
      case 'alpaca': {
        const alpacaData: Array<{ instruction: string; input: string; output: string }> = [];
        for (const t of trajectories) {
          const processed = this.processTrajectory(t, { includeMetadata, includeSystem, includeToolResults, maxTurns });
          for (let i = 0; i < processed.turns.length - 1; i++) {
            const turn = processed.turns[i];
            const nextTurn = processed.turns[i + 1];
            if (turn.role === 'user' && nextTurn.role === 'assistant') {
              alpacaData.push({
                instruction: turn.content,
                input: '',
                output: nextTurn.content,
              });
            }
          }
        }
        output = JSON.stringify(alpacaData, null, 2);
        fileExtension = '.json';
        break;
      }
      case 'sharegpt': {
        const sharegptData: Array<{ conversations: Array<{ from: string; value: string }> }> = [];
        for (const t of trajectories) {
          const processed = this.processTrajectory(t, { includeMetadata, includeSystem, includeToolResults, maxTurns });
          const conversations = processed.turns.map((turn) => ({
            from: turn.role === 'user' ? 'human' : turn.role === 'assistant' ? 'gpt' : turn.role,
            value: turn.content,
          }));
          sharegptData.push({ conversations });
        }
        output = JSON.stringify(sharegptData, null, 2);
        fileExtension = '.json';
        break;
      }
      case 'parquet':
        output = JSON.stringify(trajectories, null, 2);
        fileExtension = '.json';
        break;
      case 'json':
      default: {
        const processed = trajectories.map((t) => this.processTrajectory(t, { includeMetadata, includeSystem, includeToolResults, maxTurns }));
        output = JSON.stringify(processed, null, 2);
        fileExtension = '.json';
        break;
      }
    }

    const splitBy = String(args.split_by || 'none');

    if (splitBy !== 'none') {
      return this.splitExport(trajectories, output, splitBy, fileExtension, args);
    }

    if (outputPath) {
      const resolvedPath = path.resolve(outputPath);
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (args.compress === true) {
        return this.writeCompressed(resolvedPath, output, typeof args.compress_level === 'number' ? args.compress_level : 6);
      }

      fs.writeFileSync(resolvedPath, output, 'utf-8');
      return `Exportado ${trajectories.length} trajetorias para ${resolvedPath} (formato: ${format}). Tamanho: ${(output.length / 1024).toFixed(1)} KB.`;
    }

    return `Export (${format}) com ${trajectories.length} trajetorias:\n${output.slice(0, 3000)}${output.length > 3000 ? '\n...' : ''}`;
  }

  private async compressTrajectories(args: Record<string, unknown>): Promise<string> {
    const inputPath = String(args.output_path || '');
    if (!inputPath) return 'Erro: "output_path" e obrigatorio para compress.';

    const resolvedPath = path.resolve(inputPath);
    if (!fs.existsSync(resolvedPath)) return `Erro: arquivo "${inputPath}" nao encontrado.`;

    const level = typeof args.compress_level === 'number' ? args.compress_level : 6;
    return this.writeCompressed(resolvedPath, fs.readFileSync(resolvedPath, 'utf-8'), level);
  }

  private async mergeTrajectories(args: Record<string, unknown>): Promise<string> {
    const idsRaw = String(args.trajectory_ids || '[]');
    let ids: string[];
    try { ids = JSON.parse(idsRaw); } catch { return 'Erro: JSON de "trajectory_ids" invalido.'; }

    const trajectories = this.loadTrajectories().filter((t) => ids.includes(t.id));
    if (trajectories.length === 0) return 'Nenhuma trajetoria encontrada com os IDs fornecidos.';

    const merged: Trajectory = {
      id: `merged_${Date.now()}`,
      session_id: trajectories[0].session_id,
      task_description: `Merged: ${trajectories.map((t) => t.task_description).join(' | ')}`,
      turns: trajectories.flatMap((t) => t.turns),
      outcome: trajectories.every((t) => t.outcome === 'success') ? 'success' : 'partial',
      total_turns: trajectories.reduce((sum, t) => sum + t.total_turns, 0),
      total_tool_calls: trajectories.reduce((sum, t) => sum + t.total_tool_calls, 0),
      tools_used: [...new Set(trajectories.flatMap((t) => t.tools_used))],
      duration_ms: trajectories.reduce((sum, t) => sum + t.duration_ms, 0),
      started_at: trajectories[0].started_at,
      completed_at: trajectories[trajectories.length - 1].completed_at,
      metadata: { merged_from: ids },
    };

    const outputPath = typeof args.output_path === 'string' ? args.output_path : path.join(this.trajectoriesDir, `merged_${Date.now()}.json`);
    fs.writeFileSync(path.resolve(outputPath), JSON.stringify(merged, null, 2), 'utf-8');

    return `Merge de ${trajectories.length} trajetorias salvo em ${outputPath}. Total: ${merged.total_turns} turnos, ${merged.total_tool_calls} tool calls.`;
  }

  private getStats(args: Record<string, unknown>): string {
    const trajectories = this.loadTrajectories();

    if (trajectories.length === 0) return 'Nenhuma trajetoria encontrada.';

    const byOutcome: Record<string, number> = {};
    const byTool: Record<string, number> = {};
    let totalTurns = 0;
    let totalToolCalls = 0;
    let totalDuration = 0;

    for (const t of trajectories) {
      byOutcome[t.outcome] = (byOutcome[t.outcome] || 0) + 1;
      for (const tool of t.tools_used) {
        byTool[tool] = (byTool[tool] || 0) + 1;
      }
      totalTurns += t.total_turns;
      totalToolCalls += t.total_tool_calls;
      totalDuration += t.duration_ms;
    }

    const lines: string[] = [
      'Estatisticas de Trajetorias:',
      '',
      `Total: ${trajectories.length} trajetorias`,
      `Turnos totais: ${totalTurns} (media: ${(totalTurns / trajectories.length).toFixed(1)})`,
      `Tool calls totais: ${totalToolCalls} (media: ${(totalToolCalls / trajectories.length).toFixed(1)})`,
      `Duracao total: ${(totalDuration / 1000 / 60).toFixed(1)} min (media: ${(totalDuration / trajectories.length / 1000).toFixed(1)}s)`,
      '',
      'Por Outcome:',
      ...Object.entries(byOutcome).map(([outcome, count]) => `  ${outcome}: ${count} (${((count / trajectories.length) * 100).toFixed(1)}%)`),
      '',
      'Top Tools Usadas:',
      ...Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([tool, count]) => `  ${tool}: ${count}`),
    ];

    return lines.join('\n');
  }

  private filterTrajectories(args: Record<string, unknown>): string {
    const trajectories = this.loadTrajectories();
    let filtered = trajectories;

    if (typeof args.session_id === 'string') {
      filtered = filtered.filter((t) => t.session_id === args.session_id);
    }
    if (typeof args.outcome_filter === 'string') {
      filtered = filtered.filter((t) => t.outcome === args.outcome_filter);
    }
    const minToolCalls = args.min_tool_calls;
    if (typeof minToolCalls === 'number') {
      filtered = filtered.filter((t) => t.total_tool_calls >= minToolCalls);
    }

    return `Filtro aplicado: ${filtered.length} de ${trajectories.length} trajetorias selecionadas.`;
  }

  private async convertTrajectory(args: Record<string, unknown>): Promise<string> {
    const idsRaw = String(args.trajectory_ids || '[]');
    let ids: string[];
    try { ids = JSON.parse(idsRaw); } catch { return 'Erro: JSON de "trajectory_ids" invalido.'; }

    const trajectories = this.loadTrajectories().filter((t) => ids.includes(t.id));
    if (trajectories.length === 0) return 'Nenhuma trajetoria encontrada.';

    const format = String(args.format || 'alpaca');
    return this.exportTrajectories({ ...args, trajectory_ids: JSON.stringify(ids) });
  }

  private loadTrajectories(): Trajectory[] {
    if (!fs.existsSync(this.trajectoriesDir)) return [];

    const trajectories: Trajectory[] = [];
    const files = this.listFilesRecursively(this.trajectoriesDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          trajectories.push(...parsed);
        } else if (parsed.id) {
          trajectories.push(parsed);
        }
      } catch {
        continue;
      }
    }

    return trajectories;
  }

  private processTrajectory(
    trajectory: Trajectory,
    options: { includeMetadata: boolean; includeSystem: boolean; includeToolResults: boolean; maxTurns?: number },
  ): Trajectory {
    let turns = trajectory.turns;

    if (!options.includeSystem) {
      turns = turns.filter((t) => t.role !== 'system');
    }

    if (!options.includeToolResults) {
      turns = turns.map((t) => {
        if (t.role === 'tool') {
          return { ...t, content: '[tool result omitted]' };
        }
        return t;
      });
    }

    if (options.maxTurns) {
      turns = turns.slice(0, options.maxTurns);
    }

    return {
      ...trajectory,
      turns,
      metadata: options.includeMetadata ? trajectory.metadata : {},
    };
  }

  private splitExport(
    trajectories: Trajectory[],
    _output: string,
    splitBy: string,
    fileExtension: string,
    args: Record<string, unknown>,
  ): string {
    const outputDir = typeof args.output_dir === 'string' ? args.output_dir : path.join(this.trajectoriesDir, 'exports');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const groups: Record<string, Trajectory[]> = {};

    for (const t of trajectories) {
      let key: string;
      switch (splitBy) {
        case 'session': key = t.session_id; break;
        case 'outcome': key = t.outcome; break;
        case 'date': key = t.started_at.slice(0, 10); break;
        default: key = 'all';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }

    const files: string[] = [];
    for (const [key, group] of Object.entries(groups)) {
      const filePath = path.join(outputDir, `trajectories_${key}${fileExtension}`);
      fs.writeFileSync(filePath, JSON.stringify(group, null, 2), 'utf-8');
      files.push(filePath);
    }

    return `Export particionado por "${splitBy}": ${files.length} arquivo(s) criados em ${outputDir}.`;
  }

  private writeCompressed(filePath: string, content: string, level: number): string {
    const zlib = require('zlib');
    const compressed = zlib.gzipSync(Buffer.from(content, 'utf-8'), { level });
    fs.writeFileSync(`${filePath}.gz`, compressed);
    const originalSize = content.length;
    const compressedSize = compressed.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    return `Comprimido: ${filePath}.gz (${(originalSize / 1024).toFixed(1)}KB -> ${(compressedSize / 1024).toFixed(1)}KB, ${ratio}% reducao).`;
  }

  private listFilesRecursively(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.listFilesRecursively(fullPath));
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    } catch {
      // ignore
    }
    return results;
  }
}
