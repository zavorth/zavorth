import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import type { AgentToolSecurityDefinition } from '../../security/AgentSecurityPolicyEngine.js';
import type {
  UniversalCommandDescriptor,
  CommandExecutionContext,
} from '../../contracts/commands/UniversalCommandContract.js';
import { globalCommandRegistry } from './UniversalCommandRegistry.js';

export function buildCommandSecurityDefinition(
  descriptor: UniversalCommandDescriptor,
): AgentToolSecurityDefinition {
  const defaultRisk =
    descriptor.riskLevel === 'read_only'
      ? 'safe'
      : descriptor.riskLevel === 'safe_mutation'
      ? 'review'
      : 'dangerous';
  const mutating = descriptor.riskLevel !== 'read_only';
  return {
    toolName: descriptor.toolName,
    surface: 'native-tool',
    capabilities: mutating ? ['filesystem', 'local-observation'] : ['local-observation'],
    defaultRisk,
    requiresConfirmation: descriptor.requiresApproval,
    description: descriptor.description,
    source: 'explicit',
  };
}

export class CommandBackedTool extends BaseTool {
  public readonly name: string;
  public readonly description: string;
  public readonly parameters: ToolDefinition['parameters'];
  public override readonly metadata: ToolDefinition['metadata'];
  private readonly descriptor: UniversalCommandDescriptor;

  public constructor(descriptor: UniversalCommandDescriptor) {
    super();
    this.descriptor = descriptor;
    this.name = descriptor.toolName;
    this.description = descriptor.description;
    this.parameters = this.mapParameters(descriptor);
    this.metadata = {
      commandId: descriptor.id,
      slashAliases: [...descriptor.slashAliases],
      policyTags: [...(descriptor.policyTags || [])],
    };
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const context: CommandExecutionContext = { metadata: { surface: 'agent-tool' } };
    const result = await globalCommandRegistry.executeByToolName(this.descriptor.toolName, args, context);
    if (!result.success && result.error) {
      throw new Error(`${this.descriptor.id} failed: ${result.error} (${result.message})`);
    }
    return result.formattedOutput || result.message;
  }

  private mapParameters(descriptor: UniversalCommandDescriptor): ToolDefinition['parameters'] {
    const properties: Record<string, { type: string; description: string; enum?: string[] }> = {};
    for (const [key, prop] of Object.entries(descriptor.parameters?.properties || {})) {
      properties[key] = {
        type: prop.type,
        description: prop.description,
        ...(prop.enum ? { enum: [...prop.enum] } : {}),
      };
    }
    return {
      type: 'object',
      properties,
      ...(descriptor.parameters?.required ? { required: [...descriptor.parameters.required] } : {}),
    };
  }
}
