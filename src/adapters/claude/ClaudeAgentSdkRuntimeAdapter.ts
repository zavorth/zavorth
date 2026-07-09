import type { ChatMessage, LlmStreamEvent, ToolDefinition } from '../../providers/ILlmProvider.js';
import type {
  LlmRunOptions,
  LlmRuntimeProviderAttempt,
  LlmRuntimeResult,
} from '../../services/llm/LlmRuntimeService.js';
import { buildChildProcessEnv } from '../../security/ChildProcessEnv.js';
import { ToolPolicyService } from '../../services/ToolPolicyService.js';
import type { ZavorthToolPolicyAction } from '../../contracts/ToolPolicyContract.js';
export type ClaudeAgentSdkCredentialRoute =
  | 'api-key'
  | 'bedrock'
  | 'vertex'
  | 'foundry';

export type ClaudeAgentSdkToolPolicyMode =
  | 'disabled'
  | 'read-only'
  | 'configured';

export type ClaudeAgentSdkRuntimeAdapterOptions = {
  enabled?: boolean;
  credentialRoute?: ClaudeAgentSdkCredentialRoute;
  apiKey?: string;
  model?: string;
  cwd?: string;
  allowedWorkspaceRoots?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  toolPolicyMode?: ClaudeAgentSdkToolPolicyMode;
  requireApprovalForConfiguredTools?: boolean;
  maxTurns?: number;
  maxBudgetUsd?: number;
  env?: Record<string, string | undefined>;
  allowedEnv?: string[];
  query?: ClaudeAgentSdkQueryFunction;
};

type ClaudeAgentSdkQueryFunction = (params: {
  prompt: string;
  options?: ClaudeAgentSdkOptions;
}) => AsyncIterable<SDKMessage>;

type ClaudeAgentSdkModule = {
  query: ClaudeAgentSdkQueryFunction;
};

type ClaudeAgentSdkOptions = {
  cwd?: string;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  tools?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'plan' | 'dontAsk';
  persistSession?: boolean;
  settingSources?: string[];
  env?: Record<string, string | undefined>;
  canUseTool?: CanUseTool;
  abortController?: AbortController;
};

type SDKMessage = Record<string, unknown>;

type PermissionResult = {
  behavior: 'allow';
  updatedInput?: Record<string, unknown>;
  updatedPermissions?: unknown[];
  toolUseID?: string;
  decisionClassification?: 'user_temporary' | 'user_permanent' | 'user_reject';
} | {
  behavior: 'deny';
  message: string;
  interrupt?: boolean;
  toolUseID?: string;
  decisionClassification?: 'user_temporary' | 'user_permanent' | 'user_reject';
};

type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal;
    suggestions?: unknown[];
    blockedPath?: string;
    decisionReason?: string;
    title?: string;
    displayName?: string;
    description?: string;
    toolUseID: string;
    agentID?: string;
  },
) => Promise<PermissionResult>;

const PROVIDER_NAME = 'claude-agent-sdk';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_READ_ONLY_TOOLS = ['Read', 'Glob', 'Grep'];
const BEDROCK_ALLOWED_ENV = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_REGION',
  'AWS_DEFAULT_REGION',
  'AWS_PROFILE',
  'AWS_CONFIG_FILE',
  'AWS_SHARED_CREDENTIALS_FILE',
];
const VERTEX_ALLOWED_ENV = [
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_CLOUD_QUOTA_PROJECT',
  'CLOUDSDK_CONFIG',
];
const FOUNDRY_ALLOWED_ENV = [
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_VERSION',
];
const CLAUDE_TOOL_ZAVORTH_ALIASES: Record<string, string[]> = {
  read: ['Read', 'read', 'read_file', 'workspace.read'],
  glob: ['Glob', 'glob', 'workspace.read'],
  grep: ['Grep', 'grep', 'workspace.read'],
  ls: ['LS', 'ls', 'list_directory', 'workspace.list', 'workspace.read'],
  write: ['Write', 'write', 'write_file', 'filesystem.write'],
  edit: ['Edit', 'edit', 'write_file', 'filesystem.write'],
  multiedit: ['MultiEdit', 'multiedit', 'write_file', 'filesystem.write'],
  notebookedit: ['NotebookEdit', 'notebookedit', 'write_file', 'filesystem.write'],
  bash: ['Bash', 'bash', 'bash_unsafe', 'shell.exec'],
  todowrite: ['TodoWrite', 'todowrite', 'task.write'],
};

