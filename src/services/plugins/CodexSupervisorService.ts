import fs from 'fs';
import path from 'path';
import { asErrorLike } from '../../utils/errorLike';

export interface SupervisorTask {
  id: string;
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'killed';
  started_at: string;
  completed_at: string | null;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  memory_peak_mb: number;
  retries: number;
  max_retries: number;
  timeout_ms: number;
  metadata: Record<string, unknown>;
}

export class CodexSupervisorService {
  private readonly storageDir: string;
  private tasks: Map<string, SupervisorTask> = new Map();
  private runningProcesses: Map<string, { pid: number; started: number }> = new Map();
  private readonly maxConcurrent: number;
  private readonly defaultTimeout: number;
  private readonly defaultMaxRetries: number;

  constructor(options?: { storageDir?: string; maxConcurrent?: number; defaultTimeout?: number; defaultMaxRetries?: number }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'supervisor');
    this.maxConcurrent = options?.maxConcurrent || 5;
    this.defaultTimeout = options?.defaultTimeout || 300000;
    this.defaultMaxRetries = options?.defaultMaxRetries || 0;
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public execute(command: string, options?: {
    timeout_ms?: number;
    max_retries?: number;
    working_directory?: string;
    env?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }): string {
    const running = Array.from(this.tasks.values()).filter((t) => t.status === 'running').length;
    if (running >= this.maxConcurrent) {
      return `Error: maximum of ${this.maxConcurrent} tasks concorrentes atingido (${running} running).`;
    }

    const taskId = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timeoutMs = options?.timeout_ms || this.defaultTimeout;
    const maxRetries = options?.max_retries || this.defaultMaxRetries;

    const task: SupervisorTask = {
      id: taskId,
      command,
      status: 'pending',
      started_at: new Date().toISOString(),
      completed_at: null,
      exit_code: null,
      stdout: '',
      stderr: '',
      duration_ms: 0,
      memory_peak_mb: 0,
      retries: 0,
      max_retries: maxRetries,
      timeout_ms: timeoutMs,
      metadata: options?.metadata || {},
    };

    this.tasks.set(taskId, task);
    this.runTask(task, options);

    return [
      `Task supervisada created:`,
      `  ID: ${taskId}`,
      `  Comando: ${command.slice(0, 100)}`,
      `  Timeout: ${timeoutMs}ms`,
      `  Max retries: ${maxRetries}`,
    ].join('\n');
  }

