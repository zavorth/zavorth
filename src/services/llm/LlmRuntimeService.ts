import { createClaudeAgentSdkRuntimeFromEnv } from '../../adapters/claude/ClaudeAgentSdkRuntimeAdapter.js';
import { redactSensitiveText } from '../../security/SensitiveDataGuard.js';
import fs from 'fs';
import { config } from '../../config/index.js';
import { ProviderFactory } from '../../providers/ProviderFactory.js';
import type {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolDefinition,
} from '../../providers/ILlmProvider.js';

import { defaultLlmRuntimeTelemetryService } from './LlmRuntimeTelemetryService.js';
import type { LlmRuntimeTelemetryAttemptStatus } from './LlmRuntimeTelemetryService.js';
import {
  buildLlmEgressGuardMetadata,
  sanitizeLlmEgressPayload,
} from '../../security/LlmEgressGuard.js';

import { ProviderNativeCapabilityMatrixService } from './ProviderNativeCapabilityMatrixService.js';
import { logger } from '../../logger.js';
import { resolveUserProviderSelection } from '../UserSelectionResolver.js';
import {
  modelsForProvider,
  resolveUserStackProviderChain,
  uniqueProvidersFromHops,
  type UserStackProviderHop,
} from './UserStackProviderChain.js';
import { ProviderHotPathCircuitBreaker } from './ProviderHotPathCircuitBreaker.js';
import { runPluginOsHook } from '../PluginOsHookPipelineAccess.js';

export type LlmRunOptions = {
  providerName?: string;
  modelName?: string;
  workspace?: string | null;
  /**
   * When true (default), fail over across the **user** provider stack
   * (primary → secondary model → user fallbacks). Set false to pin a single hop.
   */
  allowFallback?: boolean;
  fallbackOrder?: string[];
  providerNativeTools?: ProviderChatOptions['providerNativeTools'];
  /** Provider-facing reasoning effort parameter. */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
  /** Cost route classification applied by AgentRunCostEffortRouting. */
  costRouteClass?: 'premium' | 'standard' | 'background';
  costRouteReason?: string;
  signal?: AbortSignal;
  stream?: {
    mode?: 'auto' | 'off';
    onEvent?: (event: LlmRuntimeStreamEvent) => void | Promise<void>;
  };
  toolPolicy?: LlmRuntimeToolPolicyContext;
  telemetry?: {
    runId?: string | null;
    traceId?: string | null;
    sessionId?: string | null;
    surface?: string | null;
  };
};

export type LlmRuntimeStreamEvent = LlmStreamEvent & {
  providerName: string;
  modelName: string | null;
  fallback: boolean;
  native: boolean;
};

export type LlmRuntimeToolPolicyContext = {
  requestedTools?: string[];
  approvedToolIds?: string[];
  approvalGranted?: boolean;
  exposedTools?: Array<{
    id: string;
    risk?: string;
    requiresApproval?: boolean;
  }>;
};

export type LlmRuntimeProviderAttempt = {
  providerName: string;
  modelName: string | null;
  status: 'skipped_unavailable' | 'failed' | 'succeeded';
  fallback: boolean;
  durationMs: number;
  error?: string;
};

export type LlmRuntimeRouteReceipt = {
  source: 'LlmRuntimeService';
  requestedProviderName: string;
  primaryProviderName: string;
  providerName: string;
  modelName: string | null;
  fallbackAllowed: boolean;
  fallbackUsed: boolean;
  providerChain: string[];
  attempts: LlmRuntimeProviderAttempt[];
  request: {
    messageCount: number;
    toolCount: number;
    inputChars: number;
  };
};

export type LlmRuntimeResult = {
  providerName: string;
  modelName: string | null;
  response: LlmResponse;
  route: LlmRuntimeRouteReceipt;
  metadata?: Record<string, unknown>;
};

type AIGatewayHealthSnapshot = {
  ready?: boolean;
  running?: boolean;
  checkedAt?: string;
};

const AIGATEWAY_STATUS_MAX_AGE_MS = 10 * 60 * 1000;

