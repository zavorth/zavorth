import type { CapabilityDefinition } from '../../../contracts/CapabilityContract.js';
import type { ToolDefinition } from '../../../providers/ILlmProvider.js';
import type { CapabilityRegistry } from '../../../capabilities/CapabilityRegistry.js';

type CapabilityRegistryLike = Pick<CapabilityRegistry, 'registerCapabilities'>;

export class EchoCapabilityCatalogService {
  public buildDefinitions(tools: ToolDefinition[]): CapabilityDefinition[] {
    return (Array.isArray(tools) ? tools : []).map((tool) => this.toCapability(tool));
  }

  public registerTools(
    tools: ToolDefinition[],
    registry: CapabilityRegistryLike,
  ): CapabilityDefinition[] {
    const definitions = this.buildDefinitions(tools);
    return registry.registerCapabilities(definitions, 'builtin');
  }

  private toCapability(tool: ToolDefinition): CapabilityDefinition {
    const normalizedName = this.normalizeIdentifier(tool.name || 'echo-tool');
    const normalizedCategory = String(tool.category || 'runtime').trim().toLowerCase();
    const policy = this.buildPolicy(tool, normalizedName, normalizedCategory);
    const artifactKinds = policy.artifactKinds || [];
    return {
      id: `echo-capability-${normalizedName}`,
      label: `Echo ${normalizedName.replace(/_/g, ' ')}`,
      type: this.resolveType(normalizedCategory),
      description: String(tool.description || '').trim() || `Capability Echo para ${normalizedName}.`,
      intent: `echo_${normalizedCategory}`,
      executor_preference: 'echo',
      dispatch_mode: 'execution',
      requires_planning: false,
      routing_reason: `Capability catalogada a partir da tool Echo ${normalizedName}.`,
      routing_confidence: 0.65,
      priority: 65,
      allowed_command_types: ['/task', '/auto'],
      matchers: [{
        keywords: this.buildKeywords(tool),
      }],
      tags: this.uniqueTags([
        'echo',
        normalizedCategory,
        `tool:${normalizedName}`,
        `executor:${policy.executor}`,
        `policy:${policy.requiresApproval ? 'approval-required' : 'auto-approved'}`,
        `danger:${policy.dangerLevel || 'unknown'}`,
        `network:${policy.networkScope || 'none'}`,
        `lifecycle:${policy.lifecycle || 'stateless'}`,
        ...artifactKinds.map((kind) => `artifact:${kind}`),
        ...this.resolveDomainTags(normalizedCategory),
      ]),
      policy,
      source: 'builtin',
      plugin_name: null,
      command: null,
    };
  }

  private buildPolicy(
    tool: ToolDefinition,
    normalizedName: string,
    normalizedCategory: string,
  ): NonNullable<CapabilityDefinition['policy']> {
    const artifactKinds = this.resolveArtifactKinds(normalizedName, normalizedCategory);
    return {
      executor: 'echo',
      requiresApproval: Boolean(tool.requiresPermission),
      dangerLevel: String(tool.dangerLevel || '').trim().toLowerCase() || null,
      networkScope: this.resolveNetworkScope(normalizedName, normalizedCategory),
      lifecycle: this.resolveLifecycle(normalizedName, normalizedCategory),
      artifactKinds,
      allowedHosts: this.resolveAllowedHosts(normalizedName, normalizedCategory),
    };
  }

  private resolveType(category: string): CapabilityDefinition['type'] {
    if (category.includes('iot') || category.includes('automation')) {
      return 'automation';
    }
    if (category.includes('browser') || category.includes('web')) {
      return 'workflow';
    }
    return 'integration';
  }

  private resolveNetworkScope(toolName: string, category: string): NonNullable<CapabilityDefinition['policy']>['networkScope'] {
    if (category.includes('iot') || toolName.includes('home_assistant') || toolName.includes('mqtt')) {
      return 'private-network';
    }
    if (toolName.includes('vision')) {
      return 'external-policy';
    }
    if (category.includes('browser') || category.includes('web') || toolName.includes('playwright')) {
      return 'external-policy';
    }
    return 'none';
  }

  private resolveLifecycle(toolName: string, category: string): NonNullable<CapabilityDefinition['policy']>['lifecycle'] {
    if (toolName.includes('home_assistant') || toolName.includes('mqtt')) {
      return 'event-bridge';
    }
    if (category.includes('browser') || category.includes('web') || toolName.includes('playwright')) {
      return 'session';
    }
    return 'stateless';
  }

  private resolveArtifactKinds(toolName: string, category: string): string[] {
    const kinds: string[] = [];
    if (
      toolName.includes('screenshot')
      || toolName.includes('vision')
      || toolName.includes('playwright')
      || category.includes('browser')
      || category.includes('web')
    ) {
      kinds.push('screenshot');
    }
    if (toolName.includes('home_assistant') || toolName.includes('mqtt')) {
      kinds.push('iot-command');
    }
    if (toolName.includes('system_info')) {
      kinds.push('diagnostic');
    }
    return kinds;
  }

  private resolveAllowedHosts(toolName: string, category: string): string[] {
    if (category.includes('iot') || toolName.includes('home_assistant') || toolName.includes('mqtt')) {
      return ['localhost', '127.0.0.1', '::1', 'private-network'];
    }
    if (category.includes('browser') || category.includes('web') || toolName.includes('playwright')) {
      return ['localhost', '127.0.0.1', '::1', 'private-network', 'local-file', 'policy-allowlist'];
    }
    return [];
  }

  private resolveDomainTags(category: string): string[] {
    if (category.includes('iot') || category.includes('browser') || category.includes('web')) {
      return ['domain:platform-ecosystem', 'domain:trust-governance'];
    }
    if (category.includes('os')) {
      return ['domain:platform-ecosystem', 'domain:trust-governance', 'domain:observability'];
    }
    return ['domain:platform-ecosystem'];
  }

  private buildKeywords(tool: ToolDefinition): string[] {
    const tokens = [
      String(tool.name || ''),
      String(tool.category || ''),
      String(tool.description || ''),
    ]
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9_ ]+/g, ' ')
      .split(/\s+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length >= 3);
    return Array.from(new Set(tokens)).slice(0, 16);
  }

  private normalizeIdentifier(value: unknown): string {
    return String(value || 'echo-tool')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      || 'echo-tool';
  }

  private uniqueTags(tags: string[]): string[] {
    return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  }
}
