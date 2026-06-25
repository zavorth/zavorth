import { logger } from '../logger.js';
import type {
  ZavorthBoundaryCorrelation,
} from '../contracts/InternalBoundaryContract.js';
import type { ZavorthEchoOrchestrator } from '../echo/orchestrator/ZavorthEchoOrchestrator.js';
import type { ToolCategory } from '../echo/types/IZavorthTool.js';
import type {
  EchoExecutionEntry,
  EchoToolCall,
} from '../echo/types/EchoTypes.js';
import type {
  ChatMessage,
  ToolDefinition,
} from '../providers/ILlmProvider.js';
import type { EchoExecutionBoundaryService } from '../domain/execution/infrastructure/EchoExecutionBoundaryService.js';
import type { EchoPendingExecutionStoreService } from '../domain/execution/infrastructure/EchoPendingExecutionStoreService.js';
import type { LlmRunOptions, LlmRuntimeService } from './llm/LlmRuntimeService.js';
import type {
  NormalizedEchoSurfaceOptions,
  ToolExecutionTrace,
} from './ZavorthEchoServiceTypes.js';
import type { ZavorthProactivePermissionService } from './ZavorthProactivePermissionService.js';
import { normalizeToolArgs } from './ZavorthEchoServiceSupport.js';
import {
  buildUntrustedContentFirewallInstruction,
  containsUntrustedContentMarker,
  withUntrustedInputMetadata,
} from '../security/UntrustedContent.js';
import { wrapToolOutputForLlm } from '../security/ToolOutputTrust.js';

export type EchoExecutionLoopResult = {
  response: string;
  status: EchoExecutionEntry['status'];
  toolCalls: EchoToolCall[];
  llmRaw: string | null;
  toolsExecuted: string[];
  permissionsRequested: string[];
  blockedTools: string[];
};

type EchoExecutionLoopRuntime = {
  orchestrator: Pick<
    ZavorthEchoOrchestrator,
    'getSchemasForCategory' | 'listAllTools' | 'getToolByName' | 'executePipeline'
  >;
  llmRuntime: Pick<LlmRuntimeService, 'chat'>;
  permissions: Pick<ZavorthProactivePermissionService, 'request'>;
  pendingExecutions: Pick<EchoPendingExecutionStoreService, 'put'>;
  executionBoundary: Pick<EchoExecutionBoundaryService, 'buildToolIntent' | 'decide' | 'execute'>;
  decorateToolCall: (toolCall: EchoToolCall) => EchoToolCall;
  buildLlmRunOptions: () => LlmRunOptions;
};

export type EchoExecutionLoopInput = {
  prompt: string;
  options: NormalizedEchoSurfaceOptions;
  correlation: ZavorthBoundaryCorrelation;
  startTime: number;
};

export class EchoExecutionLoop {
  private readonly orchestrator: EchoExecutionLoopRuntime['orchestrator'];
  private readonly llmRuntime: EchoExecutionLoopRuntime['llmRuntime'];
  private readonly permissions: EchoExecutionLoopRuntime['permissions'];
  private readonly pendingExecutions: EchoExecutionLoopRuntime['pendingExecutions'];
  private readonly executionBoundary: EchoExecutionLoopRuntime['executionBoundary'];
  private readonly decorateToolCall: EchoExecutionLoopRuntime['decorateToolCall'];
  private readonly buildLlmRunOptions: EchoExecutionLoopRuntime['buildLlmRunOptions'];

  constructor(runtime: EchoExecutionLoopRuntime) {
    this.orchestrator = runtime.orchestrator;
    this.llmRuntime = runtime.llmRuntime;
    this.permissions = runtime.permissions;
    this.pendingExecutions = runtime.pendingExecutions;
    this.executionBoundary = runtime.executionBoundary;
    this.decorateToolCall = runtime.decorateToolCall;
    this.buildLlmRunOptions = runtime.buildLlmRunOptions;
  }

