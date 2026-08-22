import type { RuntimeAgentToolGroup } from '../../runtime/agent/tools/ToolGroupCatalog.js';

export type CommandRiskLevel =
  | 'read_only'
  | 'safe_mutation'
  | 'sensitive_approval_required';

export interface CommandParameterProperty {
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly description: string;
  readonly enum?: readonly string[];
  readonly default?: unknown;
}

export interface CommandParameterSchema {
  readonly type: 'object';
  readonly properties: Record<string, CommandParameterProperty>;
  readonly required?: readonly string[];
}

export interface CommandExecutionContext {
  readonly sessionId?: string | null;
  readonly userId?: string | null;
  readonly channel?: string | null;
  readonly isCliDirect?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface CommandExecutionResult<TData = unknown> {
  readonly success: boolean;
  readonly message: string;
  readonly data?: TData;
  readonly formattedOutput?: string;
  readonly receipts?: readonly string[];
  readonly error?: string;
}

export interface UniversalCommandDescriptor<TArgs = Record<string, unknown>, TData = unknown> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly toolName: string;
  readonly slashAliases: readonly string[];
  readonly group: RuntimeAgentToolGroup;
  readonly riskLevel: CommandRiskLevel;
  readonly requiresApproval: boolean;
  readonly parameters?: CommandParameterSchema;
  readonly policyTags?: readonly string[];
  execute(
    args: TArgs,
    context?: CommandExecutionContext,
  ): Promise<CommandExecutionResult<TData>>;
}
