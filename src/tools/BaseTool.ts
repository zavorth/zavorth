import { ToolDefinition } from '../providers/ILlmProvider.js';

/**
 * BaseTool — Abstract base class for all agent tools.
 * Each tool must implement name, description, parameters, and execute().
 */
export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ToolDefinition['parameters'];
  public readonly metadata?: ToolDefinition['metadata'];

  constructor() {
    if (new.target === BaseTool) {
      throw new Error('Cannot instantiate abstract class BaseTool directly.');
    }
  }

  /**
   * Executes the tool with the provided arguments.
   * @returns String with the execution result.
   */
  abstract execute(args: Record<string, unknown>): Promise<string>;

  /**
   * Returns the tool definition in JSON Schema format for the LLM.
   */
  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      ...(this.metadata ? { metadata: { ...this.metadata } } : {}),
      parameters: this.parameters,
    };
  }
}
