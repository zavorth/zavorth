import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { CapabilityCommand, CapabilityDefinition, CapabilitySummary } from '../contracts/CapabilityContract.js';
import { BUILTIN_CAPABILITIES } from './BuiltinCapabilities.js';

type RegistryOptions = {
  pluginDir?: string;
  builtins?: CapabilityDefinition[];
};

const LEGACY_COMPAT_COMMAND_ALIASES: Record<string, string> = {};

export class CapabilityRegistry {
  private readonly pluginDir: string;
  private readonly builtins: CapabilityDefinition[];
  private readonly capabilities: CapabilityDefinition[];

  constructor(options: RegistryOptions = {}) {
    this.pluginDir = options.pluginDir || config.capabilityPluginsDir;
    this.builtins = (options.builtins || BUILTIN_CAPABILITIES).map((capability) =>
      this.normalizeCapability(capability, 'builtin'),
    );
    this.capabilities = [...this.builtins, ...this.loadPluginCapabilities()];
  }

  public getAll(): CapabilityDefinition[] {
    return this.capabilities.map((capability) => ({ ...capability }));
  }

  public findByCommand(commandType: string): CapabilityDefinition | null {
    const normalized = this.normalizeCommand(commandType);
    const canonical = this.resolveCommandAlias(normalized);
    return (
      this.capabilities.find((capability) => {
        if (!capability.command) {
          return false;
        }
        return (
          capability.command.command === canonical ||
          capability.command.command === normalized ||
          capability.command.aliases?.includes(normalized) ||
          capability.command.aliases?.includes(canonical)
        );
      }) || null
    );
  }

  /**
   * Free-text capability choice is model-owned (LLM full_toolset).
   * Always returns null — never activates capabilities from natural-language keywords.
   * Use {@link findByCommand} for explicit slash / CLI command routes only.
   */
  public matchImplicit(_commandType: string, _normalizedText: string): CapabilityDefinition | null {
    return null;
  }

  public getAliasMap(): Record<string, string> {
    const aliases: Record<string, string> = {};

    for (const capability of this.capabilities) {
      const command = capability.command;
      if (!command?.aliases?.length) {
        continue;
      }

      for (const alias of command.aliases) {
        aliases[this.normalizeCommand(alias)] = command.command;
      }
    }

    for (const [legacyAlias, canonicalCommand] of Object.entries(LEGACY_COMPAT_COMMAND_ALIASES)) {
      aliases[legacyAlias] = canonicalCommand;
    }

    return aliases;
  }

  public getExplicitExecutorMap(): Record<string, string | null> {
    const executors: Record<string, string | null> = {};

    for (const capability of this.capabilities) {
      if (!capability.command) {
        continue;
      }

      executors[capability.command.command] =
        capability.command.explicit_executor ?? capability.executor_preference ?? null;
    }

    return executors;
  }

