import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { BaseTool } from '../BaseTool.js';
import { ListDirectoryTool } from '../ListDirectoryTool.js';

export class WorkspaceListTool extends BaseTool {
  public readonly name = 'workspace.list';
  public readonly description = 'Lista arquivos e diretorios dentro do workspace usando a policy canonica.';
  public readonly parameters: ToolDefinition['parameters'];
  private readonly delegate: ListDirectoryTool;

  constructor(delegate = new ListDirectoryTool()) {
    super();
    this.delegate = delegate;
    this.parameters = delegate.parameters;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    return this.delegate.execute(args);
  }
}