const DEFAULT_FALLBACK_ORDER: string[] = [
  // User-configured only (config.echoLlmFallbackOrder / options.fallbackOrder). No product vendor chain.
];

const PROVIDER_NATIVE_CAPABILITY_MATRIX = new ProviderNativeCapabilityMatrixService();

export class LlmRuntimeService {
  constructor(private readonly preferredProviderName?: string) {}

  public getPreferredProviderName(): string {
    const preferred = String(this.preferredProviderName || config.llmProvider || '').trim();
    if (!preferred) {
      throw new Error('No provider selected. Choose a provider with setup or `zavorth providers switch`.');
    }
    return this.normalizeProviderName(preferred);
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: LlmRunOptions,
  ): Promise<LlmResponse> {
    const result = await this.chatDetailed(messages, tools, options);
    return result.response;
  }

  public async chatDetailed(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: LlmRunOptions,
  ): Promise<LlmRuntimeResult> {
    this.throwIfAborted(options?.signal);
    const guardedPayload = sanitizeLlmEgressPayload(messages, tools);
    const safeMessages = guardedPayload.messages;
    const safeTools = guardedPayload.tools;
    const egressGuardMetadata = buildLlmEgressGuardMetadata(guardedPayload.report);
    // Phase 1: default fallback ON unless explicitly disabled (user stack only).
    const fallbackAllowed = options?.allowFallback !== false;
    const stackHops = this.resolveUserStackHops(options, fallbackAllowed);
    const providerChain = uniqueProvidersFromHops(stackHops);
    const primaryProviderName = providerChain[0] || this.getPreferredProviderName();
    const requestedProviderName = this.normalizeProviderName(
      options?.providerName || this.getPreferredProviderName(),
    );

    await runPluginOsHook({
      event: 'llm.before_request',
      workspace: options?.workspace ?? null,
      context: {
        messageCount: safeMessages.length,
        toolCount: Array.isArray(safeTools) ? safeTools.length : 0,
        requestedProviderName,
        primaryProviderName,
        providerChain,
      },
    });
    const secondaryModelId = this.resolveSecondaryModelId(options);
    const circuit = ProviderHotPathCircuitBreaker.getInstance();
    const attempts: LlmRuntimeProviderAttempt[] = [];
    let lastError: unknown = null;

    for (const providerName of providerChain) {
      this.throwIfAborted(options?.signal);
      const providerOptions = this.resolveProviderChatOptions(providerName, primaryProviderName, options);
      const attemptStartedAt = Date.now();

      if (!circuit.canAttempt(providerName)) {
        this.recordAttempt(attempts, {
          providerName,
          modelName: providerOptions?.modelName || null,
          status: 'skipped_unavailable',
          fallback: providerName !== primaryProviderName,
          durationMs: Date.now() - attemptStartedAt,
          error: 'circuit_breaker_open',
        }, {
          options,
          requestedProviderName,
          primaryProviderName,
          fallbackAllowed,
        });
        continue;
      }

      if (!this.isProviderAvailable(providerName)) {
        this.recordAttempt(attempts, {
          providerName,
          modelName: providerOptions?.modelName || null,
          status: 'skipped_unavailable',
          fallback: providerName !== primaryProviderName,
          durationMs: Date.now() - attemptStartedAt,
        }, {
          options,
          requestedProviderName,
          primaryProviderName,
          fallbackAllowed,
        });
        continue;
      }

      const modelAttempts = this.resolveModelAttemptsForProvider(
        stackHops,
        providerName,
        primaryProviderName,
        providerOptions?.modelName || options?.modelName || null,
        secondaryModelId,
      );

      for (let modelIndex = 0; modelIndex < modelAttempts.length; modelIndex += 1) {
        let modelName = modelAttempts[modelIndex];
        const modelAttemptStartedAt = Date.now();
        const usingSecondary = Boolean(
          secondaryModelId && modelName && modelName === secondaryModelId,
        );
        try {
          if (this.isClaudeAgentSdkProvider(providerName)) {
            const adapter = createClaudeAgentSdkRuntimeFromEnv();
            const result = await adapter.chatDetailed(safeMessages, safeTools, {
              providerName,
              ...(modelName ? { modelName } : {}),
              allowFallback: false,
              ...(options?.signal ? { signal: options.signal } : {}),
              ...(options?.toolPolicy ? { toolPolicy: options.toolPolicy } : {}),
              ...(options?.stream ? { stream: options.stream } : {}),
            });
            void circuit.recordSuccess(providerName);
            this.recordAttempt(attempts, {
              providerName,
              modelName,
              status: 'succeeded',
              fallback: providerName !== primaryProviderName || usingSecondary,
              durationMs: Date.now() - modelAttemptStartedAt,
            }, {
              options,
              requestedProviderName,
              primaryProviderName,
              fallbackAllowed,
            });
            const claudeResult = {
              ...result,
              metadata: this.mergeMetadata(
                result.metadata,
                egressGuardMetadata,
                this.buildProviderNativeCapabilityMetadata({
                  providerName,
                  modelName,
                  metadata: result.metadata,
                  content: result.response.content,
                }),
                usingSecondary ? { usedSecondaryModel: true, secondaryModelId } : undefined,
                {
                  userStackFallback: true,
                  fallbackAllowed,
                  circuitBreakers: circuit.snapshot(),
                },
              ),
              route: this.buildRouteReceipt({
                messages: safeMessages,
                tools: safeTools,
                requestedProviderName,
                primaryProviderName,
                providerName,
                modelName,
                fallbackAllowed,
                providerChain,
                attempts,
              }),
            };
            await runPluginOsHook({
              event: 'llm.after_request',
              workspace: options?.workspace ?? null,
              context: {
                ok: true,
                providerName,
                modelName,
                durationMs: Date.now() - modelAttemptStartedAt,
              },
            });
            return claudeResult;
          }

          const provider = this.createProvider(providerName);
          const response = await this.chatProvider({
            provider,
            providerName,
            modelName,
            primaryProviderName,
            messages: safeMessages,
            tools: safeTools,
            providerOptions: {
              ...(providerOptions || {}),
              ...(modelName ? { modelName } : {}),
            },
            options,
          });
          void circuit.recordSuccess(providerName);
          this.recordAttempt(attempts, {
            providerName,
            modelName,
            status: 'succeeded',
            fallback: providerName !== primaryProviderName || usingSecondary,
            durationMs: Date.now() - modelAttemptStartedAt,
          }, {
            options,
            requestedProviderName,
            primaryProviderName,
            fallbackAllowed,
          });
          const providerResult = {
            providerName,
            modelName,
            response,
            metadata: this.mergeMetadata(
              (response as unknown as { metadata?: Record<string, unknown> }).metadata,
              egressGuardMetadata,
              this.buildProviderNativeCapabilityMetadata({
                providerName,
                modelName,
                metadata: (response as unknown as { metadata?: Record<string, unknown> }).metadata,
                content: response.content,
              }),
              usingSecondary ? { usedSecondaryModel: true, secondaryModelId } : undefined,
              {
                userStackFallback: true,
                fallbackAllowed,
                circuitBreakers: circuit.snapshot(),
              },
            ),
            route: this.buildRouteReceipt({
              messages: safeMessages,
              tools: safeTools,
              requestedProviderName,
              primaryProviderName,
              providerName,
              modelName,
              fallbackAllowed,
              providerChain,
              attempts,
            }),
          };
          await runPluginOsHook({
            event: 'llm.after_request',
            workspace: options?.workspace ?? null,
            context: {
              ok: true,
              providerName,
              modelName,
              durationMs: Date.now() - modelAttemptStartedAt,
            },
          });
          return providerResult;
        } catch (error: unknown) {
          lastError = error;
          if (this.isAbortError(error, options?.signal)) {
            this.recordAttempt(attempts, {
              providerName,
              modelName,
              status: 'failed',
              fallback: providerName !== primaryProviderName || usingSecondary,
              durationMs: Date.now() - modelAttemptStartedAt,
              error: 'llm_request_aborted',
            }, {
              options,
              requestedProviderName,
              primaryProviderName,
              fallbackAllowed,
            });
            throw this.toAbortError(error);
          }
          void circuit.recordFailure(providerName, error);
          this.recordAttempt(attempts, {
            providerName,
            modelName,
            status: 'failed',
            fallback: providerName !== primaryProviderName || usingSecondary,
            durationMs: Date.now() - modelAttemptStartedAt,
            error: this.errorMessage(error),
          }, {
            options,
            requestedProviderName,
            primaryProviderName,
            fallbackAllowed,
          });
          const hasMoreModels = modelIndex < modelAttempts.length - 1;
          // Secondary model only on model-scoped / transient failures — not auth, schema, or client 4xx.
          if (hasMoreModels && this.isSecondaryModelRetryableError(error)) {
            continue;
          }
          if (hasMoreModels && !this.isSecondaryModelRetryableError(error)) {
            // Non-retryable primary model error: still try next provider if fallback allowed.
            if (!fallbackAllowed) {
              throw error;
            }
            break;
          }
          if (!fallbackAllowed) {
            throw error;
          }
          // Continue to next provider in user stack
        }
      }
    }

    if (lastError instanceof Error) {
      await runPluginOsHook({
        event: 'llm.after_request',
        workspace: options?.workspace ?? null,
        context: {
          ok: false,
          error: lastError.message,
          attempts: attempts.length,
        },
      });
      throw lastError;
    }

    await runPluginOsHook({
      event: 'llm.after_request',
      workspace: options?.workspace ?? null,
      context: {
        ok: false,
        error: 'No LLM provider is available for this execution.',
        attempts: attempts.length,
      },
    });
    throw new Error('No LLM provider is available for this execution.');
  }

