import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import type {
  AgentPolicyAction,
  AgentRiskLevel,
  AgentToolCapability,
} from '../../security/AgentSecurityPolicyEngine.js';
import { AGENT_SECURITY_DECISION_MATRIX } from '../../security/AgentSecurityPolicyEngine.js';

import { resolveDefaultAgentToolSecurityDefinition } from '../../security/AgentToolSecurityCatalog.js';
import type { BaseTool } from '../../tools/BaseTool.js';
import type { ToolRegistry } from '../../tools/ToolRegistry.js';

type ToolRegistryLike = Pick<
  ToolRegistry,
  | 'getTool'
  | 'getAllTools'
  | 'getToolDefinitions'
  | 'getToolSecurityDefinition'
>;

export type RuntimeToolGroup = 'workspace' | 'general';

export type RuntimeToolCatalogEntry = {
  id: string;
  label: string;
  group: RuntimeToolGroup;
  description: string;
  parameterCount: number;
  requiredCount: number;
  source: 'registry' | 'definition';
  securityCapabilities: AgentToolCapability[];
  securityRisk: AgentRiskLevel;
  securityAction: AgentPolicyAction;
  requiresConfirmation: boolean;
  securitySurface: string;
};

const WORKSPACE_TOOL_IDS = new Set([
  'read_file',
  'list_directory',
  'create_file',
]);

function resolveToolGroup(toolName: string): RuntimeToolGroup {
  const normalized = String(toolName || '').trim().toLowerCase();
  if (WORKSPACE_TOOL_IDS.has(normalized) || normalized.startsWith('workspace.')) {
    return 'workspace';
  }
  return 'general';
}

export class ToolCatalogService {
  constructor(private readonly registry?: ToolRegistryLike) {}

  public getToolDefinitions(): ToolDefinition[] {
    return this.registry?.getToolDefinitions() || [];
  }

  public getRegisteredToolNames(): string[] {
    const tools = this.getAllTools();
    if (tools.length > 0) {
      return tools.map((tool) => tool.name);
    }

    return this.getToolDefinitions().map((tool) => tool.name);
  }

  public hasTool(name: string): boolean {
    return Boolean(this.registry?.getTool(name));
  }

  public count(): number {
    const tools = this.getAllTools();
    if (tools.length > 0) {
      return tools.length;
    }

    return this.getToolDefinitions().length;
  }

  public listTools(): RuntimeToolCatalogEntry[] {
    const tools = this.getAllTools();
    if (tools.length > 0) {
      return tools.map((tool) => this.buildCatalogEntry({
        id: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        source: 'registry',
      }));
    }

    return this.getToolDefinitions().map((tool) => this.buildCatalogEntry({
      id: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      source: 'definition',
    }));
  }

  public listToolsByGroup(group: RuntimeToolGroup): RuntimeToolCatalogEntry[] {
    return this.listTools().filter((entry) => entry.group === group);
  }

  public getToolEntry(name: string): RuntimeToolCatalogEntry | null {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return this.listTools().find((entry) => entry.id.toLowerCase() === normalized) || null;
  }

  private getAllTools(): BaseTool[] {
    if (!this.registry?.getAllTools) {
      return [];
    }

    return this.registry.getAllTools() || [];
  }

  private buildCatalogEntry(input: {
    id: string;
    description: string;
    parameters: ToolDefinition['parameters'];
    source: 'registry' | 'definition';
  }): RuntimeToolCatalogEntry {
    const securityDefinition =
      this.registry?.getToolSecurityDefinition?.(input.id) ||
      resolveDefaultAgentToolSecurityDefinition(input.id, input.description);
    const securityRisk = securityDefinition.defaultRisk;
    return {
      id: input.id,
      label: input.id,
      group: resolveToolGroup(input.id),
      description: String(input.description || '').trim() || 'Tool registrada no runtime do Zavorth.',
      parameterCount: Object.keys(input.parameters?.properties || {}).length,
      requiredCount: Array.isArray(input.parameters?.required) ? input.parameters.required.length : 0,
      source: input.source,
      securityCapabilities: [...securityDefinition.capabilities],
      securityRisk,
      securityAction: AGENT_SECURITY_DECISION_MATRIX[securityRisk],
      requiresConfirmation: securityDefinition.requiresConfirmation,
      securitySurface: securityDefinition.surface,
    };
  }
}
