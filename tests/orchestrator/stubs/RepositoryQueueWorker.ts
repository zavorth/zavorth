interface TaskRecord {
  task_id: string;
  chat_id: string;
  user_id: string;
  command_type: string;
  status: string;
  result_summary: string | null;
  diff_summary: string | null;
  error_summary: string | null;
  metadata: Record<string, any>;
}

interface TaskManager {
  claimNextTaskByCommands(commands: string[]): TaskRecord | null;
  advanceState(task: TaskRecord, status: string): void;
  saveTask(task: TaskRecord): void;
}

interface BotApi {
  sendMessage(chatId: string, text: string, options?: any): Promise<any>;
}

interface RepositoryClient {
  inspectSession(sessionId: string): Promise<{
    state: string;
    summary?: string;
    diffUrl?: string;
  }>;
}

interface RepositoryQueueWorkerDeps {
  taskManager: TaskManager;
  botApi: BotApi;
  log: (...args: any[]) => void;
  repositoryClient: RepositoryClient;
}

export class RepositoryQueueWorker {
  private taskManager: TaskManager;
  private botApi: BotApi;
  private log: (...args: any[]) => void;
  private repositoryClient: RepositoryClient;

  constructor(deps: RepositoryQueueWorkerDeps) {
    this.taskManager = deps.taskManager;
    this.botApi = deps.botApi;
    this.log = deps.log;
    this.repositoryClient = deps.repositoryClient;
  }

  async tick(): Promise<void> {
    const task = this.taskManager.claimNextTaskByCommands(['/repository-executor']);
    if (!task) return;

    const sessionId = task.metadata?.repository_session_id;
    if (!sessionId) return;

    const session = await this.repositoryClient.inspectSession(sessionId);

    if (session.state === 'COMPLETED') {
      this.taskManager.advanceState(task, 'completed');
      task.result_summary = session.summary ?? null;
      task.diff_summary = session.diffUrl ?? null;
      this.taskManager.saveTask(task);
      await this.botApi.sendMessage(
        task.chat_id,
        `Repository execution completed.\n\n${session.summary ?? ''}\n\nDiff: ${session.diffUrl ?? 'N/A'}`,
      );
    } else if (session.state === 'PLAN_REVIEW') {
      task.metadata.repository_requires_approval = true;
      this.taskManager.saveTask(task);
    }
  }
}
