import { ToolDefinition } from '../providers/ILlmProvider.js';

/**
 * BaseTool — Classe base abstrata para todas as ferramentas do agente.
 * Cada tool deve implementar name, description, parameters e execute().
 */
export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ToolDefinition['parameters'];
  public readonly metadata?: ToolDefinition['metadata'];

  /**
   * Executa a ferramenta com os argumentos fornecidos.
   * @returns String com o resultado da execução
   */
  abstract execute(args: Record<string, unknown>): Promise<string>;

  /**
   * Retorna a definição da tool no formato JSON Schema para o LLM.
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
