import type { ExecutionRequest, ExecutionResult } from '../../../src/contracts/ExecutionContract';

interface SandboxAdapter {
  execute(input: { provider: string; code: string; language: string }): Promise<{
    stdout: string;
    stderr: string;
    status: string;
    exitCode: number;
  }>;
  listProviders(): Array<{ id: string; enabled: boolean }>;
}

export class DaytonaExecutor {
  private adapter?: SandboxAdapter;

  constructor(adapter?: SandboxAdapter) {
    this.adapter = adapter;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (request.dry_run) {
      return {
        execution_id: request.execution_id,
        task_id: request.task_id,
        executor: request.executor,
        success: true,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        actions_executed: [],
        files_read: [],
        files_written: [],
        files_deleted: [],
        commands_executed: [],
        stdout: null,
        stderr: null,
        diff_summary: null,
        artifacts: [],
        rollback_available: false,
        error_code: null,
        error_message: null,
        metadata: { dry_run: true },
      };
    }

    const code = request.instructions.join('\n');
    const result = await this.adapter!.execute({
      provider: 'daytona',
      code,
      language: 'bash',
    });

    return {
      execution_id: request.execution_id,
      task_id: request.task_id,
      executor: request.executor,
      success: result.exitCode === 0,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: request.instructions,
      stdout: result.stdout,
      stderr: result.stderr,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: result.exitCode !== 0 ? `EXIT_${result.exitCode}` : null,
      error_message: null,
      metadata: {},
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.adapter) return false;
    const providers = this.adapter.listProviders();
    return providers.some((p) => p.id === 'daytona' && p.enabled);
  }
}