  public getCommandCatalogEntries(): Array<{
    command: string;
    description: string;
    section: string;
    usage?: string;
    hidden?: boolean;
    privateMenu?: boolean;
    groupMenu?: boolean;
  }> {
    return this.capabilities
      .filter((capability) => capability.command)
      .map((capability) => {
        const command = capability.command as CapabilityCommand;
        return {
          command: command.command.replace(/^\//, ''),
          description: command.description,
          section: command.section || 'execution',
          usage: command.usage,
          hidden: command.hidden,
          privateMenu: command.privateMenu,
          groupMenu: command.groupMenu,
        };
      });
  }

  public getSummary(): CapabilitySummary {
    const commandCount = this.capabilities.filter((capability) => capability.command).length;
    const implicitCount = this.capabilities.filter(
      (capability) => Array.isArray(capability.matchers) && capability.matchers.length > 0,
    ).length;
    const pluginCount = this.capabilities.filter((capability) => capability.source === 'plugin').length;

    return {
      total: this.capabilities.length,
      builtin: this.capabilities.length - pluginCount,
      plugin: pluginCount,
      commands: commandCount,
      implicitRoutes: implicitCount,
    };
  }

  public registerCapability(
    capability: CapabilityDefinition,
    source: 'builtin' | 'plugin' = 'builtin',
  ): CapabilityDefinition {
    const normalized = this.normalizeCapability(capability, source);
    const existingIndex = this.capabilities.findIndex((entry) => entry.id === normalized.id);
    if (existingIndex >= 0) {
      this.capabilities.splice(existingIndex, 1, normalized);
    } else {
      this.capabilities.push(normalized);
    }
    return { ...normalized };
  }

  public registerCapabilities(
    capabilities: CapabilityDefinition[],
    source: 'builtin' | 'plugin' = 'builtin',
  ): CapabilityDefinition[] {
    return (Array.isArray(capabilities) ? capabilities : [])
      .filter((capability): capability is CapabilityDefinition => Boolean(capability))
      .map((capability) => this.registerCapability(capability, source));
  }

  private loadPluginCapabilities(): CapabilityDefinition[] {
    if (!this.pluginDir || !fs.existsSync(this.pluginDir)) {
      return [];
    }

    const capabilities: CapabilityDefinition[] = [];
    const files = fs
      .readdirSync(this.pluginDir)
      .filter((entry) => entry.toLowerCase().endsWith('.json'))
      .sort();

    for (const file of files) {
      const filePath = path.join(this.pluginDir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (!item || typeof item !== 'object') {
            continue;
          }
          capabilities.push(
            this.normalizeCapability(
              {
                ...item,
                plugin_name:
                  String(item.plugin_name || path.basename(file, '.json')).trim() || path.basename(file, '.json'),
              } as CapabilityDefinition,
              'plugin',
            ),
          );
        }
      } catch (error: unknown) {
        // Ignore malformed plugin manifests to avoid breaking the runtime.
      }
    }

    return capabilities.filter((capability) => capability.enabled !== false);
  }

  private normalizeCapability(capability: CapabilityDefinition, source: 'builtin' | 'plugin'): CapabilityDefinition {
    const command = capability.command
      ? {
          ...capability.command,
          command: this.normalizeCommand(capability.command.command),
          aliases: Array.isArray(capability.command.aliases)
            ? capability.command.aliases.map((alias) => this.normalizeCommand(alias))
            : [],
          explicit_executor: capability.command.explicit_executor ?? capability.executor_preference ?? null,
          handler_action: capability.command.handler_action || null,
          handler_config:
            capability.command.handler_config && typeof capability.command.handler_config === 'object'
              ? { ...capability.command.handler_config }
              : null,
          section: capability.command.section || 'execution',
        }
      : null;

    return {
      ...capability,
      source,
      enabled: capability.enabled !== false,
      priority: Number(capability.priority || capability.routing_confidence || 0),
      workspace_hint: capability.workspace_hint ?? null,
      requires_planning: Boolean(capability.requires_planning),
      command,
      matchers: Array.isArray(capability.matchers) ? capability.matchers : [],
      allowed_command_types: Array.isArray(capability.allowed_command_types)
        ? capability.allowed_command_types.map((entry) => this.normalizeCommand(entry))
        : ['/task', '/auto'],
      plugin_name: capability.plugin_name || null,
    };
  }

  private normalizeCommand(value: string): string {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      return normalized;
    }
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  private resolveCommandAlias(normalizedCommand: string): string {
    return LEGACY_COMPAT_COMMAND_ALIASES[normalizedCommand] || normalizedCommand;
  }
}

let defaultRegistry: CapabilityRegistry | null = null;

export function getDefaultCapabilityRegistry(): CapabilityRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new CapabilityRegistry();
  }
  return defaultRegistry;
}

export function resetDefaultCapabilityRegistry(): void {
  defaultRegistry = null;
}
