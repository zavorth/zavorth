import { ExecutionResult } from '../contracts/ExecutionContract.js';
import { Task } from '../contracts/TaskContract.js';
import { CodexCliAdapter } from './CodexCliAdapter.js';

export class CodexAdapter {
  private readonly adapter: Pick<CodexCliAdapter, 'executeDirect'>;

  constructor(adapter?: Pick<CodexCliAdapter, 'executeDirect'>) {
    this.adapter = adapter || new CodexCliAdapter();
  }

  // Backward-compatible wrapper around the real Codex CLI integration.
  public async executeDirect(task: Task, instructions: string[], workspace: string): Promise<ExecutionResult> {
    return this.adapter.executeDirect(task, instructions, workspace);
  }
}