  /** Secondary-model retry: model missing/unsupported/overloaded — not auth or request-shape bugs. */
  private isSecondaryModelRetryableError(error: unknown): boolean {
    const message = this.errorMessage(error).toLowerCase();
    if (/api[_ ]?key|invalid[_ ]?api|unauthorized|authentication|auth|forbidden|permission denied|401|403/.test(message)) {
      return false;
    }
    if (/invalid[_ ]?request|tool.?schema|json.?schema|context.?length|too many tokens|payload/.test(message)) {
      return false;
    }
    return /model.?not.?found|unsupported.?model|invalid.?model|unknown.?model|model_not_found|does not exist|model.?unavailable|overloaded|rate.?limit|resource.?exhausted|capacity|timeout|temporar|503|502|500|529|econnreset|etimedout|socket/.test(message);
  }

  private resolveSecondaryModelId(_options?: LlmRunOptions): string | null {
    const selection = resolveUserProviderSelection({});
    const fromSelection = String(selection.secondaryModelId || '').trim();
    if (fromSelection) return fromSelection;
    const fromConfig = String((config as { secondaryModelId?: string }).secondaryModelId || '').trim();
    return fromConfig || null;
  }

  private recordAttempt(
    attempts: LlmRuntimeProviderAttempt[],
    attempt: {
      providerName: string;
      modelName: string | null;
      status: LlmRuntimeTelemetryAttemptStatus;
      fallback: boolean;
      durationMs: number;
      error?: string;
    },
    context: {
      options?: LlmRunOptions;
      requestedProviderName: string;
      primaryProviderName: string;
      fallbackAllowed: boolean;
    },
  ): void {
    const normalizedAttempt: LlmRuntimeProviderAttempt = {
      ...attempt,
      durationMs: Math.max(0, Math.round(attempt.durationMs)),
    };
    attempts.push(normalizedAttempt);
    defaultLlmRuntimeTelemetryService.recordAttempt({
      ...normalizedAttempt,
      requestedProviderName: context.requestedProviderName,
      primaryProviderName: context.primaryProviderName,
      fallbackAllowed: context.fallbackAllowed,
      surface: context.options?.telemetry?.surface || 'runtime',
      runId: context.options?.telemetry?.runId || null,
      traceId: context.options?.telemetry?.traceId || null,
      sessionId: context.options?.telemetry?.sessionId || null,
    });
  }

