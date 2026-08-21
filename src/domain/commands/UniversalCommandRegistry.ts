import type {
  UniversalCommandDescriptor,
  CommandExecutionResult,
  CommandExecutionContext,
} from '../../contracts/commands/UniversalCommandContract.js';
import type { RuntimeAgentToolGroup } from '../../runtime/agent/tools/ToolGroupCatalog.js';

export class UniversalCommandRegistry {
  private readonly commandsById = new Map<string, UniversalCommandDescriptor>();
  private readonly commandsByToolName = new Map<string, UniversalCommandDescriptor>();
  private readonly commandsByAlias = new Map<string, UniversalCommandDescriptor>();

  public register(descriptor: UniversalCommandDescriptor): void {
    if (!descriptor.id || !descriptor.toolName) {
      throw new Error('UniversalCommandDescriptor must provide valid id and toolName');
    }

    const existingById = this.commandsById.get(descriptor.id);
    if (existingById && existingById !== descriptor) {
      throw new Error(`Duplicate command registration: command id "${descriptor.id}" is already registered.`);
    }
    const existingByToolName = this.commandsByToolName.get(descriptor.toolName);
    if (existingByToolName && existingByToolName !== descriptor) {
      throw new Error(
        `Duplicate command registration: tool name "${descriptor.toolName}" is already registered by command "${existingByToolName.id}".`,
      );
    }
    for (const alias of descriptor.slashAliases) {
      const normalizedAlias = this.normalizeAlias(alias);
      const existingByAlias = this.commandsByAlias.get(normalizedAlias);
      if (existingByAlias && existingByAlias !== descriptor) {
        throw new Error(
          `Duplicate command registration: alias "${normalizedAlias}" is already registered by command "${existingByAlias.id}".`,
        );
      }
    }

    this.commandsById.set(descriptor.id, descriptor);
    this.commandsByToolName.set(descriptor.toolName, descriptor);

    for (const alias of descriptor.slashAliases) {
      const normalizedAlias = this.normalizeAlias(alias);
      this.commandsByAlias.set(normalizedAlias, descriptor);
    }
  }

  public getById(id: string): UniversalCommandDescriptor | undefined {
    return this.commandsById.get(id);
  }

  public getByToolName(toolName: string): UniversalCommandDescriptor | undefined {
    return this.commandsByToolName.get(toolName);
  }

  public getByAlias(alias: string): UniversalCommandDescriptor | undefined {
    return this.commandsByAlias.get(this.normalizeAlias(alias));
  }

  public hasAlias(alias: string): boolean {
    return this.commandsByAlias.has(this.normalizeAlias(alias));
  }

  public listAll(): readonly UniversalCommandDescriptor[] {
    return Array.from(this.commandsById.values());
  }

  public listByGroup(group: RuntimeAgentToolGroup): readonly UniversalCommandDescriptor[] {
    return Array.from(this.commandsById.values()).filter(cmd => cmd.group === group);
  }

  public async executeByAlias(
    alias: string,
    args: Record<string, unknown> = {},
    context?: CommandExecutionContext,
  ): Promise<CommandExecutionResult> {
    const descriptor = this.getByAlias(alias);
    if (!descriptor) {
      return {
        success: false,
        message: `Command alias '${alias}' not found in UniversalCommandRegistry.`,
        error: 'COMMAND_NOT_FOUND',
      };
    }
    this.validateRequiredArgs(descriptor, args);
    return descriptor.execute(args, context);
  }

  public async executeByToolName(
    toolName: string,
    args: Record<string, unknown> = {},
    context?: CommandExecutionContext,
  ): Promise<CommandExecutionResult> {
    const descriptor = this.getByToolName(toolName);
    if (!descriptor) {
      return {
        success: false,
        message: `Tool '${toolName}' not found in UniversalCommandRegistry.`,
        error: 'TOOL_NOT_FOUND',
      };
    }
    this.validateRequiredArgs(descriptor, args);
    return descriptor.execute(args, context);
  }

  public clear(): void {
    this.commandsById.clear();
    this.commandsByToolName.clear();
    this.commandsByAlias.clear();
  }

  private validateRequiredArgs(descriptor: UniversalCommandDescriptor, args: Record<string, unknown>): void {
    const required = descriptor.parameters?.required;
    if (!required) {
      return;
    }
    for (const key of required) {
      if (args[key] === undefined || args[key] === null) {
        throw new Error(`Missing required argument "${key}" for command "${descriptor.id}".`);
      }
    }
  }

  private normalizeAlias(alias: string): string {
    const trimmed = alias.trim().toLowerCase();
    return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  }
}

export const globalCommandRegistry = new UniversalCommandRegistry();