  private async runTask(task: SupervisorTask, options?: { working_directory?: string; env?: Record<string, string> }): Promise<void> {
    task.status = 'running';
    const start = Date.now();

    try {
      const { execFileSync } = await import('child_process');
      const cwd = options?.working_directory || process.cwd();

      const env = { ...process.env, ...options?.env };

      const shell = process.platform === 'win32' ? 'powershell' : 'sh';
      const shellArgs = process.platform === 'win32' ? ['-Command', task.command] : ['-c', task.command];

      const result = execFileSync(shell, shellArgs, {
        timeout: task.timeout_ms,
        maxBuffer: 10 * 1024 * 1024,
        cwd,
        env,
      });

      task.stdout = result.toString().slice(0, 50000);
      task.exit_code = 0;
      task.status = 'completed';
    } catch (error: unknown) {
      const err = asErrorLike(error) as { code?: number; stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
      task.exit_code = err.code || 1;
      task.stdout = (err.stdout?.toString() || '').slice(0, 50000);
      task.stderr = (err.stderr?.toString() || err.message || '').slice(0, 50000);

      if (task.stderr.includes('ETIMEDOUT') || task.stderr.includes('timeout')) {
        task.status = 'timeout';
      } else if (task.retries < task.max_retries) {
        task.retries++;
        task.status = 'pending';
        this.runTask(task, options);
        return;
      } else {
        task.status = 'failed';
      }
    }

    task.completed_at = new Date().toISOString();
    task.duration_ms = Date.now() - start;

    const logPath = path.join(this.storageDir, `${task.id}.json`);
    fs.writeFileSync(logPath, JSON.stringify(task, null, 2), 'utf-8');
  }

  public kill(taskId: string): string {
    const task = this.tasks.get(taskId);
    if (!task) return `Error: task "${taskId}" not found.`;
    if (task.status !== 'running') return `Task "${taskId}" nao esta running (status: ${task.status}).`;

    // Attempt to kill the actual OS process if PID is tracked
    const processInfo = this.runningProcesses.get(taskId);
    if (processInfo?.pid) {
      try {
        process.kill(processInfo.pid, 'SIGTERM');
        // Give it 2 seconds to gracefully terminate, then force kill
        setTimeout(() => {
          try {
            process.kill(processInfo.pid, 'SIGKILL');
          } catch {
            // Process already exited
          }
        }, 2000);
      } catch {
        // Process may have already exited
      }
    }

    task.status = 'killed';
    task.completed_at = new Date().toISOString();
    this.runningProcesses.delete(taskId);

    return `Task "${taskId}" morta.`;
  }

  public getStatus(taskId: string): string {
    const task = this.tasks.get(taskId);
    if (!task) return `Error: task "${taskId}" not found.`;

    const lines: string[] = [
      `Task: ${task.id}`,
      `  Comando: ${task.command.slice(0, 100)}`,
      `  Status: ${task.status}`,
      `  Exit code: ${task.exit_code ?? 'N/A'}`,
      `  Duration: ${task.duration_ms}ms`,
      `  Retries: ${task.retries}/${task.max_retries}`,
      `  Iniciado: ${task.started_at}`,
      `  Completado: ${task.completed_at || 'N/A'}`,
    ];

    if (task.stdout) lines.push(`  stdout: ${task.stdout.slice(0, 200)}...`);
    if (task.stderr) lines.push(`  stderr: ${task.stderr.slice(0, 200)}...`);

    return lines.join('\n');
  }

  public getTask(taskId: string): string {
    return this.getStatus(taskId);
  }

  public listTasks(options?: { status?: string; limit?: number }): string {
    let tasks = Array.from(this.tasks.values());

    if (options?.status) {
      tasks = tasks.filter((t) => t.status === options.status);
    }

    tasks.sort((a, b) => b.started_at.localeCompare(a.started_at));
    const limit = options?.limit || 20;
    tasks = tasks.slice(0, limit);

    if (tasks.length === 0) return 'No tasks encontrada.';

    const lines: string[] = [`Tasks (${tasks.length}):`];
    for (const t of tasks) {
      const icon = { pending: '⏳', running: '🔄', completed: '✅', failed: '❌', timeout: '⏰', killed: '💀' }[t.status];
      lines.push(`  ${icon} [${t.id}] ${t.command.slice(0, 60)} — ${t.duration_ms}ms`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    const tasks = Array.from(this.tasks.values());
    const byStatus: Record<string, number> = {};
    for (const t of tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;

    const avgDuration = tasks.length > 0
      ? tasks.reduce((sum, t) => sum + t.duration_ms, 0) / tasks.length
      : 0;

    const successRate = tasks.length > 0
      ? (byStatus.completed || 0) / tasks.length
      : 0;

    return [
      'Supervisor Stats:',
      `  Total: ${tasks.length} tasks`,
      `  Running: ${byStatus.running || 0}/${this.maxConcurrent}`,
      `  Taxa de success: ${(successRate * 100).toFixed(1)}%`,
      `  Duration media: ${avgDuration.toFixed(0)}ms`,
      '',
      'Por Status:',
      ...Object.entries(byStatus).map(([s, c]) => `  ${s}: ${c}`),
    ].join('\n');
  }

  public getRunningTasks(): string {
    return this.listTasks({ status: 'running' });
  }

  public cleanup(maxAgeDays: number = 7): string {
    const maxAge = maxAgeDays * 86400000;
    let cleaned = 0;

    for (const [id, task] of this.tasks) {
      if (task.status !== 'running') {
        const age = Date.now() - new Date(task.started_at).getTime();
        if (age > maxAge) {
          this.tasks.delete(id);
          const logPath = path.join(this.storageDir, `${id}.json`);
          if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
          cleaned++;
        }
      }
    }

    return `${cleaned} task(s) old removed(s).`;
  }
}