  public async run(input: EchoExecutionLoopInput): Promise<EchoExecutionLoopResult> {
    const tools = this.listTools(input.options.category);
    const messages = this.buildInitialMessages(input.prompt);
    const llmResponse = await this.llmRuntime.chat(messages, tools, {
      ...this.buildLlmRunOptions(),
      telemetry: this.buildTelemetry(input),
    });

    if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
      return {
        response: llmResponse.content || 'O modelo respondeu mas nao usou nenhuma ferramenta.',
        status: 'success',
        toolCalls: [],
        llmRaw: llmResponse.content,
        toolsExecuted: [],
        permissionsRequested: [],
        blockedTools: [],
      };
    }

    const traces: ToolExecutionTrace[] = [];
    const resultLines: string[] = [];
    const toolsExecuted: string[] = [];
    const permissionsRequested: string[] = [];
    const blockedTools: string[] = [];

    for (const toolCall of llmResponse.toolCalls) {
      const tool = this.orchestrator.getToolByName(toolCall.name);
      const normalizedToolArgs = normalizeToolArgs(toolCall.arguments);
      const toolArgs = containsUntrustedContentMarker(messages)
        || containsUntrustedContentMarker(toolCall.arguments)
        ? withUntrustedInputMetadata(normalizedToolArgs, 'echo-contained-untrusted-evidence')
        : normalizedToolArgs;
      const intent = this.executionBoundary.buildToolIntent({
        prompt: input.prompt,
        toolName: toolCall.name,
        args: toolArgs,
        category: input.options.category || tool?.category,
        dangerLevel: tool?.dangerLevel || null,
        requiresPermission: tool?.requiresPermission === true,
        sessionId: input.options.sessionId || null,
        approved: false,
        requestedBy: input.options.requestedBy,
        surface: input.options.surface,
        correlation: input.correlation,
      });
      const decision = await this.executionBoundary.decide(intent);

      if (decision.decision === 'blocked') {
        const blockedMessage = decision.summary || `A ferramenta "${toolCall.name}" foi bloqueada pela politica ativa.`;
        blockedTools.push(toolCall.name);
        traces.push({
          toolCall: {
            toolName: toolCall.name,
            args: toolArgs,
            securityDecision: 'blocked',
            result: blockedMessage,
            durationMs: Date.now() - input.startTime,
            correlation: decision.correlation,
          },
        });
        resultLines.push(blockedMessage);
        continue;
      }

      if (tool?.requiresPermission || decision.decision === 'approval_required' || decision.approval.required) {
        const permission = await this.permissions.request({
          action: toolCall.name,
          resource: JSON.stringify(toolArgs),
          reason: decision.summary || `O LLM quer executar ${toolCall.name} em resposta a: "${input.prompt}"`,
          metadata: {
            kind: 'tool',
            prompt: input.prompt,
            toolName: toolCall.name,
            args: toolArgs,
            category: input.options.category || tool?.category || null,
            sessionId: input.options.sessionId || null,
            correlation: {
              ...decision.correlation,
              approvalId: decision.approval.approvalId || null,
            },
            runContext: decision.runContext,
            intent,
            intelligenceRiskGate: decision.metadata.intelligenceRiskGate || null,
          },
        });
        const pendingIntent = {
          ...intent,
          correlation: {
            ...decision.correlation,
            approvalId: permission.id,
            sessionId: input.options.sessionId || decision.correlation.sessionId || null,
          },
        };
        this.pendingExecutions.put({
          permissionId: permission.id,
          kind: 'tool',
          prompt: input.prompt,
          toolName: toolCall.name,
          args: toolArgs,
          category: input.options.category || tool?.category,
          sessionId: input.options.sessionId || null,
          requestedAt: permission.requestedAt,
          correlation: pendingIntent.correlation || null,
          intent: pendingIntent,
          metadata: {
            requestedBy: input.options.requestedBy,
            surface: input.options.surface,
          },
        });
        permissionsRequested.push(permission.id);

        const pendingMessage =
          `Acao "${toolCall.name}" requer permissao. `
          + `ID: ${permission.id}. Aprove no painel para executar.`;
        traces.push({
          toolCall: {
            toolName: toolCall.name,
            args: toolArgs,
            securityDecision: 'permission_required',
            result: pendingMessage,
            durationMs: Date.now() - input.startTime,
            correlation: pendingIntent.correlation || null,
          },
        });
        resultLines.push(pendingMessage);
        continue;
      }

      const outcome = await this.executionBoundary.execute({
        ...intent,
        approved: true,
        correlation: decision.correlation,
      });
      const toolStart = Date.now();
      const executionResult = await this.orchestrator.executePipeline(
        input.prompt,
        toolCall.name,
        toolArgs,
        {
          sessionId: input.options.sessionId,
          traceId: outcome.correlation.traceId,
          runId: outcome.correlation.runId,
          approvalId: outcome.correlation.approvalId,
          artifactId: outcome.correlation.artifactId,
        },
      );
      toolsExecuted.push(toolCall.name);
      resultLines.push(executionResult.response);
      traces.push({
        toolCall: this.decorateToolCall({
          toolName: toolCall.name,
          args: toolArgs,
          securityDecision: 'approved',
          result: executionResult.response,
          durationMs: Date.now() - toolStart,
          data: executionResult.data,
          correlation: outcome.correlation,
        }),
        inlineData: this.buildInlineData(executionResult.data),
      });
    }

