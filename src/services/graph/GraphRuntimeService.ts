import { resolveGraphExecutionProfile } from './GraphRuntimeProfileResolver.js';
import { buildWorkspaceStrategyMessage } from './GraphRuntimeWorkspaceStrategy.js';

import { v4 as uuidv4 } from 'uuid';

import { config } from '../../config/index.js';
import {
  buildSupervisorGraph,
  type SupervisorGraphResult,
} from '../../orchestrator/graph/SupervisorGraph.js';
import type { ChatMessage } from '../../providers/ILlmProvider.js';
import { ExecutionIntentClassifierService } from '../ExecutionIntentClassifierService.js';
import type { LlmRunOptions, LlmRuntimeService } from '../llm/LlmRuntimeService.js';
import { ProviderStrategyService } from '../ProviderStrategyService.js';
import { SkillRoutingService } from '../SkillRoutingService.js';
import { CostBudgetService } from '../telemetry/CostBudgetService.js';
import { TelemetryRuntimeService } from '../telemetry/TelemetryRuntimeService.js';
import { TokenBudgetService } from '../telemetry/TokenBudgetService.js';
import {
  buildCriticDirectives,
  buildDecisionTrace,
  buildGeneratorDirectives,
  selectToolDefinitionsForProfile,
} from './GraphRuntimeDirectives.js';

import type {
  GraphExecutionProfile,
  GraphRuntimeResult,
  GraphRuntimeServiceOptions,
  GraphRuntimeTaskContext,
  ToolRuntimeLike,
} from './GraphRuntimeTypes.js';

import { logger } from '../../logger.js';
import { asErrorLike } from '../../utils/errorLike.js';

export type {
  GraphExecutionProfile,
  GraphRuntimeDecisionTrace,
  GraphRuntimeResult,
  GraphRuntimeServiceOptions,
  GraphRuntimeTaskContext,
  ToolRuntimeLike,
} from './GraphRuntimeTypes.js';

export class GraphRuntimeService {
  private readonly llmRuntime: LlmRuntimeService;
  private readonly toolRuntime?: ToolRuntimeLike;
  private readonly maxIterations: number;
  private readonly maxToolRounds: number;
  private readonly providerNameOverride?: string;
  private readonly telemetryRuntime: TelemetryRuntimeService;
  private readonly tokenBudgetService: TokenBudgetService;
  private readonly costBudgetService: CostBudgetService;
  private readonly executionIntentClassifier: Pick<ExecutionIntentClassifierService, 'classify'>;
  private readonly providerStrategyService: Pick<ProviderStrategyService, 'resolve'>;
  private readonly skillRoutingService: Pick<SkillRoutingService, 'recommend'>;

  constructor(options: GraphRuntimeServiceOptions) {
    this.llmRuntime = options.llmRuntime;
    this.toolRuntime = options.toolRuntime;
    this.maxIterations = Math.max(1, options.maxIterations ?? config.maxIterations);
    this.maxToolRounds = Math.max(0, options.maxToolRounds ?? config.graphMaxToolRounds);
    this.providerNameOverride = options.providerName ? String(options.providerName).trim() : undefined;
    this.telemetryRuntime = options.telemetryRuntime || new TelemetryRuntimeService();
    this.tokenBudgetService = options.tokenBudgetService || new TokenBudgetService();
    this.costBudgetService = options.costBudgetService || new CostBudgetService();
    this.executionIntentClassifier = options.executionIntentClassifierService || new ExecutionIntentClassifierService();
    this.providerStrategyService = options.providerStrategyService || new ProviderStrategyService();
    this.skillRoutingService = options.skillRoutingService || new SkillRoutingService();
  }

