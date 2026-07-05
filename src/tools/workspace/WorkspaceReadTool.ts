import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { BaseTool } from '../BaseTool.js';
import { ReadFileTool } from '../ReadFileTool.js';

export class WorkspaceReadTool extends BaseTool {
  public readonly name = 'workspace.read';
  public readonly description = 'Reads a text file inside the workspace using the canonical policy.';
  public readonly parameters: ToolDefinition['parameters'];
  private readonly delegate: ReadFileTool;

  constructor(delegate = new ReadFileTool()) {
    super();
    this.delegate = delegate;
    this.parameters = delegate.parameters;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    return this.delegate.execute(args);
  }
}