export function createClaudeAgentSdkRuntimeFromEnv(
  overrides: ClaudeAgentSdkRuntimeAdapterOptions = {},
): ClaudeAgentSdkRuntimeAdapter {
  return new ClaudeAgentSdkRuntimeAdapter({
    enabled: process.env.ZAVORTH_CLAUDE_AGENT_SDK_ENABLED === 'true',
    credentialRoute: normalizeCredentialRoute(process.env.ZAVORTH_CLAUDE_AGENT_SDK_ROUTE),
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ZAVORTH_CLAUDE_AGENT_SDK_MODEL,
    cwd: process.env.ZAVORTH_CLAUDE_AGENT_SDK_CWD || process.cwd(),
    allowedWorkspaceRoots: normalizeStringList(
      process.env.ZAVORTH_CLAUDE_AGENT_SDK_WORKSPACE_ROOTS?.split(/[;,]/g),
    ),
    allowedTools: parseEnvList(process.env.ZAVORTH_CLAUDE_AGENT_SDK_ALLOWED_TOOLS),
    disallowedTools: parseEnvList(process.env.ZAVORTH_CLAUDE_AGENT_SDK_DISALLOWED_TOOLS),
    toolPolicyMode: normalizeToolPolicyMode(process.env.ZAVORTH_CLAUDE_AGENT_SDK_TOOL_POLICY),
    requireApprovalForConfiguredTools: process.env.ZAVORTH_CLAUDE_AGENT_SDK_REQUIRE_APPROVAL !== 'false',
    maxTurns: Number(process.env.ZAVORTH_CLAUDE_AGENT_SDK_MAX_TURNS || 1),
    maxBudgetUsd: process.env.ZAVORTH_CLAUDE_AGENT_SDK_MAX_BUDGET_USD
      ? Number(process.env.ZAVORTH_CLAUDE_AGENT_SDK_MAX_BUDGET_USD)
      : undefined,
    allowedEnv: parseEnvList(process.env.ZAVORTH_CLAUDE_AGENT_SDK_ALLOWED_ENV),
    ...overrides,
  });
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function parseEnvList(value: unknown): string[] {
  return normalizeStringList(normalizeText(value).split(/[;,]/g));
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function normalizeCredentialRoute(value: unknown): ClaudeAgentSdkCredentialRoute {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'bedrock' || normalized === 'vertex' || normalized === 'foundry') {
    return normalized;
  }
  return 'api-key';
}

function normalizeToolPolicyMode(value: unknown): ClaudeAgentSdkToolPolicyMode {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'read-only' || normalized === 'read_only' || normalized === 'readonly') {
    return 'read-only';
  }
  if (normalized === 'configured') {
    return 'configured';
  }
  return 'disabled';
}

