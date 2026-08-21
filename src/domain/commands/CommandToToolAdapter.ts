import type {
  UniversalCommandDescriptor,
  CommandParameterProperty,
} from '../../contracts/commands/UniversalCommandContract.js';
import type { ToolDefinition, ToolParameter } from '../../providers/ILlmProvider.js';
import type { ToolGroupCatalogEntry } from '../../runtime/agent/tools/ToolGroupCatalog.js';
import type { UniversalToolRiskLevel } from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export class CommandToToolAdapter {
  public static toToolDefinition(descriptor: UniversalCommandDescriptor): ToolDefinition {
    const properties: Record<string, ToolParameter> = {};

    if (descriptor.parameters?.properties) {
      for (const [key, prop] of Object.entries(descriptor.parameters.properties)) {
        properties[key] = {
          type: prop.type,
          description: prop.description,
          ...(prop.enum ? { enum: Array.from(prop.enum) } : {}),
        };
      }
    }

    return {
      name: descriptor.toolName,
      description: descriptor.description,
      category: descriptor.group,
      dangerLevel: descriptor.riskLevel,
      requiresPermission: descriptor.requiresApproval,
      metadata: {
        commandId: descriptor.id,
        slashAliases: Array.from(descriptor.slashAliases),
        policyTags: descriptor.policyTags ? Array.from(descriptor.policyTags) : [],
      },
      parameters: {
        type: 'object',
        properties,
        ...(descriptor.parameters?.required ? { required: Array.from(descriptor.parameters.required) } : {}),
      },
    };
  }

  public static toToolGroupCatalogEntry(descriptor: UniversalCommandDescriptor): ToolGroupCatalogEntry {
    const risk: UniversalToolRiskLevel =
      descriptor.riskLevel === 'read_only'
        ? 'safe'
        : descriptor.riskLevel === 'safe_mutation'
        ? 'attention'
        : 'sensitive';

    const policyTags: string[] = [
      `capability:${descriptor.id}`,
      `group:${descriptor.group}`,
      `risk:${risk}`,
      ...(descriptor.policyTags || []),
    ];

    if (descriptor.requiresApproval) {
      policyTags.push('approval-required');
    }

    return {
      id: descriptor.toolName,
      group: descriptor.group,
      risk,
      requiresApproval: descriptor.requiresApproval,
      description: descriptor.description,
      policyTags,
    };
  }
}
