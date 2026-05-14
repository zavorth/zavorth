import { BaseTool } from './BaseTool.js';
import { ToolDefinition } from '../providers/ILlmProvider.js';
import type { AgentToolSecurityDefinition } from '../security/AgentSecurityPolicyEngine.js';
import { normalizeAgentToolSecurityDefinition } from '../security/AgentSecurityPolicyEngine.js';
import { resolveDefaultAgentToolSecurityDefinition } from '../security/AgentToolSecurityCatalog.js';

/**
 * ToolRegistry — Registry pattern para ferramentas do agente.
 * Permite registro dinâmico e busca de tools por nome.
 */
export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();
  private toolSecurityDefinitions: Map<string, AgentToolSecurityDefinition> = new Map();

  /**
   * Registra uma nova ferramenta no registry.
   */
  public register(tool: BaseTool, securityDefinition?: AgentToolSecurityDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`⚠️ Tool "${tool.name}" já registrada. Substituindo.`);
    }
    this.tools.set(tool.name, tool);
    this.toolSecurityDefinitions.set(
      tool.name.toLowerCase(),
      normalizeAgentToolSecurityDefinition(
        securityDefinition || resolveDefaultAgentToolSecurityDefinition(tool.name, tool.description),
      ),
    );
    console.log(`🔧 Tool registrada: ${tool.name}`);
  }

  /**
   * Busca uma ferramenta pelo nome.
   */
  public getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Retorna todas as ferramentas registradas.
   */
  public getAllTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  public getToolSecurityDefinition(name: string): AgentToolSecurityDefinition | undefined {
    const definition = this.toolSecurityDefinitions.get(String(name || '').trim().toLowerCase());
    return definition
      ? {
          ...definition,
          capabilities: [...definition.capabilities],
        }
      : undefined;
  }

  public getAllToolSecurityDefinitions(): AgentToolSecurityDefinition[] {
    return Array.from(this.toolSecurityDefinitions.values()).map((definition) => ({
      ...definition,
      capabilities: [...definition.capabilities],
    }));
  }

  /**
   * Retorna as definições de todas as tools no formato JSON Schema para o LLM.
   */
  public getSecurityCatalogAudit(): {
    totalTools: number;
    explicitDefinitions: AgentToolSecurityDefinition[];
    fallbackDefinitions: AgentToolSecurityDefinition[];
    inferredDefinitions: AgentToolSecurityDefinition[];
  } {
    const definitions = this.getAllToolSecurityDefinitions();
    return {
      totalTools: this.tools.size,
      explicitDefinitions: definitions.filter((definition) => definition.source === 'explicit'),
      fallbackDefinitions: definitions.filter((definition) => definition.source === 'fallback'),
      inferredDefinitions: definitions.filter((definition) => definition.source === 'inferred'),
    };
  }

  public assertNoFallbackSecurityDefinitions(): void {
    const audit = this.getSecurityCatalogAudit();
    if (audit.fallbackDefinitions.length === 0) {
      return;
    }

    const missing = audit.fallbackDefinitions
      .map((definition) => definition.toolName)
      .sort()
      .join(', ');
    throw new Error(
      `Tool security catalog is incomplete. Fallback-denied tool(s): ${missing}. `
      + 'Add explicit security metadata before exposing these tools.',
    );
  }

  public getToolDefinitions(): ToolDefinition[] {
    return this.getAllTools().map((tool) => tool.getDefinition());
  }

  /**
   * Número de tools registradas.
   */
  public get size(): number {
    return this.tools.size;
  }
}
