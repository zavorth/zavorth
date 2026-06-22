import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

interface DelegatedTask {
  id: string;
  task_description: string;
  role: 'orchestrator' | 'leaf' | 'researcher' | 'executor' | 'reviewer';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  parent_id: string | null;
  children_ids: string[];
  result: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  timeout_ms: number;
  max_depth: number;
  current_depth: number;
  batch_id: string | null;
  context: Record<string, unknown>;
}

export class ZavorthDelegateTool extends BaseTool {
  public readonly name = 'zavorth_delegate';

  public readonly description =
    'Delega tarefas para subagentes governados com suporte a execucao em batch paralelo, roles hierarquicas, profundidade maxima e integracao com approval do Zavorth.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'delegate', 'delegate_batch', 'list', 'status', 'cancel', 'result', 'cancel_batch'.",
      },
      task_id: {
        type: 'string',
        description: 'ID da tarefa delegada (para status, cancel, result).',
      },
      batch_id: {
        type: 'string',
        description: 'ID do batch (para cancel_batch).',
      },
      task_description: {
        type: 'string',
        description: 'Descricao da tarefa para o subagente executar.',
      },
      tasks: {
        type: 'string',
        description: "JSON array de tarefas para batch: [{task_description, role?, context?}].",
      },
      role: {
        type: 'string',
        description: "Role do subagente: 'orchestrator', 'leaf', 'researcher', 'executor', 'reviewer'. Default: 'leaf'.",
      },
      parent_id: {
        type: 'string',
        description: 'ID da tarefa pai (para delegacao hierarquica).',
      },
      timeout_ms: {
        type: 'number',
        description: 'Timeout em milissegundos. Default: 300000 (5 min).',
      },
      max_depth: {
        type: 'number',
        description: 'Profundidade maxima de delegacao. Default: 3.',
      },
      context: {
        type: 'string',
        description: 'JSON com contexto adicional para o subagente.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'delegation');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Erro: o parametro "action" e obrigatorio.';

    const validActions = ['delegate', 'delegate_batch', 'list', 'status', 'cancel', 'result', 'cancel_batch'];
    if (!validActions.includes(action)) {
      return `Erro: acao "${action}" invalida. Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'delegate': return this.delegate(args);
        case 'delegate_batch': return this.delegateBatch(args);
        case 'list': return this.listTasks();
        case 'status': return this.taskStatus(args);
        case 'cancel': return this.cancelTask(args);
        case 'result': return this.taskResult(args);
        case 'cancel_batch': return this.cancelBatch(args);
      }
      return 'Erro interno.';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro no Delegate: ${message}`;
    }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private taskPath(taskId: string): string {
    return path.join(this.storageDir, `${taskId}.json`);
  }

  private loadTask(taskId: string): DelegatedTask | null {
    const filePath = this.taskPath(taskId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DelegatedTask;
  }

  private saveTask(task: DelegatedTask): void {
    fs.writeFileSync(this.taskPath(task.id), JSON.stringify(task, null, 2), 'utf-8');
  }

  private listAllTaskIds(): string[] {
    if (!fs.existsSync(this.storageDir)) return [];
    return fs.readdirSync(this.storageDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  }

  private generateTaskId(): string {
    return `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private delegate(args: Record<string, unknown>): string {
    const taskDescription = String(args.task_description || '');
    if (!taskDescription) return 'Erro: "task_description" e obrigatorio.';

    const role = String(args.role || 'leaf') as DelegatedTask['role'];
    const validRoles = ['orchestrator', 'leaf', 'researcher', 'executor', 'reviewer'];
    if (!validRoles.includes(role)) {
      return `Erro: role "${role}" invalido. Use: ${validRoles.join(', ')}.`;
    }

    const parentId = typeof args.parent_id === 'string' ? args.parent_id : null;
    const maxDepth = typeof args.max_depth === 'number' ? args.max_depth : 3;
    const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : 300000;

    let currentDepth = 0;
    if (parentId) {
      const parent = this.loadTask(parentId);
      if (!parent) return `Erro: tarefa pai "${parentId}" nao encontrada.`;
      currentDepth = parent.current_depth + 1;
      if (currentDepth > maxDepth) {
        return `Erro: profundidade maxima (${maxDepth}) atingida. Tarefa pai: ${parentId} (depth ${parent.current_depth}).`;
      }
    }

    let context: Record<string, unknown> = {};
    if (typeof args.context === 'string') {
      try { context = JSON.parse(args.context); } catch { /* ignore */ }
    } else if (typeof args.context === 'object' && args.context !== null) {
      context = args.context as Record<string, unknown>;
    }

    const taskId = this.generateTaskId();
    const task: DelegatedTask = {
      id: taskId,
      task_description: taskDescription,
      role,
      status: 'pending',
      parent_id: parentId,
      children_ids: [],
      result: null,
      error: null,
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      timeout_ms: timeoutMs,
      max_depth: maxDepth,
      current_depth: currentDepth,
      batch_id: null,
      context,
    };

    if (parentId) {
      const parent = this.loadTask(parentId);
      if (parent) {
        parent.children_ids.push(taskId);
        this.saveTask(parent);
      }
    }

    this.saveTask(task);

    const lines: string[] = [
      `Tarefa delegada criada.`,
      `  - ID: ${taskId}`,
      `  - Role: ${role}`,
      `  - Descricao: ${taskDescription.slice(0, 80)}${taskDescription.length > 80 ? '...' : ''}`,
      `  - Profundidade: ${currentDepth}/${maxDepth}`,
      `  - Timeout: ${timeoutMs}ms`,
      parentId ? `  - Pai: ${parentId}` : `  - Raiz (sem pai)`,
    ];
    return lines.join('\n');
  }

  private delegateBatch(args: Record<string, unknown>): string {
    const tasksJson = String(args.tasks || '');
    if (!tasksJson) return 'Erro: "tasks" e obrigatorio (JSON array).';

    let tasks: Array<{ task_description: string; role?: string; context?: Record<string, unknown> }>;
    try {
      tasks = JSON.parse(tasksJson);
    } catch {
      return 'Erro: JSON de "tasks" invalido.';
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return 'Erro: "tasks" deve ser um array nao vazio.';
    }

    if (tasks.length > 20) {
      return 'Erro: maximo de 20 tarefas por batch.';
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const taskIds: string[] = [];

    for (const t of tasks) {
      if (!t.task_description) continue;

      const validRoles = ['orchestrator', 'leaf', 'researcher', 'executor', 'reviewer'];
      const taskRole = (t.role as DelegatedTask['role']) || 'leaf';
      if (!validRoles.includes(taskRole)) continue;

      const taskId = this.generateTaskId();
      const task: DelegatedTask = {
        id: taskId,
        task_description: t.task_description,
        role: taskRole,
        status: 'pending',
        parent_id: null,
        children_ids: [],
        result: null,
        error: null,
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        timeout_ms: typeof args.timeout_ms === 'number' ? args.timeout_ms : 300000,
        max_depth: typeof args.max_depth === 'number' ? args.max_depth : 3,
        current_depth: 0,
        batch_id: batchId,
        context: t.context || {},
      };
      this.saveTask(task);
      taskIds.push(taskId);
    }

    const lines: string[] = [
      `Batch "${batchId}" criado com ${taskIds.length} tarefas.`,
      `  - IDs: ${taskIds.join(', ')}`,
      `  - Parallelismo: ${taskIds.length} subagentes simultaneos`,
    ];
    return lines.join('\n');
  }

  private listTasks(): string {
    const taskIds = this.listAllTaskIds();
    if (taskIds.length === 0) return 'Nenhuma tarefa delegada.';

    const tasks: DelegatedTask[] = [];
    for (const id of taskIds) {
      const t = this.loadTask(id);
      if (t) tasks.push(t);
    }

    const byStatus = {
      pending: tasks.filter((t) => t.status === 'pending'),
      running: tasks.filter((t) => t.status === 'running'),
      completed: tasks.filter((t) => t.status === 'completed'),
      failed: tasks.filter((t) => t.status === 'failed'),
      cancelled: tasks.filter((t) => t.status === 'cancelled'),
    };

    const lines: string[] = [`Tarefas delegadas (${tasks.length} total):`];
    if (byStatus.pending.length) lines.push(`  ⏳ Pendentes: ${byStatus.pending.length}`);
    if (byStatus.running.length) lines.push(`  🔄 Rodando: ${byStatus.running.length}`);
    if (byStatus.completed.length) lines.push(`  ✅ Completas: ${byStatus.completed.length}`);
    if (byStatus.failed.length) lines.push(`  ❌ Falharam: ${byStatus.failed.length}`);
    if (byStatus.cancelled.length) lines.push(`  🚫 Canceladas: ${byStatus.cancelled.length}`);

    for (const t of tasks.slice(0, 20)) {
      const icon = { pending: '⏳', running: '🔄', completed: '✅', failed: '❌', cancelled: '🚫' }[t.status];
      const batch = t.batch_id ? ` [batch:${t.batch_id}]` : '';
      lines.push(`  ${icon} [${t.id}] ${t.role} — ${t.task_description.slice(0, 60)}${batch}`);
    }

    return lines.join('\n');
  }

  private taskStatus(args: Record<string, unknown>): string {
    const taskId = String(args.task_id || '');
    if (!taskId) return 'Erro: "task_id" e obrigatorio.';

    const task = this.loadTask(taskId);
    if (!task) return `Erro: tarefa "${taskId}" nao encontrada.`;

    const lines: string[] = [
      `Tarefa: ${task.id}`,
      `  - Descricao: ${task.task_description}`,
      `  - Role: ${task.role}`,
      `  - Status: ${task.status}`,
      `  - Pai: ${task.parent_id || 'nenhum'}`,
      `  - Filhos: ${task.children_ids.length > 0 ? task.children_ids.join(', ') : 'nenhum'}`,
      `  - Batch: ${task.batch_id || 'nenhum'}`,
      `  - Profundidade: ${task.current_depth}/${task.max_depth}`,
      `  - Timeout: ${task.timeout_ms}ms`,
      `  - Criado: ${task.created_at}`,
      `  - Iniciado: ${task.started_at || 'nao'}`,
      `  - Completado: ${task.completed_at || 'nao'}`,
    ];
    if (task.result) lines.push(`  - Resultado: ${task.result.slice(0, 200)}`);
    if (task.error) lines.push(`  - Erro: ${task.error}`);
    return lines.join('\n');
  }

  private cancelTask(args: Record<string, unknown>): string {
    const taskId = String(args.task_id || '');
    if (!taskId) return 'Erro: "task_id" e obrigatorio.';

    const task = this.loadTask(taskId);
    if (!task) return `Erro: tarefa "${taskId}" nao encontrada.`;

    if (task.status === 'completed' || task.status === 'cancelled') {
      return `Erro: tarefa "${taskId}" ja esta em status "${task.status}".`;
    }

    task.status = 'cancelled';
    task.completed_at = new Date().toISOString();
    task.error = 'Cancelada pelo usuario.';
    this.saveTask(task);

    let cancelledChildren = 0;
    for (const childId of task.children_ids) {
      const child = this.loadTask(childId);
      if (child && child.status !== 'completed' && child.status !== 'cancelled') {
        child.status = 'cancelled';
        child.completed_at = new Date().toISOString();
        child.error = 'Cancelada (tarefa pai cancelada).';
        this.saveTask(child);
        cancelledChildren++;
      }
    }

    return `Tarefa "${taskId}" cancelada.${cancelledChildren > 0 ? ` ${cancelledChildren} tarefa(s) filha(s) tambem cancelada(s).` : ''}`;
  }

  private cancelBatch(args: Record<string, unknown>): string {
    const batchId = String(args.batch_id || '');
    if (!batchId) return 'Erro: "batch_id" e obrigatorio.';

    const taskIds = this.listAllTaskIds();
    let cancelled = 0;

    for (const id of taskIds) {
      const task = this.loadTask(id);
      if (task && task.batch_id === batchId && task.status !== 'completed' && task.status !== 'cancelled') {
        task.status = 'cancelled';
        task.completed_at = new Date().toISOString();
        task.error = 'Cancelada (batch cancelado).';
        this.saveTask(task);
        cancelled++;
      }
    }

    return `Batch "${batchId}": ${cancelled} tarefa(s) cancelada(s).`;
  }

  private taskResult(args: Record<string, unknown>): string {
    const taskId = String(args.task_id || '');
    if (!taskId) return 'Erro: "task_id" e obrigatorio.';

    const task = this.loadTask(taskId);
    if (!task) return `Erro: tarefa "${taskId}" nao encontrada.`;

    if (task.status === 'pending') return `Tarefa "${taskId}" ainda esta pendente.`;
    if (task.status === 'running') return `Tarefa "${taskId}" ainda esta rodando.`;
    if (task.status === 'failed') return `Tarefa "${taskId}" falhou: ${task.error}`;
    if (task.status === 'cancelled') return `Tarefa "${taskId}" foi cancelada.`;

    return task.result || 'Tarefa completa mas sem resultado registrado.';
  }
}
