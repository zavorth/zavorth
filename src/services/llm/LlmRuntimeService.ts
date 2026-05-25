import fs from 'fs';
import { config } from '../../config/index.js';
import { ProviderFactory } from '../../providers/ProviderFactory.js';
import type {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  ProviderChatOptions,
  ToolDefinition,
} from '../../providers/ILlmProvider.js';
import { createClaudeAgentSdkRuntimeFromEnv } from '../../adapters/claude/ClaudeAgentSdkRuntimeAdapter.js';
import { defaultLlmRuntimeTelemetryService } from './LlmRuntimeTelemetryService.js';
import type { LlmRuntimeTelemetryAttemptStatus } from './LlmRuntimeTelemetryService.js';
import {
  buildLlmEgressGuardMetadata,
  sanitizeLlmEgressPayload,
} from '../../security/LlmEgressGuard.js';
import { redactSensitiveText } from '../../security/SensitiveDataGuard.js';

export type LlmRunOptions = {
  providerName?: string;
  modelName?: string;
  allowFallback?: boolean;
  fallbackOrder?: string[];
  toolPolicy?: LlmRuntimeToolPolicyContext;
  telemetry?: {
    runId?: string | null;
    traceId?: string | null;
    sessionId?: string | null;
    surface?: string | null;
  };
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

const DEFAULT_FALLBACK_ORDER = [
  'aigateway',
  'gemini',
  'deepseek',
  'minimax',
  'qwen',
  'openrouter',
  'openai',
  'opencode',
];

export class LlmRuntimeService {
  constructor(private readonly preferredProviderName?: string) {}

  public getPreferredProviderName(): string {
    return this.normalizeProviderName(this.preferredProviderName || config.llmProvider || 'gemini');
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
    const guardedPayload = sanitizeLlmEgressPayload(messages, tools);
    const safeMessages = guardedPayload.messages;
    const safeTools = guardedPayload.tools;
    const egressGuardMetadata = buildLlmEgressGuardMetadata(guardedPayload.report);
    const providerChain = this.resolveProviderChain(options);
    const primaryProviderName = providerChain[0] || this.getPreferredProviderName();
    const requestedProviderName = this.normalizeProviderName(options?.providerName || this.getPreferredProviderName());
    const fallbackAllowed = options?.allowFallback === true;
    const attempts: LlmRuntimeProviderAttempt[] = [];
    let lastError: unknown = null;

    for (const providerName of providerChain) {
      const providerOptions = this.resolveProviderChatOptions(providerName, primaryProviderName, options);
      const modelName = providerOptions?.modelName || null;
      const attemptStartedAt = Date.now();
      if (!this.isProviderAvailable(providerName)) {
        this.recordAttempt(attempts, {
          providerName,
          modelName,
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

      try {
        if (this.isClaudeAgentSdkProvider(providerName)) {
          const adapter = createClaudeAgentSdkRuntimeFromEnv();
          const result = await adapter.chatDetailed(safeMessages, safeTools, {
            providerName,
            ...(modelName ? { modelName } : {}),
            allowFallback: false,
            ...(options?.toolPolicy ? { toolPolicy: options.toolPolicy } : {}),
          });
          this.recordAttempt(attempts, {
            providerName,
            modelName,
            status: 'succeeded',
            fallback: providerName !== primaryProviderName,
            durationMs: Date.now() - attemptStartedAt,
          }, {
            options,
            requestedProviderName,
            primaryProviderName,
            fallbackAllowed,
          });
          return {
            ...result,
            metadata: this.mergeMetadata(result.metadata, egressGuardMetadata),
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
        }

        const provider = this.createProvider(providerName);
        const response = await provider.chat(
          safeMessages,
          safeTools,
          providerOptions,
        );
        this.recordAttempt(attempts, {
          providerName,
          modelName,
          status: 'succeeded',
          fallback: providerName !== primaryProviderName,
          durationMs: Date.now() - attemptStartedAt,
        }, {
          options,
          requestedProviderName,
          primaryProviderName,
          fallbackAllowed,
        });
        return {
          providerName,
          modelName,
          response,
          metadata: this.mergeMetadata((response as unknown as { metadata?: Record<string, unknown> }).metadata, egressGuardMetadata),
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
      } catch (error) {
        lastError = error;
        this.recordAttempt(attempts, {
          providerName,
          modelName,
          status: 'failed',
          fallback: providerName !== primaryProviderName,
          durationMs: Date.now() - attemptStartedAt,
          error: this.errorMessage(error),
        }, {
          options,
          requestedProviderName,
          primaryProviderName,
          fallbackAllowed,
        });
        if (!options?.allowFallback) {
          throw error;
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('Nenhum provedor LLM disponivel para esta execucao.');
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
      fallbackUsed: input.providerName !== input.primaryProviderName,
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
    switch (this.normalizeProviderName(name)) {
      case 'aigateway':
        return this.isAIGatewayAvailable();
      case 'gemini':
        return Boolean(config.geminiApiKey || config.geminiApiKeys.length > 0);
      case 'gemini-interactions':
        return Boolean(
          ((config as any).geminiInteractionsEnabled || process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED === 'true')
          && ((config as any).geminiInteractionsApiKey || config.geminiApiKey || process.env.GEMINI_API_KEY)
        );
      case 'deepseek':
        return Boolean(config.deepseekApiKey);
      case 'openai':
        return Boolean(config.openaiApiKey || (config as any).openaiApiKeys?.length > 0);
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
        return false;
    }
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
    } catch {
      return null;
    }
  }

  private createProvider(name: string): ILlmProvider {
    return ProviderFactory.create(name);
  }

  private mergeMetadata(
    existing?: Record<string, unknown>,
    security?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!existing && !security) {
      return undefined;
    }
    return {
      ...(existing || {}),
      ...(security || {}),
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
    };
  }

  private getDefaultProviderModel(providerName: string): string {
    switch (this.normalizeProviderName(providerName)) {
      case 'aigateway':
        return config.AIGatewayModel;
      case 'gemini':
        return config.geminiModel;
      case 'gemini-interactions':
        return (config as any).geminiInteractionsModel || process.env.GEMINI_INTERACTIONS_MODEL || config.geminiModel;
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
        return process.env.BEDROCK_CLAUDE_MODEL || 'anthropic.claude-sonnet-4-5-20250929-v1:0';
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
        return '';
    }
  }

  private resolveProviderChain(options?: LlmRunOptions): string[] {
    const preferredProvider = this.normalizeProviderName(
      options?.providerName || this.getPreferredProviderName(),
    );

    if (!options?.allowFallback) {
      return [preferredProvider];
    }

    const customFallbacks = (options?.fallbackOrder || []).map((entry) =>
      this.normalizeProviderName(entry),
    );

    return Array.from(
      new Set([
        preferredProvider,
        ...customFallbacks,
        ...DEFAULT_FALLBACK_ORDER.filter((entry) => entry !== preferredProvider).map((entry) =>
          this.normalizeProviderName(entry),
        ),
      ]),
    );
  }

  private normalizeProviderName(name: string): string {
    return ProviderFactory.normalizeProviderName(name);
  }

  private errorMessage(error: unknown): string {
    return redactSensitiveText(error instanceof Error ? error.message : String(error || 'erro desconhecido'));
  }

  private normalizeUrl(url: string): string {
    return String(url || '').trim().replace(/\/+$/, '').toLowerCase();
  }
}