function getCredentialRouteAllowedEnv(route: ClaudeAgentSdkCredentialRoute): string[] {
  if (route === 'bedrock') {
    return BEDROCK_ALLOWED_ENV;
  }
  if (route === 'vertex') {
    return VERTEX_ALLOWED_ENV;
  }
  if (route === 'foundry') {
    return FOUNDRY_ALLOWED_ENV;
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractMessageText(message: SDKMessage): string {
  if (isRecord(message) && message.type === 'result') {
    return normalizeText(message.result);
  }

  if (!isRecord(message) || message.type !== 'assistant') {
    return '';
  }

  const assistantMessage = isRecord(message.message) ? message.message : null;
  const content = Array.isArray(assistantMessage?.content) ? assistantMessage.content : [];
  return content.map((block) => {
    if (!isRecord(block)) {
      return '';
    }
    if (typeof block.text === 'string') {
      return block.text;
    }
    if (typeof block.content === 'string') {
      return block.content;
    }
    return '';
  }).filter(Boolean).join('\n').trim();
}

function extractFinishReason(message: SDKMessage): string {
  if (isRecord(message) && message.type === 'result') {
    return normalizeText(message.stop_reason, message.subtype === 'success' ? 'success' : 'error');
  }
  if (isRecord(message) && message.type === 'assistant') {
    const assistantMessage = isRecord(message.message) ? message.message : null;
    return normalizeText(assistantMessage?.stop_reason, 'assistant');
  }
  return normalizeText(isRecord(message) ? message.type : '', 'unknown');
}

function buildPrompt(messages: ChatMessage[]): string {
  return messages.map((message) => {
    const role = message.role === 'system' ? 'System' : message.role === 'assistant' ? 'Assistant' : 'User';
    return `${role}:\n${normalizeText(message.content)}`;
  }).filter((part) => part.trim()).join('\n\n');
}

export class ClaudeAgentSdkRuntimeAdapter {
  private readonly enabled: boolean;
  private readonly credentialRoute: ClaudeAgentSdkCredentialRoute;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly cwd: string;
  private readonly allowedWorkspaceRoots: string[];
  private readonly allowedTools: string[];
  private readonly disallowedTools: string[];
  private readonly toolPolicyMode: ClaudeAgentSdkToolPolicyMode;
  private readonly requireApprovalForConfiguredTools: boolean;
  private readonly maxTurns: number;
  private readonly maxBudgetUsd: number | undefined;
  private readonly env: Record<string, string | undefined>;
  private readonly allowedEnv: string[];
  private readonly injectedQuery: ClaudeAgentSdkQueryFunction | null;

  constructor(options: ClaudeAgentSdkRuntimeAdapterOptions = {}) {
    this.enabled = options.enabled === true;
    this.credentialRoute = options.credentialRoute || 'api-key';
    this.apiKey = normalizeText(options.apiKey);
    this.model = normalizeText(options.model, DEFAULT_MODEL);
    this.cwd = normalizeText(options.cwd, process.cwd());
    this.allowedWorkspaceRoots = normalizeStringList(options.allowedWorkspaceRoots);
    this.toolPolicyMode = options.toolPolicyMode || 'disabled';
    this.allowedTools = this.resolveAllowedTools(options.allowedTools);
    this.disallowedTools = normalizeStringList(options.disallowedTools);
    this.requireApprovalForConfiguredTools = options.requireApprovalForConfiguredTools !== false;
    this.maxTurns = Math.max(1, Number(options.maxTurns || 1));
    this.maxBudgetUsd = typeof options.maxBudgetUsd === 'number' ? options.maxBudgetUsd : undefined;
    this.env = options.env || {};
    this.allowedEnv = normalizeStringList([
      ...getCredentialRouteAllowedEnv(this.credentialRoute),
      ...(options.allowedEnv || []),
    ]);
    this.injectedQuery = options.query || null;
  }

  public getPreferredProviderName(): string {
    return PROVIDER_NAME;
  }

  public isAvailable(): boolean {
    return this.enabled && this.hasCredentialRoute() && this.isCwdAllowed();
  }

  public async chatDetailed(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: LlmRunOptions,
  ): Promise<LlmRuntimeResult> {
    const modelName = normalizeText(options?.modelName, this.model);
    const providerChain = [PROVIDER_NAME];
    const attempts: LlmRuntimeProviderAttempt[] = [];
    const startedAt = Date.now();

    if (!this.enabled) {
      attempts.push(this.skippedAttempt(modelName, 'claude-agent-sdk-disabled'));
      throw new Error('Claude Agent SDK runtime is disabled. Enable it explicitly before use.');
    }
    if (!this.hasCredentialRoute()) {
      attempts.push(this.skippedAttempt(modelName, 'missing-claude-agent-sdk-credentials'));
      throw new Error('Claude Agent SDK runtime requires API key, Bedrock, Vertex or Foundry credentials.');
    }
    if (!this.isCwdAllowed()) {
      attempts.push(this.skippedAttempt(modelName, 'cwd-outside-allowed-workspace-roots'));
      throw new Error(`Claude Agent SDK cwd is outside allowed workspace roots: ${this.cwd}`);
    }

    try {
      const query = this.injectedQuery || (await this.loadSdk()).query;
      let finalText = '';
      let finishReason = 'unknown';
      let messageCount = 0;
      let streamChunkIndex = 0;
      let sessionId: string | null = null;
      const permissionDecisions: Array<Record<string, unknown>> = [];
      const effectiveAllowedTools = this.resolveEffectiveAllowedTools(options?.toolPolicy, tools);
      await this.emitStreamEvent(options, {
        type: 'start',
        accumulated: '',
        done: false,
        metadata: this.buildStreamMetadata(modelName),
      });

      for await (const message of query({
        prompt: buildPrompt(messages),
        options: this.buildSdkOptions(modelName, options, permissionDecisions, effectiveAllowedTools),
      })) {
        messageCount += 1;
        if (isRecord(message) && typeof message.session_id === 'string') {
          sessionId = message.session_id;
        }
        const text = extractMessageText(message);
        if (text) {
          const delta = text.startsWith(finalText) ? text.slice(finalText.length) : text;
          finalText = text;
          if (delta) {
            streamChunkIndex += 1;
            await this.emitStreamEvent(options, {
              type: 'delta',
              delta,
              accumulated: finalText,
              chunkIndex: streamChunkIndex,
              done: false,
              metadata: this.buildStreamMetadata(modelName, sessionId),
            });
          }
        }
        finishReason = extractFinishReason(message);
      }

      attempts.push({
        providerName: PROVIDER_NAME,
        modelName,
        status: 'succeeded',
        fallback: false,
        durationMs: Math.max(0, Date.now() - startedAt),
      });

      const response = {
        content: finalText,
        toolCalls: [],
        finishReason,
      };
      await this.emitStreamEvent(options, {
        type: 'done',
        accumulated: finalText,
        response,
        done: true,
        metadata: this.buildStreamMetadata(modelName, sessionId),
      });

      return {
        providerName: PROVIDER_NAME,
        modelName,
        response,
        metadata: {
          providerNativeTokenStreaming: Boolean(options?.stream?.onEvent),
          providerNativeStreamSource: 'claude-agent-sdk-query',
          claudeAgentSdk: {
            credentialRoute: this.credentialRoute,
            cwd: this.cwd,
            toolPolicyMode: this.toolPolicyMode,
            permissionMode: this.resolvePermissionMode(effectiveAllowedTools),
            allowedTools: effectiveAllowedTools,
            disallowedTools: this.disallowedTools,
            requireApprovalForConfiguredTools: this.requireApprovalForConfiguredTools,
            sessionId,
            sdkMessageCount: messageCount,
            permissionDecisions,
          },
        },
        route: {
          source: 'LlmRuntimeService',
          requestedProviderName: normalizeText(options?.providerName, PROVIDER_NAME),
          primaryProviderName: PROVIDER_NAME,
          providerName: PROVIDER_NAME,
          modelName,
          fallbackAllowed: false,
          fallbackUsed: false,
          providerChain,
          attempts,
          request: {
            messageCount: messages.length,
            toolCount: tools?.length || 0,
            inputChars: messages.reduce((total, message) => total + normalizeText(message.content).length, 0),
          },
        },
        ...(sessionId ? {
          sessionId,
        } as unknown as Record<string, unknown> : {}),
      };
    } catch (error: unknown) {
      attempts.push({
        providerName: PROVIDER_NAME,
        modelName,
        status: 'failed',
        fallback: false,
        durationMs: Math.max(0, Date.now() - startedAt),
        error: error instanceof Error ? error.message : String(error || 'erro desconhecido'),
      });
      throw error;
    }
  }

  private async emitStreamEvent(
    options: LlmRunOptions | undefined,
    event: LlmStreamEvent,
  ): Promise<void> {
    await options?.stream?.onEvent?.({
      ...event,
      providerName: PROVIDER_NAME,
      modelName: normalizeText(event.metadata?.providerNativeStreamModel) || null,
      fallback: false,
      native: true,
    });
  }

  private buildStreamMetadata(modelName: string, sessionId?: string | null): Record<string, unknown> {
    return {
      providerNativeTokenStreaming: true,
      providerNativeStreamSource: 'claude-agent-sdk-query',
      providerNativeStreamProvider: PROVIDER_NAME,
      providerNativeStreamModel: modelName,
      ...(sessionId ? { claudeAgentSdkSessionId: sessionId } : {}),
    };
  }

  private resolveAllowedTools(rawAllowedTools: string[] | undefined): string[] {
    if (this.toolPolicyMode === 'disabled') {
      return [];
    }
    if (this.toolPolicyMode === 'read-only') {
      return DEFAULT_READ_ONLY_TOOLS;
    }
    return normalizeStringList(rawAllowedTools);
  }

  private resolveEffectiveAllowedTools(
    toolPolicy?: LlmRunOptions['toolPolicy'],
    tools?: ToolDefinition[],
  ): string[] {
    if (this.toolPolicyMode !== 'configured') {
      return this.allowedTools;
    }
    const configuredTools = this.allowedTools.length > 0
      ? this.allowedTools
      : this.mapZavorthToolsToClaudeTools(tools || []);
    if (!this.requireApprovalForConfiguredTools) {
      return configuredTools;
    }
    const approved = new Set(normalizeStringList(toolPolicy?.approvedToolIds).map((tool) => tool.toLowerCase()));
    const exposedSafe = new Set(
      (toolPolicy?.exposedTools || [])
        .filter((tool) => tool.requiresApproval !== true && tool.risk === 'safe')
        .map((tool) => tool.id.toLowerCase()),
    );
    return configuredTools.filter((tool) => {
      const aliases = this.resolveToolAliases(tool).map((alias) => alias.toLowerCase());
      return aliases.some((alias) => approved.has(alias) || exposedSafe.has(alias));
    });
  }

  private mapZavorthToolsToClaudeTools(tools: ToolDefinition[]): string[] {
    const names = new Set(tools.map((tool) => normalizeText(tool.name).toLowerCase()).filter(Boolean));
    const mapped: string[] = [];
    const add = (tool: string) => {
      if (!mapped.includes(tool)) {
        mapped.push(tool);
      }
    };
    if (names.has('read_file') || names.has('workspace.read')) {
      add('Read');
      add('Grep');
      add('Glob');
    }
    if (names.has('list_directory') || names.has('workspace.list')) {
      add('LS');
    }
    return mapped;
  }

  private resolvePermissionMode(effectiveAllowedTools: string[]): 'plan' | 'dontAsk' {
    return effectiveAllowedTools.length > 0 ? 'dontAsk' : 'plan';
  }

  private hasCredentialRoute(): boolean {
    if (this.credentialRoute === 'api-key') {
      return Boolean(this.apiKey);
    }
    if (this.credentialRoute === 'bedrock') {
      return true;
    }
    if (this.credentialRoute === 'vertex') {
      return true;
    }
    if (this.credentialRoute === 'foundry') {
      return true;
    }
    return false;
  }

  private isCwdAllowed(): boolean {
    if (this.allowedWorkspaceRoots.length === 0) {
      return true;
    }
    const cwd = normalizePath(this.cwd);
    return this.allowedWorkspaceRoots.some((root) => {
      const normalizedRoot = normalizePath(root);
      return cwd === normalizedRoot || cwd.startsWith(`${normalizedRoot}/`);
    });
  }

  private buildSdkOptions(
    model: string,
    options: LlmRunOptions | undefined,
    permissionDecisions: Array<Record<string, unknown>>,
    effectiveAllowedTools: string[],
  ): ClaudeAgentSdkOptions {
    return {
      cwd: this.cwd,
      model,
      maxTurns: this.maxTurns,
      ...(typeof this.maxBudgetUsd === 'number' ? { maxBudgetUsd: this.maxBudgetUsd } : {}),
      tools: effectiveAllowedTools,
      allowedTools: effectiveAllowedTools,
      disallowedTools: this.disallowedTools,
      permissionMode: this.resolvePermissionMode(effectiveAllowedTools),
      persistSession: false,
      settingSources: [],
      env: this.buildEnv(),
      ...(options?.signal ? { abortController: this.buildAbortController(options.signal) } : {}),
      canUseTool: this.buildCanUseTool(options?.toolPolicy, effectiveAllowedTools, permissionDecisions),
    };
  }

  private buildAbortController(signal: AbortSignal): AbortController {
    const controller = new AbortController();
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    return controller;
  }

  private buildEnv(): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = buildChildProcessEnv({
      explicitEnv: {
        ...this.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: 'zavorth/claude-agent-sdk-runtime',
      },
      allowedEnv: this.allowedEnv,
    });
    if (this.apiKey) {
      env.ANTHROPIC_API_KEY = this.apiKey;
    }
    if (this.credentialRoute === 'bedrock') {
      env.CLAUDE_CODE_USE_BEDROCK = '1';
    }
    if (this.credentialRoute === 'vertex') {
      env.CLAUDE_CODE_USE_VERTEX = '1';
    }
    if (this.credentialRoute === 'foundry') {
      env.CLAUDE_CODE_USE_FOUNDRY = '1';
    }
    return env;
  }

  private buildCanUseTool(
    toolPolicy: LlmRunOptions['toolPolicy'] | undefined,
    effectiveAllowedTools: string[],
    permissionDecisions: Array<Record<string, unknown>>,
  ): CanUseTool {
    const allowed = new Set(effectiveAllowedTools.map((tool) => tool.toLowerCase()));
    const toolPolicyService = new ToolPolicyService();

    return async (toolName, input, permissionOptions): Promise<PermissionResult> => {
      const normalizedToolName = toolName.toLowerCase();
      const targetPath = (input?.path || input?.filePath || input?.file_path || input?.target || input?.dest) as string | undefined;
      const action = this.mapToolToPolicyAction(toolName);

      let isAllowed = allowed.has(normalizedToolName);
      let decisionReason = 'allowed-by-zavorth-policy';

      if (!isAllowed && action) {
        const policyRes = toolPolicyService.checkPermission(action, { targetPath });
        if (policyRes.level === 'allow') {
          isAllowed = true;
          decisionReason = `allowed-by-dynamic-tool-policy-with-context (${policyRes.level})`;
        } else if (policyRes.level === 'deny') {
          isAllowed = false;
          decisionReason = `explicitly-denied-by-tool-policy`;
        }
      }

      if (isAllowed) {
        permissionDecisions.push(this.buildPermissionDecisionReceipt({
          toolName,
          allowed: true,
          reason: decisionReason,
          toolUseID: permissionOptions.toolUseID,
          toolPolicy,
        }));
        return {
          behavior: 'allow',
          toolUseID: permissionOptions.toolUseID,
          updatedInput: input,
          decisionClassification: 'user_temporary',
        };
      }

      permissionDecisions.push(this.buildPermissionDecisionReceipt({
        toolName,
        allowed: false,
        reason: decisionReason === 'allowed-by-zavorth-policy' ? 'blocked-by-zavorth-policy' : decisionReason,
        toolUseID: permissionOptions.toolUseID,
        toolPolicy,
      }));
      return {
        behavior: 'deny',
        toolUseID: permissionOptions.toolUseID,
        message: `Zavorth policy blocked Claude Agent SDK tool "${toolName}".`,
        interrupt: false,
        decisionClassification: 'user_reject',
      };
    };
  }

  private mapToolToPolicyAction(toolName: string): ZavorthToolPolicyAction | null {
    const norm = toolName.toLowerCase();
    if (['read', 'glob', 'grep', 'ls', 'view_file', 'list_dir', 'grep_search'].includes(norm)) return 'file.read';
    if (['write', 'edit', 'multiedit', 'notebookedit', 'write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(norm)) return 'file.write';
    if (['bash', 'shell', 'exec', 'run_command', 'shell.execute'].includes(norm)) return 'shell.execute';
    if (['fetch', 'curl', 'wget', 'network.fetch', 'read_url', 'read_browser_page', 'search_web'].includes(norm)) return 'network.fetch';
    if (['delegate', 'subagent', 'subagent.delegate', 'invoke_subagent', 'send_message'].includes(norm)) return 'subagent.delegate';
    if (norm.includes('mcp')) return 'mcp.execute';
    return null;
  }

  private buildPermissionDecisionReceipt(input: {
    toolName: string;
    allowed: boolean;
    reason: string;
    toolUseID: string;
    toolPolicy?: LlmRunOptions['toolPolicy'];
  }): Record<string, unknown> {
    return {
      toolName: input.toolName,
      toolUseID: input.toolUseID,
      allowed: input.allowed,
      reason: input.reason,
      approvalGranted: input.toolPolicy?.approvalGranted === true,
      approvedToolIds: input.toolPolicy?.approvedToolIds || [],
      aliases: this.resolveToolAliases(input.toolName),
    };
  }

  private resolveToolAliases(toolName: string): string[] {
    const normalized = normalizeText(toolName).toLowerCase();
    return Array.from(new Set([
      toolName,
      normalized,
      ...(CLAUDE_TOOL_ZAVORTH_ALIASES[normalized] || []),
    ].map((tool) => normalizeText(tool)).filter(Boolean)));
  }

  private skippedAttempt(modelName: string, error: string): LlmRuntimeProviderAttempt {
    return {
      providerName: PROVIDER_NAME,
      modelName,
      status: 'skipped_unavailable',
      fallback: false,
      durationMs: 0,
      error,
    };
  }

  private async loadSdk(): Promise<ClaudeAgentSdkModule> {
    const loaded = await import('@anthropic-ai/claude-agent-sdk') as unknown;
    if (!isRecord(loaded) || typeof loaded.query !== 'function') {
      throw new Error('Claude Agent SDK package did not expose query().');
    }
    return {
      query: loaded.query as ClaudeAgentSdkQueryFunction,
    };
  }
}
