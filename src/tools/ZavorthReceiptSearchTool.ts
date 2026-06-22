import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

interface ReceiptEntry {
  id: string;
  timestamp: string;
  action: string;
  tool: string;
  args: Record<string, unknown>;
  result_summary: string;
  success: boolean;
  risk_level: string;
  approval_status: string;
  session_id: string;
  user: string;
  channel: string;
  duration_ms: number;
  metadata: Record<string, unknown>;
}

interface SearchFilters {
  query?: string;
  tool?: string;
  action?: string;
  session_id?: string;
  date_from?: string;
  date_to?: string;
  success?: boolean;
  risk_level?: string;
  approval_status?: string;
  channel?: string;
  user?: string;
  max_results: number;
  sort_by: string;
}

export class ZavorthReceiptSearchTool extends BaseTool {
  public readonly name = 'zavorth_receipt_search';

  public readonly description =
    'Busca e audita receipts (provas auditaveis) de acoes executadas pelo Zavorth. Cada acao do agente gera um receipt imutavel. Permite buscar por acao, tool, sessao, data, nivel de risco, status de aprovacao e mais. Funcionalidade unica do Zavorth para rastreabilidade total.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'search', 'get', 'stats', 'export', 'verify', 'list_tools', 'list_sessions'.",
      },
      receipt_id: {
        type: 'string',
        description: 'ID do receipt especifico (para get/verify).',
      },
      query: {
        type: 'string',
        description: 'Termo de busca nos receipts.',
      },
      tool: {
        type: 'string',
        description: 'Filtrar por tool que gerou o receipt.',
      },
      action_filter: {
        type: 'string',
        description: 'Filtrar por tipo de acao.',
      },
      session_id: {
        type: 'string',
        description: 'Filtrar por sessao.',
      },
      date_from: {
        type: 'string',
        description: 'Data inicial (ISO 8601).',
      },
      date_to: {
        type: 'string',
        description: 'Data final (ISO 8601).',
      },
      success: {
        type: 'boolean',
        description: 'Filtrar por sucesso (true) ou falha (false).',
      },
      risk_level: {
        type: 'string',
        description: "Filtrar por nivel de risco: 'low', 'medium', 'high', 'critical'.",
      },
      approval_status: {
        type: 'string',
        description: "Filtrar por status de aprovacao: 'auto_approved', 'pending', 'approved', 'denied'.",
      },
      channel: {
        type: 'string',
        description: 'Filtrar por canal de origem.',
      },
      user: {
        type: 'string',
        description: 'Filtrar por usuario.',
      },
      max_results: {
        type: 'number',
        description: 'Maximo de resultados. Default: 20.',
      },
      sort_by: {
        type: 'string',
        description: "Ordenacao: 'date_desc' (default), 'date_asc', 'risk_desc', 'tool'.",
      },
      export_format: {
        type: 'string',
        description: "Formato de export: 'json', 'csv', 'markdown'.",
      },
      output_path: {
        type: 'string',
        description: 'Caminho para salvar export.',
      },
    },
    required: ['action'],
  };

  private readonly receiptsDir: string;

  constructor(options?: { receiptsDir?: string }) {
    super();
    this.receiptsDir = options?.receiptsDir || path.join(process.cwd(), 'data', 'runtime', 'receipts');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Erro: o parametro "action" e obrigatorio.';

    const validActions = ['search', 'get', 'stats', 'export', 'verify', 'list_tools', 'list_sessions'];
    if (!validActions.includes(action)) {
      return `Erro: acao "${action}" invalida. Use: ${validActions.join(', ')}.`;
    }

    try {
      switch (action) {
        case 'search': return this.searchReceipts(args);
        case 'get': return this.getReceipt(args);
        case 'stats': return this.getStats(args);
        case 'export': return this.exportReceipts(args);
        case 'verify': return this.verifyReceipt(args);
        case 'list_tools': return this.listTools();
        case 'list_sessions': return this.listSessions();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro no ReceiptSearch: ${message}`;
    }
  }

  private searchReceipts(args: Record<string, unknown>): string {
    const filters: SearchFilters = {
      query: typeof args.query === 'string' ? args.query : undefined,
      tool: typeof args.tool === 'string' ? args.tool : undefined,
      action: typeof args.action_filter === 'string' ? args.action_filter : undefined,
      session_id: typeof args.session_id === 'string' ? args.session_id : undefined,
      date_from: typeof args.date_from === 'string' ? args.date_from : undefined,
      date_to: typeof args.date_to === 'string' ? args.date_to : undefined,
      success: typeof args.success === 'boolean' ? args.success : undefined,
      risk_level: typeof args.risk_level === 'string' ? args.risk_level : undefined,
      approval_status: typeof args.approval_status === 'string' ? args.approval_status : undefined,
      channel: typeof args.channel === 'string' ? args.channel : undefined,
      user: typeof args.user === 'string' ? args.user : undefined,
      max_results: typeof args.max_results === 'number' ? args.max_results : 20,
      sort_by: String(args.sort_by || 'date_desc'),
    };

    const allReceipts = this.loadAllReceipts();
    let filtered = this.applyFilters(allReceipts, filters);

    filtered = this.sortReceipts(filtered, filters.sort_by);
    filtered = filtered.slice(0, filters.max_results);

    if (filtered.length === 0) {
      return 'Nenhum receipt encontrado com os filtros especificados.';
    }

    const lines: string[] = [`Encontrados ${filtered.length} receipt(s):`];
    for (const receipt of filtered) {
      const icon = receipt.success ? '✅' : '❌';
      const risk = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[receipt.risk_level] || '⚪';
      const approval = { auto_approved: '⚡', pending: '⏳', approved: '✅', denied: '🚫' }[receipt.approval_status] || '❓';

      lines.push('');
      lines.push(`${icon} ${risk} ${approval} [${receipt.id}]`);
      lines.push(`  Tool: ${receipt.tool} | Acao: ${receipt.action}`);
      lines.push(`  Timestamp: ${receipt.timestamp}`);
      lines.push(`  Sessao: ${receipt.session_id} | Canal: ${receipt.channel} | User: ${receipt.user}`);
      lines.push(`  Risco: ${receipt.risk_level} | Aprovacao: ${receipt.approval_status} | Duracao: ${receipt.duration_ms}ms`);
      lines.push(`  Resultado: ${receipt.result_summary.slice(0, 120)}`);
    }

    return lines.join('\n');
  }

  private getReceipt(args: Record<string, unknown>): string {
    const receiptId = String(args.receipt_id || '');
    if (!receiptId) return 'Erro: "receipt_id" e obrigatorio.';

    const receipt = this.loadReceipt(receiptId);
    if (!receipt) return `Erro: receipt "${receiptId}" nao encontrado.`;

    const lines: string[] = [
      `Receipt: ${receipt.id}`,
      `  - Timestamp: ${receipt.timestamp}`,
      `  - Tool: ${receipt.tool}`,
      `  - Acao: ${receipt.action}`,
      `  - Args: ${JSON.stringify(receipt.args).slice(0, 200)}`,
      `  - Resultado: ${receipt.result_summary}`,
      `  - Sucesso: ${receipt.success ? 'Sim' : 'Nao'}`,
      `  - Nivel de risco: ${receipt.risk_level}`,
      `  - Aprovacao: ${receipt.approval_status}`,
      `  - Sessao: ${receipt.session_id}`,
      `  - Usuario: ${receipt.user}`,
      `  - Canal: ${receipt.channel}`,
      `  - Duracao: ${receipt.duration_ms}ms`,
    ];

    if (Object.keys(receipt.metadata).length > 0) {
      lines.push(`  - Metadata: ${JSON.stringify(receipt.metadata).slice(0, 200)}`);
    }

    return lines.join('\n');
  }

  private getStats(args: Record<string, unknown>): string {
    const dateFrom = typeof args.date_from === 'string' ? args.date_from : undefined;
    const dateTo = typeof args.date_to === 'string' ? args.date_to : undefined;

    let receipts = this.loadAllReceipts();

    if (dateFrom) receipts = receipts.filter((r) => r.timestamp >= dateFrom);
    if (dateTo) receipts = receipts.filter((r) => r.timestamp <= dateTo);

    if (receipts.length === 0) return 'Nenhum receipt encontrado para o periodo.';

    const byTool: Record<string, number> = {};
    const byRisk: Record<string, number> = {};
    const byApproval: Record<string, number> = {};
    let successCount = 0;
    let failCount = 0;
    let totalDuration = 0;

    for (const r of receipts) {
      byTool[r.tool] = (byTool[r.tool] || 0) + 1;
      byRisk[r.risk_level] = (byRisk[r.risk_level] || 0) + 1;
      byApproval[r.approval_status] = (byApproval[r.approval_status] || 0) + 1;
      if (r.success) successCount++; else failCount++;
      totalDuration += r.duration_ms;
    }

    const lines: string[] = [
      `Estatisticas de Receipts (${receipts.length} total):`,
      '',
      `Sucesso: ${successCount} (${((successCount / receipts.length) * 100).toFixed(1)}%)`,
      `Falha: ${failCount} (${((failCount / receipts.length) * 100).toFixed(1)}%)`,
      `Duracao media: ${(totalDuration / receipts.length).toFixed(0)}ms`,
      '',
      'Por Tool:',
      ...Object.entries(byTool).sort((a, b) => b[1] - a[1]).map(([tool, count]) => `  ${tool}: ${count}`),
      '',
      'Por Risco:',
      ...Object.entries(byRisk).map(([risk, count]) => `  ${risk}: ${count}`),
      '',
      'Por Aprovacao:',
      ...Object.entries(byApproval).map(([status, count]) => `  ${status}: ${count}`),
    ];

    return lines.join('\n');
  }

  private exportReceipts(args: Record<string, unknown>): string {
    const exportFormat = String(args.export_format || 'json');
    const outputPath = String(args.output_path || '');

    const filters: SearchFilters = {
      max_results: typeof args.max_results === 'number' ? args.max_results : 1000,
      sort_by: 'date_desc',
    };

    const receipts = this.applyFilters(this.loadAllReceipts(), filters);

    let output: string;
    switch (exportFormat) {
      case 'csv': {
        const csvEscape = (v: string) => {
          if (v.includes(',') || v.includes('"') || v.includes('\n')) {
            return '"' + v.replace(/"/g, '""') + '"';
          }
          return v;
        };
        const headers = ['id', 'timestamp', 'tool', 'action', 'success', 'risk_level', 'approval_status', 'session_id', 'user', 'channel', 'duration_ms', 'result_summary'];
        const rows = receipts.map((r) => headers.map((h) => csvEscape(String(r[h as keyof ReceiptEntry] || ''))).join(','));
        output = [headers.join(','), ...rows].join('\n');
        break;
      }
      case 'markdown': {
        const lines: string[] = ['# Receipts Export', '', `Total: ${receipts.length}`, ''];
        for (const r of receipts) {
          lines.push(`- **${r.id}** (${r.timestamp}) — ${r.tool}:${r.action} [${r.risk_level}] ${r.success ? '✅' : '❌'}`);
        }
        output = lines.join('\n');
        break;
      }
      case 'json':
      default:
        output = JSON.stringify(receipts, null, 2);
    }

    if (outputPath) {
      const dir = path.dirname(path.resolve(outputPath));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.resolve(outputPath), output, 'utf-8');
      return `Exportado ${receipts.length} receipts para ${outputPath} (formato: ${exportFormat}).`;
    }

    return `Export (${exportFormat}) com ${receipts.length} receipts:\n${output.slice(0, 2000)}`;
  }

  private verifyReceipt(args: Record<string, unknown>): string {
    const receiptId = String(args.receipt_id || '');
    if (!receiptId) return 'Erro: "receipt_id" e obrigatorio.';

    const receipt = this.loadReceipt(receiptId);
    if (!receipt) return `Erro: receipt "${receiptId}" nao encontrado.`;

    const checks: string[] = [];
    let allValid = true;

    if (receipt.id && receipt.timestamp && receipt.tool) {
      checks.push('✅ Campos obrigatorios presentes');
    } else {
      checks.push('❌ Campos obrigatorios ausentes');
      allValid = false;
    }

    try {
      new Date(receipt.timestamp).toISOString();
      checks.push('✅ Timestamp valido');
    } catch {
      checks.push('❌ Timestamp invalido');
      allValid = false;
    }

    const validRiskLevels = ['low', 'medium', 'high', 'critical'];
    if (validRiskLevels.includes(receipt.risk_level)) {
      checks.push('✅ Nivel de risco valido');
    } else {
      checks.push('❌ Nivel de risco invalido');
      allValid = false;
    }

    const validApprovalStatuses = ['auto_approved', 'pending', 'approved', 'denied'];
    if (validApprovalStatuses.includes(receipt.approval_status)) {
      checks.push('✅ Status de aprovacao valido');
    } else {
      checks.push('❌ Status de aprovacao invalido');
      allValid = false;
    }

    if (receipt.duration_ms >= 0) {
      checks.push('✅ Duracao valida');
    } else {
      checks.push('❌ Duracao invalida');
      allValid = false;
    }

    const lines: string[] = [
      `Verificacao do Receipt ${receiptId}:`,
      ...checks,
      `Resultado: ${allValid ? '✅ Receipt valido e integro' : '❌ Receipt com problemas de integridade'}`,
    ];

    return lines.join('\n');
  }

  private listTools(): string {
    const receipts = this.loadAllReceipts();
    const tools: Record<string, { count: number; last_used: string }> = {};

    for (const r of receipts) {
      if (!tools[r.tool]) {
        tools[r.tool] = { count: 0, last_used: r.timestamp };
      }
      tools[r.tool].count++;
      if (r.timestamp > tools[r.tool].last_used) {
        tools[r.tool].last_used = r.timestamp;
      }
    }

    const lines: string[] = [`Tools com receipts (${Object.keys(tools).length}):`];
    for (const [tool, info] of Object.entries(tools).sort((a, b) => b[1].count - a[1].count)) {
      lines.push(`  ${tool}: ${info.count} receipts (ultimo: ${info.last_used})`);
    }
    return lines.join('\n');
  }

  private listSessions(): string {
    const receipts = this.loadAllReceipts();
    const sessions: Record<string, { count: number; last_activity: string }> = {};

    for (const r of receipts) {
      if (!sessions[r.session_id]) {
        sessions[r.session_id] = { count: 0, last_activity: r.timestamp };
      }
      sessions[r.session_id].count++;
      if (r.timestamp > sessions[r.session_id].last_activity) {
        sessions[r.session_id].last_activity = r.timestamp;
      }
    }

    const lines: string[] = [`Sessoes com receipts (${Object.keys(sessions).length}):`];
    for (const [session, info] of Object.entries(sessions).sort((a, b) => b[1].count - a[1].count)) {
      lines.push(`  ${session}: ${info.count} receipts (ultimo: ${info.last_activity})`);
    }
    return lines.join('\n');
  }

  private loadAllReceipts(): ReceiptEntry[] {
    if (!fs.existsSync(this.receiptsDir)) return [];

    const receipts: ReceiptEntry[] = [];
    const files = this.listFilesRecursively(this.receiptsDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          receipts.push(...parsed);
        } else if (parsed.id) {
          receipts.push(parsed);
        }
      } catch {
        continue;
      }
    }

    return receipts;
  }

  private loadReceipt(receiptId: string): ReceiptEntry | null {
    if (!fs.existsSync(this.receiptsDir)) return null;

    const files = this.listFilesRecursively(this.receiptsDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          const found = parsed.find((r: ReceiptEntry) => r.id === receiptId);
          if (found) return found;
        } else if (parsed.id === receiptId) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private applyFilters(receipts: ReceiptEntry[], filters: SearchFilters): ReceiptEntry[] {
    return receipts.filter((r) => {
      if (filters.query) {
        const queryLower = filters.query.toLowerCase();
        const searchable = `${r.tool} ${r.action} ${r.result_summary} ${r.session_id} ${r.user}`.toLowerCase();
        if (!searchable.includes(queryLower)) return false;
      }
      if (filters.tool && r.tool !== filters.tool) return false;
      if (filters.action && r.action !== filters.action) return false;
      if (filters.session_id && r.session_id !== filters.session_id) return false;
      if (filters.date_from && r.timestamp < filters.date_from) return false;
      if (filters.date_to && r.timestamp > filters.date_to) return false;
      if (typeof filters.success === 'boolean' && r.success !== filters.success) return false;
      if (filters.risk_level && r.risk_level !== filters.risk_level) return false;
      if (filters.approval_status && r.approval_status !== filters.approval_status) return false;
      if (filters.channel && r.channel !== filters.channel) return false;
      if (filters.user && r.user !== filters.user) return false;
      return true;
    });
  }

  private sortReceipts(receipts: ReceiptEntry[], sortBy: string): ReceiptEntry[] {
    switch (sortBy) {
      case 'date_asc':
        return receipts.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      case 'risk_desc': {
        const riskOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return receipts.sort((a, b) => (riskOrder[b.risk_level] || 0) - (riskOrder[a.risk_level] || 0));
      }
      case 'tool':
        return receipts.sort((a, b) => a.tool.localeCompare(b.tool));
      case 'date_desc':
      default:
        return receipts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
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