  public async runAutonomousTask(
    taskGoal: string,
    taskContext: GraphRuntimeTaskContext = {},
  ): Promise<GraphRuntimeResult> {
    const traceId = uuidv4();
    const providerName = this.getPreferredProviderName();
    const executionProfile = resolveGraphExecutionProfile({
      taskGoal,
      metadata: taskContext.metadata,
      maxIterations: this.maxIterations,
      maxToolRounds: this.maxToolRounds,
      providerName,
      executionIntentClassifier: this.executionIntentClassifier,
      providerStrategyService: this.providerStrategyService,
      skillRoutingService: this.skillRoutingService,
      isProviderUsable: (name) => this.isProviderUsable(name),
    });
    const initialMessages = this.buildInitialMessages(taskGoal, taskContext, executionProfile);
    const app = buildSupervisorGraph({
      llmRuntime: this.buildExecutionAwareLlmRuntime(executionProfile),
      toolRuntime: this.buildTraceAwareToolRuntime(traceId, executionProfile),
      providerName: executionProfile.providerName,
      maxIterations: executionProfile.maxIterations,
      maxToolRounds: executionProfile.maxToolRounds,
      generatorDirectives: buildGeneratorDirectives(executionProfile),
      criticDirectives: buildCriticDirectives(executionProfile),
    });

    await this.telemetryRuntime.record({
      traceId,
      source: 'graph-runtime',
      eventType: 'graph.started',
      status: 'running',
      payload: {
        providerName: executionProfile.providerName,
        modelName: executionProfile.modelName,
        deliveryProfile: executionProfile.deliveryProfile,
        verificationProfile: executionProfile.verificationProfile,
        maxIterations: executionProfile.maxIterations,
        maxToolRounds: executionProfile.maxToolRounds,
        taskGoal,
        decisionTrace: buildDecisionTrace(executionProfile),
        executionProfile,
        metadata: taskContext.metadata || {},
        initialMessageCount: initialMessages.length,
      },
    });

    try {
      const result = await app.invoke({
        task_goal: taskGoal,
        initial_messages: initialMessages.length > 0 ? initialMessages : undefined,
      });
      const runtimeResult = this.toRuntimeResult(result, traceId, executionProfile);

      await this.telemetryRuntime.record({
        traceId,
        source: 'graph-runtime',
        eventType: `graph.${runtimeResult.status}`,
        status: runtimeResult.status,
        payload: {
          providerName: executionProfile.providerName,
          modelName: executionProfile.modelName,
          deliveryProfile: executionProfile.deliveryProfile,
          verificationProfile: executionProfile.verificationProfile,
          iterations: runtimeResult.iterations,
          tokenBudget: runtimeResult.tokenBudget,
          costBudget: runtimeResult.costBudget,
          decisionTrace: runtimeResult.decisionTrace,
          approved: runtimeResult.approved,
          error: runtimeResult.error,
        },
      });

      return runtimeResult;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      await this.telemetryRuntime.record({
        traceId,
        source: 'graph-runtime',
        eventType: 'graph.failed',
        status: 'failed',
        payload: {
          providerName: executionProfile.providerName,
          modelName: executionProfile.modelName,
          deliveryProfile: executionProfile.deliveryProfile,
          verificationProfile: executionProfile.verificationProfile,
          decisionTrace: buildDecisionTrace(executionProfile),
          error: errorMessage,
        },
      });
      throw error;
    }
  }

  private buildTraceAwareToolRuntime(
    traceId: string,
    executionProfile: GraphExecutionProfile,
  ): ToolRuntimeLike | undefined {
    if (!this.toolRuntime) {
      return undefined;
    }

    const advertisedToolDefinitions = selectToolDefinitionsForProfile(
      this.toolRuntime.getToolDefinitions(),
      executionProfile,
    );

    return {
      getToolDefinitions: () => advertisedToolDefinitions,
      executeTool: async (toolName: string, args: unknown): Promise<string> => {
        const normalizedToolName = String(toolName || '').trim();
        const allowedToolNames = new Set(advertisedToolDefinitions.map((tool) => tool.name));

        if (!allowedToolNames.has(normalizedToolName)) {
          return `Ferramenta "${normalizedToolName}" indisponivel para este perfil de tarefa. Prefira uma das tools anunciadas nesta execucao.`;
        }

        if (!args || typeof args !== 'object' || Array.isArray(args)) {
          return this.toolRuntime!.executeTool(normalizedToolName, args);
        }

        const nextArgs = {
          ...(args as Record<string, unknown>),
          metadata: {
            ...(((args as Record<string, unknown>).metadata as Record<string, unknown> | undefined) || {}),
            traceId,
          },
        };

        return this.toolRuntime!.executeTool(normalizedToolName, nextArgs);
      },
    };
  }