  private buildRouteReceipt(input: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    requestedProviderName: string;
    primaryProviderName: string;
    providerName: string;
    modelName: string | null;
    fallbackAllowed: boolean;
    providerChain: string[];
    attempts: LlmRuntimeProviderAttempt[];
  }): LlmRuntimeRouteReceipt {
    return {
      source: 'LlmRuntimeService',
      requestedProviderName: input.requestedProviderName,
      primaryProviderName: input.primaryProviderName,
      providerName: input.providerName,
      modelName: input.modelName,
      fallbackAllowed: input.fallbackAllowed,
      fallbackUsed:
        input.providerName !== input.primaryProviderName
        || input.attempts.some((attempt) => attempt.fallback === true && attempt.status === 'succeeded'),
      providerChain: input.providerChain,
      attempts: input.attempts.map((attempt) => ({ ...attempt })),
      request: {
        messageCount: input.messages.length,
        toolCount: input.tools?.length || 0,
        inputChars: input.messages.reduce((total, message) => total + String(message.content || '').length, 0),
      },
    };
  }

  public isProviderAvailable(name: string): boolean {
    const normalized = this.normalizeProviderName(name);
    switch (normalized) {
      case 'aigateway':
        return this.isAIGatewayAvailable();
      case 'gemini':
        return Boolean(config.geminiApiKey || config.geminiApiKeys.length > 0);
      case 'gemini-interactions':
        return Boolean(
          (config.geminiInteractionsEnabled || process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED === 'true')
          && (config.geminiInteractionsApiKey || config.geminiApiKey || process.env.GEMINI_API_KEY)
        );
      case 'deepseek':
        return Boolean(config.deepseekApiKey);
      case 'openai':
        return Boolean(config.openaiApiKey || config.openaiApiKeys?.length > 0);
      case 'minimax':
        return Boolean(config.minimaxApiKey);
      case 'openrouter':
        return Boolean(config.openRouterApiKey);
      case 'groq':
        return Boolean(config.groqApiKey || process.env.GROQ_API_KEY);
      case 'qwen':
      case 'puter':
        return Boolean(config.puterAuthToken);
      case 'opencode':
        return Boolean(config.openCodeApiKey);
      case 'claude-agent-sdk':
      case 'claude_agent_sdk':
        return createClaudeAgentSdkRuntimeFromEnv().isAvailable();
      case 'anthropic-direct':
        return Boolean(process.env.ANTHROPIC_API_KEY);
      case 'anthropic-vertex':
        return Boolean(process.env.ANTHROPIC_VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT);
      case 'bedrock-claude':
        return Boolean(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION);
      case 'google-genai':
        return Boolean(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_PROJECT);
      case 'lmstudio':
      case 'vllm':
        return true;
      case 'ollama':
        // Ollama é local — sempre "disponível" (se o servidor estiver rodando)
        // A verificação real acontece no momento da conexão via testConnection()
        return true;
      default:
        return this.isProviderFactoryRouteAvailable(normalized);
    }
  }

  private isProviderFactoryRouteAvailable(providerName: string): boolean {
    try {
      const target = ProviderFactory.resolveRuntimeTarget(providerName);
      if (!target.runtimeSupported) {
        return false;
      }
      if (target.adapterKind === 'local_openai_compatible') {
        return Boolean(target.baseUrl);
      }
      if (
        target.adapterKind === 'openai_compatible'
        || target.adapterKind === 'anthropic_compatible'
        || target.adapterKind === 'gateway'
      ) {
        return Boolean(target.baseUrl && target.apiKey);
      }
      return false;
    } catch (error: unknown) {logger.warn('[Llm Runtime] operation failed', error); return false; }
  }

  private isAIGatewayAvailable(): boolean {
    const configuredBaseUrl = String(config.AIGatewayBaseUrl || '').trim();
    if (!configuredBaseUrl) {
      return false;
    }

    const localGatewayBaseUrl = String(config.zavorthAIGatewayGatewayBaseUrl || '').trim();
    if (!localGatewayBaseUrl || this.normalizeUrl(configuredBaseUrl) !== this.normalizeUrl(localGatewayBaseUrl)) {
      return true;
    }

    const snapshot = this.readAIGatewayHealthSnapshot();
    if (!snapshot?.ready || !snapshot?.running) {
      return false;
    }

    const checkedAtMs = Date.parse(String(snapshot.checkedAt || ''));
    if (!Number.isFinite(checkedAtMs)) {
      return false;
    }

    return (Date.now() - checkedAtMs) <= AIGATEWAY_STATUS_MAX_AGE_MS;
  }

  private readAIGatewayHealthSnapshot(): AIGatewayHealthSnapshot | null {
    try {
      const statusFile = String(config.AIGatewayGatewayStatusFile || '').trim();
      if (!statusFile || !fs.existsSync(statusFile)) {
        return null;
      }

      const raw = fs.readFileSync(statusFile, 'utf8');
      return JSON.parse(raw) as AIGatewayHealthSnapshot;
    } catch (error: unknown) {logger.warn('[Llm Runtime] JSON parse failed', error); return null; }
  }

  private createProvider(name: string): ILlmProvider {
    return ProviderFactory.create(name);
  }

  private async chatProvider(input: {
    provider: ILlmProvider;
    providerName: string;
    modelName: string | null;
    primaryProviderName: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    providerOptions?: ProviderChatOptions;
    options?: LlmRunOptions;
  }): Promise<LlmResponse> {
    if (
      input.options?.stream?.mode !== 'off'
      && input.options?.stream?.onEvent
      && input.provider.streamChat
    ) {
      return this.collectProviderStream(input);
    }

    return input.provider.chat(input.messages, input.tools, input.providerOptions);
  }

  private async collectProviderStream(input: {
    provider: ILlmProvider;
    providerName: string;
    modelName: string | null;
    primaryProviderName: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    providerOptions?: ProviderChatOptions;
    options?: LlmRunOptions;
  }): Promise<LlmResponse> {
    let finalResponse: LlmResponse | null = null;
    let accumulated = '';
    let chunkIndex = 0;
    const fallback = input.providerName !== input.primaryProviderName;
    const stream = input.provider.streamChat!(
      input.messages,
      input.tools,
      input.providerOptions,
    );

    for await (const event of stream) {
      if (typeof event.accumulated === 'string') {
        accumulated = event.accumulated;
      }
      if (event.type === 'delta') {
        chunkIndex = event.chunkIndex || chunkIndex + 1;
      }
      if (event.response) {
        finalResponse = event.response;
      }
      await this.emitStreamEvent(input.options, {
        ...event,
        chunkIndex: event.chunkIndex || chunkIndex,
        providerName: input.providerName,
        modelName: input.modelName,
        fallback,
        native: true,
        metadata: {
          ...(event.metadata || {}),
          providerNativeTokenStreaming: true,
          providerNativeStreamProvider: input.providerName,
          providerNativeStreamModel: input.modelName,
        },
      });
    }

    if (finalResponse) {
      return {
        ...finalResponse,
        metadata: this.mergeMetadata(finalResponse.metadata, {
          providerNativeTokenStreaming: true,
          providerNativeStreamProvider: input.providerName,
          providerNativeStreamModel: input.modelName,
        }),
      };
    }

    return {
      content: accumulated || null,
      toolCalls: [],
      finishReason: 'stop',
      metadata: {
        providerNativeTokenStreaming: true,
        providerNativeStreamProvider: input.providerName,
        providerNativeStreamModel: input.modelName,
      },
    };
  }

  private async emitStreamEvent(
    options: LlmRunOptions | undefined,
    event: LlmRuntimeStreamEvent,
  ): Promise<void> {
    await options?.stream?.onEvent?.(event);
  }

  private mergeMetadata(
    ...items: Array<Record<string, unknown> | undefined>
  ): Record<string, unknown> | undefined {
    const present = items.filter((item): item is Record<string, unknown> => Boolean(item));
    if (present.length === 0) {
      return undefined;
    }
    return Object.assign({}, ...present);
  }

  private buildProviderNativeCapabilityMetadata(input: {
    providerName: string;
    modelName: string | null;
    metadata?: Record<string, unknown>;
    content?: string | null;
  }): Record<string, unknown> | undefined {
    const summary = PROVIDER_NATIVE_CAPABILITY_MATRIX.summarizeMetadata(input);
    const assessments = Array.isArray(summary.assessments) ? summary.assessments : [];
    const hasNativeTokenStreaming = input.metadata?.providerNativeTokenStreaming === true;
    if (assessments.length === 0 && !hasNativeTokenStreaming) {
      return undefined;
    }
    return {
      providerNativeCapabilityMatrix: summary,
    };
  }

  private isClaudeAgentSdkProvider(providerName: string): boolean {
    const normalized = this.normalizeProviderName(providerName).replace(/_/g, '-');
    return normalized === 'claude-agent-sdk';
  }

  private resolveProviderChatOptions(
    providerName: string,
    primaryProviderName: string,
    options?: LlmRunOptions,
  ): ProviderChatOptions | undefined {
    const requestedModelName = String(options?.modelName || '').trim();
    let modelName = requestedModelName;

    // Never reuse a provider-specific model override on a different fallback provider.
    if (
      requestedModelName
      && this.normalizeProviderName(providerName) !== this.normalizeProviderName(primaryProviderName)
    ) {
      modelName = this.getDefaultProviderModel(providerName);
    }

    if (!modelName) {
      modelName = this.getDefaultProviderModel(providerName);
    }

    if (!modelName) {
      return undefined;
    }

    return {
      modelName,
      ...(options?.providerNativeTools?.length ? { providerNativeTools: options.providerNativeTools } : {}),
      ...(options?.signal ? { signal: options.signal } : {}),
      ...(options?.reasoningEffort ? { reasoningEffort: options.reasoningEffort } : {}),
    };
  }

  private getDefaultProviderModel(providerName: string): string {
    const normalized = this.normalizeProviderName(providerName);
    switch (normalized) {
      case 'aigateway':
        return config.AIGatewayModel;
      case 'gemini':
        return config.geminiModel;
      case 'gemini-interactions':
        return config.geminiInteractionsModel || process.env.GEMINI_INTERACTIONS_MODEL || config.geminiModel;
      case 'deepseek':
        return config.deepseekModel;
      case 'openai':
        return config.openaiModel;
      case 'minimax':
        return config.minimaxModel;
      case 'openrouter':
        return config.openRouterModel;
      case 'opencode':
        return config.openCodeModel;
      case 'anthropic-direct':
        return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
      case 'anthropic-vertex':
        return process.env.ANTHROPIC_VERTEX_MODEL || 'claude-sonnet-4-6';
      case 'bedrock-claude':
        return process.env.BEDROCK_CLAUDE_MODEL || 'anthropic.claude-3-5-sonnet-latest-20250929-v1:0';
      case 'google-genai':
        return process.env.GOOGLE_GENAI_MODEL || config.geminiModel;
      case 'lmstudio':
        return process.env.LMSTUDIO_MODEL || 'local-model';
      case 'vllm':
        return process.env.VLLM_MODEL || 'local-model';
      case 'qwen':
      case 'puter':
        return config.qwenModel;
      default:
        return this.getProviderFactoryDefaultModel(normalized);
    }
  }

  private getProviderFactoryDefaultModel(providerName: string): string {
    try {
      return ProviderFactory.resolveRuntimeTarget(providerName).modelName || '';
    } catch (error: unknown) {logger.warn('[Llm Runtime] operation failed', error); return ''; }
  }

  /**
   * Phase 1: user-stack hops (primary + secondary model + user/option fallbacks).
   * Never injects product catalog providers.
   */
  private resolveUserStackHops(
    options?: LlmRunOptions,
    fallbackAllowed = true,
  ): UserStackProviderHop[] {
    let preferredProvider: string;
    try {
      preferredProvider = this.normalizeProviderName(
        options?.providerName || this.getPreferredProviderName(),
      );
    } catch {
      preferredProvider = this.normalizeProviderName(options?.providerName || '');
    }

    const hops = resolveUserStackProviderChain({
      requestedProviderName: preferredProvider || options?.providerName || null,
      requestedModelName: options?.modelName || null,
      optionFallbackOrder: fallbackAllowed ? (options?.fallbackOrder || null) : null,
      selection: resolveUserProviderSelection({
        requestedProviderId: preferredProvider || null,
      }),
      normalizeProviderName: (n) => this.normalizeProviderName(n),
    });

    if (!fallbackAllowed) {
      return hops.slice(0, 1);
    }

    // If user has no selection fallbacks, still try DEFAULT_FALLBACK_ORDER only when
    // explicitly configured (empty by product policy).
    if (hops.length <= 1 && DEFAULT_FALLBACK_ORDER.length > 0 && preferredProvider) {
      for (const entry of DEFAULT_FALLBACK_ORDER) {
        const name = this.normalizeProviderName(entry);
        if (name && name !== preferredProvider && !hops.some((h) => h.providerName === name)) {
          hops.push({
            providerName: name,
            modelName: null,
            source: 'options',
          });
        }
      }
    }

    if (hops.length === 0 && preferredProvider) {
      return [{
        providerName: preferredProvider,
        modelName: options?.modelName || null,
        source: 'request',
      }];
    }
    return hops;
  }

  private resolveModelAttemptsForProvider(
    hops: UserStackProviderHop[],
    providerName: string,
    primaryProviderName: string,
    requestModelName: string | null,
    secondaryModelId: string | null,
  ): Array<string | null> {
    const fromHops = modelsForProvider(
      hops,
      providerName,
      (n) => this.normalizeProviderName(n),
    );
    const models: Array<string | null> = [];
    const seen = new Set<string>();
    const push = (m: string | null | undefined) => {
      const key = m || '*';
      if (seen.has(key)) return;
      seen.add(key);
      models.push(m || null);
    };

    // Prefer request model when this is the primary provider hop
    if (
      this.normalizeProviderName(providerName) === this.normalizeProviderName(primaryProviderName)
      && requestModelName
    ) {
      push(requestModelName);
    }
    // An unpinned fallback hop must use that provider's resolved default model,
    // never inherit the primary provider's model and never drop to null.
    for (const m of fromHops) push(m || requestModelName);
    if (
      this.normalizeProviderName(providerName) === this.normalizeProviderName(primaryProviderName)
      && secondaryModelId
    ) {
      push(secondaryModelId);
    }
    if (models.length === 0) push(requestModelName);
    return models;
  }

  /** @deprecated Prefer resolveUserStackHops — kept for internal callers. */
  private resolveProviderChain(options?: LlmRunOptions): string[] {
    const fallbackAllowed = options?.allowFallback !== false;
    return uniqueProvidersFromHops(this.resolveUserStackHops(options, fallbackAllowed));
  }

  private normalizeProviderName(name: string): string {
    return ProviderFactory.normalizeProviderName(name);
  }

  private errorMessage(error: unknown): string {
    return redactSensitiveText(error instanceof Error ? error.message : String(error || 'erro desconhecido'));
  }

  private throwIfAborted(signal?: AbortSignal | null): void {
    if (!signal?.aborted) {
      return;
    }
    throw this.toAbortError(signal.reason);
  }

  private isAbortError(error: unknown, signal?: AbortSignal | null): boolean {
    if (signal?.aborted) {
      return true;
    }
    if (!error || typeof error !== 'object') {
      return false;
    }
    const record = error as { name?: unknown; code?: unknown; message?: unknown };
    return String(record.name || '') === 'AbortError'
      || String(record.code || '') === 'ABORT_ERR'
      || /\baborted\b|\baborterror\b/i.test(String(record.message || ''));
  }

  private toAbortError(error: unknown): Error {
    if (error instanceof Error && this.isAbortError(error)) {
      return error;
    }
    const abortError = new Error('LLM request aborted.');
    abortError.name = 'AbortError';
    if (error !== undefined) {
      (abortError as Error & { cause?: unknown }).cause = error;
    }
    return abortError;
  }

  private normalizeUrl(url: string): string {
    return String(url || '').trim().replace(/\/+$/, '').toLowerCase();
  }
}
