import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { BaseTool } from '../BaseTool.js';
import { CreateFileTool } from '../CreateFileTool.js';

export class WorkspaceWriteTool extends BaseTool {
  public readonly name = 'workspace.write';
  public readonly description = 'Cria arquivo dentro do escopo de escrita do workspace usando a policy canonica.';
  public readonly parameters: ToolDefinition['parameters'];
  private readonly delegate: CreateFileTool;

  constructor(delegate = new CreateFileTool()) {
    super();
    this.delegate = delegate;
    this.parameters = delegate.parameters;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    return this.delegate.execute(args);
  }
}