    let finalResponse = resultLines.join('\n');
    if (toolsExecuted.length > 0 && permissionsRequested.length === 0) {
      messages.push({
        role: 'assistant',
        content: llmResponse.content,
        toolCalls: llmResponse.toolCalls,
      });
      messages.push(...traces.map((trace, index) => {
        const toolResultMessage: ChatMessage = {
          role: 'tool',
          toolCallId: llmResponse.toolCalls[index]?.id,
          toolName: trace.toolCall.toolName,
          content: wrapToolOutputForLlm(trace.toolCall.toolName, trace.toolCall.result, {
            source: 'echo_tool_result',
            tool_call_id: llmResponse.toolCalls[index]?.id,
          }),
        };
        if (trace.inlineData) {
          toolResultMessage.inlineData = trace.inlineData;
        }
        return toolResultMessage;
      }));

      try {
        const finalLlmResponse = await this.llmRuntime.chat(messages, tools, {
          ...this.buildLlmRunOptions(),
          telemetry: this.buildTelemetry(input),
        });
        finalResponse = finalLlmResponse.content || finalResponse;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('[Echo] ReAct loop failed, falling back to tool output', message);
      }
    }

    return {
      response: finalResponse,
      status: blockedTools.length > 0 ? 'blocked' : permissionsRequested.length > 0 ? 'permission_pending' : 'success',
      toolCalls: traces.map((trace) => trace.toolCall),
      llmRaw: llmResponse.content,
      toolsExecuted,
      permissionsRequested,
      blockedTools,
    };
  }

  private listTools(category?: ToolCategory): ToolDefinition[] {
    return category
      ? this.orchestrator.getSchemasForCategory(category)
      : this.orchestrator.listAllTools();
  }

  private buildInitialMessages(prompt: string): ChatMessage[] {
    return [
      {
        role: 'system',
        content: [
          'Voce e o Zavorth Echo, um assistente inteligente de automacao. Analise o pedido do usuario e use ferramentas quando uma acao local for necessaria.',
          buildUntrustedContentFirewallInstruction(),
        ].join(' '),
      },
      { role: 'user', content: prompt },
    ];
  }

  private buildTelemetry(input: EchoExecutionLoopInput): LlmRunOptions['telemetry'] {
    return {
      surface: input.options.surface || 'echo',
      sessionId: input.options.sessionId || null,
      runId: input.correlation.runId || null,
      traceId: input.correlation.traceId || null,
    };
  }

  private buildInlineData(data: unknown): ChatMessage['inlineData'] | undefined {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return undefined;
    }
    const record = data as Record<string, unknown>;
    const base64 = typeof record.base64 === 'string' ? record.base64 : '';
    const mimeType = typeof record.mimeType === 'string' ? record.mimeType : '';
    if (!base64 || !mimeType) {
      return undefined;
    }
    return [{ mimeType, data: base64 }];
  }
}
