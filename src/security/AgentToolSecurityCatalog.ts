import type {
  AgentToolSecurityDefinition,
} from './AgentSecurityPolicyEngine.js';
import {
  normalizeAgentToolSecurityDefinition,
} from './AgentSecurityPolicyEngine.js';

export const NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS: AgentToolSecurityDefinition[] = [
  {
    toolName: 'get_datetime',
    surface: 'native-tool',
    capabilities: ['local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Reads local clock information only.',
  },
  {
    toolName: 'web_search',
    surface: 'native-tool',
    capabilities: ['network', 'untrusted-input'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Fetches public web evidence and returns it as untrusted content.',
  },
  {
    toolName: 'read_file',
    surface: 'native-tool',
    capabilities: ['filesystem', 'local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Reads local text files through filesystem policy checks.',
  },
  {
    toolName: 'list_directory',
    surface: 'native-tool',
    capabilities: ['filesystem', 'local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Lists local directory entries through filesystem policy checks.',
  },
  {
    toolName: 'workspace.read',
    surface: 'native-tool',
    capabilities: ['filesystem', 'local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Reads files inside the governed workspace.',
  },
  {
    toolName: 'workspace.list',
    surface: 'native-tool',
    capabilities: ['filesystem', 'local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Lists files inside the governed workspace.',
  },
  {
    toolName: 'create_file',
    surface: 'native-tool',
    capabilities: ['filesystem'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Creates or writes a local file.',
  },
  {
    toolName: 'workspace.write',
    surface: 'native-tool',
    capabilities: ['filesystem'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Writes a file inside the governed workspace.',
  },
  {
    toolName: 'workspace.edit',
    surface: 'native-tool',
    capabilities: ['filesystem'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Edits a file inside the governed workspace.',
  },
  {
    toolName: 'workspace.apply_patch',
    surface: 'native-tool',
    capabilities: ['filesystem', 'destructive'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Applies a patch inside the governed workspace.',
  },
  {
    toolName: 'workspace.command.propose',
    surface: 'native-tool',
    capabilities: ['local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Proposes a command for execution inside the workspace.',
  },
  {
    toolName: 'workspace.command.run',
    surface: 'native-tool',
    capabilities: ['shell', 'filesystem', 'destructive'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Runs a previously proposed and approved command inside the workspace.',
  },
  {
    toolName: 'workspace.host_command.propose',
    surface: 'native-tool',
    capabilities: ['local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Proposes a host command for execution inside the workspace using Host Power Mode.',
  },
  {
    toolName: 'workspace.host_command.run',
    surface: 'native-tool',
    capabilities: ['shell', 'filesystem', 'destructive'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Runs a previously proposed and approved host command inside the workspace.',
  },
  {
    toolName: 'workspace.task_mandate.propose',
    surface: 'native-tool',
    capabilities: ['local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Proposes a task mandate for execution inside the workspace.',
  },
  {
    toolName: 'remote_shell',
    surface: 'native-tool',
    capabilities: ['shell', 'filesystem', 'destructive'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    description: 'Runs allowlisted host commands without a subshell.',
  },
  {
    toolName: 'run_sandbox_code',
    surface: 'native-tool',
    capabilities: ['sandbox', 'shell', 'untrusted-input'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Executes code in a selected sandbox runtime.',
  },
  {
    toolName: 'desktop_automation',
    surface: 'native-tool',
    capabilities: ['desktop', 'destructive'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    description: 'Controls local desktop UI automation.',
  },
  {
    toolName: 'echo_hands',
    surface: 'native-tool',
    capabilities: ['desktop', 'browser', 'external-send', 'destructive'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    description: 'Runs supervised Echo Hands local actions.',
  },
  {
    toolName: 'query_external_ai',
    surface: 'native-tool',
    capabilities: ['network', 'external-send', 'untrusted-input'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Sends prompts or links to an external AI provider.',
  },
  {
    toolName: 'generate_image',
    surface: 'native-tool',
    capabilities: ['network', 'external-send', 'untrusted-input'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Sends image prompts to an external generation provider.',
  },
  {
    toolName: 'analyze_media',
    surface: 'native-tool',
    capabilities: ['network', 'untrusted-input'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Analyzes untrusted media artifacts and may call model providers.',
  },
  {
    toolName: 'semantic_memory',
    surface: 'native-tool',
    capabilities: ['memory', 'filesystem'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Reads or writes durable user memory.',
  },
  {
    toolName: 'enable_mnemos',
    surface: 'native-tool',
    capabilities: ['configuration', 'memory'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Changes memory capability configuration.',
  },
  {
    toolName: 'plan_mnemos_scope',
    surface: 'native-tool',
    capabilities: ['configuration', 'memory', 'local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Builds a confirmable Mnemos scan scope proposal without changing configuration.',
  },
  {
    toolName: 'configure_llm_profile',
    surface: 'native-tool',
    capabilities: ['configuration', 'credential'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Changes default provider/model configuration.',
  },
  {
    toolName: 'zavorth_action',
    surface: 'native-tool',
    capabilities: ['local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    description: 'Routes first-class Zavorth action lookup, preview, apply and receipts through the governed Action Harness. Mutation is approval-gated inside the gateway.',
  },
  {
    toolName: 'auto_skill_creator',
    surface: 'native-tool',
    capabilities: ['skill', 'filesystem'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Creates local declarative skill manifests.',
  },
  {
    toolName: 'nodes',
    surface: 'native-tool',
    capabilities: ['desktop', 'filesystem', 'shell', 'network', 'external-send'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description: 'Lists, previews and queues governed Node Mesh companion invocations.',
  },
];

export const BOOTSTRAP_NATIVE_TOOL_SECURITY_MANIFEST = [
  { className: 'UnifiedSearchTool', toolName: 'web_search' },
  { className: 'CreateFileTool', toolName: 'create_file' },
  { className: 'ReadFileTool', toolName: 'read_file' },
  { className: 'ListDirectoryTool', toolName: 'list_directory' },
  { className: 'WorkspaceReadTool', toolName: 'workspace.read' },
  { className: 'WorkspaceListTool', toolName: 'workspace.list' },
  { className: 'WorkspaceWriteTool', toolName: 'workspace.write' },
  { className: 'WorkspaceEditTool', toolName: 'workspace.edit' },
  { className: 'WorkspaceApplyPatchTool', toolName: 'workspace.apply_patch' },
  { className: 'WorkspaceCommandProposeTool', toolName: 'workspace.command.propose' },
  { className: 'WorkspaceCommandRunTool', toolName: 'workspace.command.run' },
  { className: 'HostCommandProposeTool', toolName: 'workspace.host_command.propose' },
  { className: 'HostCommandRunTool', toolName: 'workspace.host_command.run' },
  { className: 'WorkspaceTaskMandateProposeTool', toolName: 'workspace.task_mandate.propose' },
  { className: 'DateTimeTool', toolName: 'get_datetime' },
  { className: 'RemoteShellTool', toolName: 'remote_shell' },
  { className: 'QueryExternalAiTool', toolName: 'query_external_ai' },
  { className: 'SandboxExecutionTool', toolName: 'run_sandbox_code' },
  { className: 'Mem0Tool', toolName: 'semantic_memory' },
  { className: 'DesktopAutomationTool', toolName: 'desktop_automation' },
  { className: 'PlanMnemosScopeTool', toolName: 'plan_mnemos_scope' },
  { className: 'EnableMnemosTool', toolName: 'enable_mnemos' },
  { className: 'EchoHandsTool', toolName: 'echo_hands' },
  { className: 'ConfigureLlmProfileTool', toolName: 'configure_llm_profile' },
  { className: 'ZavorthActionTool', toolName: 'zavorth_action' },
  { className: 'AutoSkillCreatorTool', toolName: 'auto_skill_creator' },
  { className: 'ImageGenerationTool', toolName: 'generate_image' },
  { className: 'MediaAnalysisTool', toolName: 'analyze_media' },
  { className: 'NodeMeshTool', toolName: 'nodes' },
] as const;

const NATIVE_DEFINITIONS_BY_NAME = new Map(
  NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS.map((definition) => [
    definition.toolName.toLowerCase(),
    normalizeAgentToolSecurityDefinition({ ...definition, source: 'explicit' }),
  ]),
);

export function listExplicitNativeToolSecurityNames(): string[] {
  return Array.from(NATIVE_DEFINITIONS_BY_NAME.keys()).sort();
}

export function findMissingExplicitNativeToolSecurityDefinitions(toolNames: string[]): string[] {
  return Array.from(
    new Set(
      toolNames
        .map((toolName) => String(toolName || '').trim().toLowerCase())
        .filter(Boolean)
        .filter((toolName) => !NATIVE_DEFINITIONS_BY_NAME.has(toolName)),
    ),
  ).sort();
}

export function assertExplicitNativeToolSecurityDefinitions(toolNames: string[]): void {
  const missing = findMissingExplicitNativeToolSecurityDefinitions(toolNames);
  if (missing.length > 0) {
    throw new Error(
      `Missing explicit native tool security definition(s): ${missing.join(', ')}. `
      + 'Add them to NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS before exposing the tool.',
    );
  }
}

export function createMcpAgentToolSecurityDefinition(
  toolName: string,
  description = 'External MCP tool exposed to the local agent runtime.',
): AgentToolSecurityDefinition {
  return normalizeAgentToolSecurityDefinition({
    toolName,
    surface: 'mcp-tool',
    capabilities: ['mcp', 'network', 'external-send', 'untrusted-input'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description,
    source: 'inferred',
  });
}

export function createFallbackAgentToolSecurityDefinition(
  toolName: string,
  description = 'Registered tool without an explicit security definition.',
): AgentToolSecurityDefinition {
  return normalizeAgentToolSecurityDefinition({
    toolName,
    surface: 'unknown',
    capabilities: ['unknown'],
    defaultRisk: 'forbidden',
    requiresConfirmation: false,
    description,
    source: 'fallback',
  });
}

export function resolveDefaultAgentToolSecurityDefinition(
  toolName: string,
  description?: string,
): AgentToolSecurityDefinition {
  const normalized = String(toolName || '').trim().toLowerCase();
  const known = NATIVE_DEFINITIONS_BY_NAME.get(normalized);
  if (known) {
    return {
      ...known,
      capabilities: [...known.capabilities],
    };
  }

  return createFallbackAgentToolSecurityDefinition(toolName, description);
}
