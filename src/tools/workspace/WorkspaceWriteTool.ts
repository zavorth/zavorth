import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { BaseTool } from '../BaseTool.js';
import { CreateFileTool } from '../CreateFileTool.js';
import { executionContextScope } from '../../runtime/context/ExecutionContextScope.js';
import { ZavorthGitLockTool } from '../ZavorthGitLockTool.js';
import { WorkspaceFsPolicy } from './WorkspaceFsPolicy.js';
import { asErrorLike } from '../../utils/errorLike.js';

export class WorkspaceWriteTool extends BaseTool {
  public readonly name = 'workspace.write';
  public readonly description = 'Creates a file inside the workspace write scope using the canonical policy.';
  public readonly parameters: ToolDefinition['parameters'];
  private readonly delegate: CreateFileTool;

  constructor(delegate = new CreateFileTool()) {
    super();
    this.delegate = delegate;
    this.parameters = delegate.parameters;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const filepath = args.filepath as string;
    if (filepath) {
      const currentSubagentId = executionContextScope.current()?.sessionId || null;
      try {
        const policy = new WorkspaceFsPolicy();
        const fullPath = policy.resolveWritePath(filepath).absolutePath;
        await ZavorthGitLockTool.checkLock(fullPath, currentSubagentId);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        if (err.message && err.message.includes('locked by another subagent')) {
          throw error;
        }
      }
    }
    return this.delegate.execute(args);
  }
}