  private buildExecutionAwareLlmRuntime(executionProfile: GraphExecutionProfile): LlmRuntimeService {
    const baseRuntime = this.llmRuntime;
    return {
      ...(baseRuntime as unknown as Record<string, unknown>),
      chat: async (messages: ChatMessage[], tools?: never, options?: LlmRunOptions) => {
        return baseRuntime.chat(messages, undefined, {
          providerName: options?.providerName || executionProfile.providerName,
          modelName: options?.modelName || executionProfile.modelName,
          allowFallback:
            typeof options?.allowFallback === 'boolean'
              ? options.allowFallback
              : executionProfile.allowFallback,
          fallbackOrder: Array.isArray(options?.fallbackOrder)
            ? options.fallbackOrder
            : executionProfile.fallbackOrder,
        });
      },
    } as LlmRuntimeService;
  }

  private buildInitialMessages(
    taskGoal: string,
    taskContext: GraphRuntimeTaskContext,
    executionProfile: GraphExecutionProfile,
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const strategyMessage = buildWorkspaceStrategyMessage(taskGoal, taskContext.metadata, executionProfile);
    if (strategyMessage) {
      messages.push(strategyMessage);
    }
    if (Array.isArray(taskContext.initialMessages)) {
      messages.push(...taskContext.initialMessages);
    }
    return messages;
  }

  private isProviderUsable(name: string): boolean {
    const runtime = this.llmRuntime as unknown as { isProviderAvailable?: (name: string) => boolean };
    if (typeof runtime.isProviderAvailable === 'function') {
      try {
        return runtime.isProviderAvailable(name);
      } catch (error: unknown) {logger.warn('[Graph Runtime] operation failed', error); return true; }
    }

    return true;
  }

  private getPreferredProviderName(): string {
    return String(
      this.providerNameOverride || this.llmRuntime.getPreferredProviderName(),
    ).trim();
  }

  private toRuntimeResult(
    result: SupervisorGraphResult,
    traceId: string,
    executionProfile?: Pick<
      GraphExecutionProfile,
      'providerName' | 'modelName' | 'intentDecision' | 'providerDecision' | 'skillDecision'
    >,
  ): GraphRuntimeResult {
    const finalReply =
      [...result.messages]
        .reverse()
        .find((message) => message.role === 'assistant' && String(message.content || '').trim().length > 0)
        ?.content?.trim() || '';
    const transcript = result.messages.map((message) => String(message.content || '')).join('\n');
    const tokenBudget = this.tokenBudgetService.evaluateText(transcript);
    const costBudget = this.costBudgetService.evaluateTokens(tokenBudget.used);

    return {
      ok: result.status === 'approved',
      approved: result.is_approved,
      status: result.status,
      finalReply,
      iterations: result.iterations,
      criticFeedback: result.critic_feedback,
      error: result.error,
      messages: result.messages,
      traceId,
      providerName: executionProfile?.providerName || this.getPreferredProviderName(),
      modelName: executionProfile?.modelName,
      tokenBudget,
      costBudget,
      decisionTrace: executionProfile
        ? buildDecisionTrace(executionProfile as GraphExecutionProfile)
        : {
            executionRoute: 'graph.general',
            taskKind: 'unknown',
            taskSubtype: 'unknown',
            responseStyle: 'direct',
            provider: {
              providerName: this.getPreferredProviderName(),
              modelName: undefined,
              profileId: null,
              profileLabel: null,
              selectionSource: 'configured',
              fallbackOrder: [],
            },
            skills: {
              primarySkillName: null,
              supportingSkillNames: [],
              matchedBundleTags: [],
            },
            rationale: [],
          },
    };
  }
}
