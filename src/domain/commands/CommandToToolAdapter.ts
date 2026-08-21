import type { UniversalCommandDescriptor } from '../../contracts/commands/UniversalCommandContract.js';
import type { ToolGroupCatalogEntry } from '../../runtime/agent/tools/ToolGroupCatalog.js';
import type { UniversalToolRiskLevel } from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export class CommandToToolAdapter {
  public static toToolGroupCatalogEntry(descriptor: UniversalCommandDescriptor): ToolGroupCatalogEntry {
    const risk: UniversalToolRiskLevel =
      descriptor.riskLevel === 'read_only'
        ? 'safe'
        : descriptor.riskLevel === 'safe_mutation'
        ? 'attention'
        : 'danger';

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
