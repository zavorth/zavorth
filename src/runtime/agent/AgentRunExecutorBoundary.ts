import {
  AgentRunLlmRuntimeExecutor,
} from './AgentRunLlmRuntimeExecutor.js';
import { NaturalFirstLlmFallbackService } from './NaturalFirstLlmFallbackService.js';

import {
  AgentRunEchoHandsExecutor,
  type UniversalAgentToolRuntime,
} from './AgentRunEchoHandsExecutor.js';
import type {
  UniversalAgentExecutor,
  UniversalAgentExecutorResult,
  UniversalAgentRequest,
  UniversalAgentRun,
} from './UniversalAgentRuntimeTypes.js';

export type AgentRunExecutorBoundaryOptions = {
  executor?: UniversalAgentExecutor | null;
  toolRuntime?: UniversalAgentToolRuntime | null;
  llmRuntimeExecutor: AgentRunLlmRuntimeExecutor;
  echoHandsExecutor: AgentRunEchoHandsExecutor;
};

export type AgentRunExecutorBoundaryInput = {
  run: UniversalAgentRun;
  request: UniversalAgentRequest;
  executorOverride?: UniversalAgentExecutor | null;
  toolRuntimeOverride?: UniversalAgentToolRuntime | null;
};

export class AgentRunExecutorBoundary {
  private readonly executor: UniversalAgentExecutor | null;
  private readonly toolRuntime: UniversalAgentToolRuntime | null;
  private readonly llmRuntimeExecutor: AgentRunLlmRuntimeExecutor;
  private readonly echoHandsExecutor: AgentRunEchoHandsExecutor;
  private readonly llmFallback: NaturalFirstLlmFallbackService;

  constructor(options: AgentRunExecutorBoundaryOptions) {
    this.executor = options.executor || null;
    this.toolRuntime = options.toolRuntime || null;
    this.llmRuntimeExecutor = options.llmRuntimeExecutor;
    this.echoHandsExecutor = options.echoHandsExecutor;
    this.llmFallback = new NaturalFirstLlmFallbackService();
  }

  public async execute(input: AgentRunExecutorBoundaryInput): Promise<UniversalAgentExecutorResult> {
    const executor = input.executorOverride ?? this.executor;
    if (executor) {
      return this.withBoundaryReceipt(await executor({ request: input.request, run: input.run }), 'custom-executor');
    }

    const echoHandsResult = await this.echoHandsExecutor.executeIfRequested(
      input.run,
      input.request,
      input.toolRuntimeOverride ?? this.toolRuntime,
    );
    if (echoHandsResult) {
      return this.withBoundaryReceipt(echoHandsResult, 'tool-runtime');
    }

    const llmRuntimeResult = await this.llmRuntimeExecutor.executeIfAvailable(input.run, input.request);
    if (llmRuntimeResult) {
      return this.withBoundaryReceipt(llmRuntimeResult, 'llm-runtime');
    }

    if (this.llmFallback.shouldHandle(input.run)) {
      return this.withBoundaryReceipt(this.llmFallback.buildResult(input.run, input.request), 'missing');
    }

    return this.withBoundaryReceipt({
      status: 'completed',
      summary: 'Request received, but no model or task runner is connected yet.',
      replyText: `Received: "${input.run.input}". I need a configured model or a specific governed task before I can continue.`,
      events: [
        {
          kind: 'status',
          title: 'Model setup needed',
          detail: 'No model or task runner is connected for this request.',
          status: 'done',
          metadata: {
            executorResolution: 'missing-governed-executor',
          },
        },
      ],
      metadata: {
        executorResolution: {
          source: 'AgentRunExecutorBoundary',
          status: 'missing-governed-executor',
          requires: ['executor', 'llmRuntime'],
        },
      },
    }, 'missing');
  }

  private withBoundaryReceipt(
    result: UniversalAgentExecutorResult,
    selected: 'custom-executor' | 'tool-runtime' | 'llm-runtime' | 'missing',
  ): UniversalAgentExecutorResult {
    return {
      ...result,
      metadata: {
        ...(result.metadata || {}),
        executorBoundary: {
          source: 'AgentRunExecutorBoundary',
          stage: 8,
          phase: 8,
          selected,
        },
      },
    };
  }
}
