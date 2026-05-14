import type {
  UniversalAgentExecutorResult,
  UniversalAgentRequest,
  UniversalAgentRun,
} from './UniversalAgentRuntimeTypes.js';

export type UniversalAgentToolRuntime = {
  executeTool(toolName: string, args: unknown): Promise<string>;
  hasTool?: (toolName: string) => boolean;
  isAvailable?: () => boolean;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasRequestedTool(input: Pick<UniversalAgentRequest, 'requestedTools'>, toolId: string): boolean {
  const normalized = normalizeText(toolId).toLowerCase();
  return Array.isArray(input.requestedTools)
    && input.requestedTools.some((tool) => normalizeText(tool).toLowerCase() === normalized);
}

export class AgentRunEchoHandsExecutor {
  public canExecute(
    request: UniversalAgentRequest,
    toolRuntime: UniversalAgentToolRuntime | null,
  ): boolean {
    if (!hasRequestedTool(request, 'echo_hands')) {
      return false;
    }
    return this.isRuntimeAvailable(toolRuntime);
  }

  public async executeIfRequested(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    toolRuntime: UniversalAgentToolRuntime | null,
  ): Promise<UniversalAgentExecutorResult | null> {
    const echoTool = run.toolExposure.tools.find((tool) => tool.id === 'echo_hands')
      || (hasRequestedTool(request, 'echo_hands') ? { id: 'echo_hands' } : null);
    if (!echoTool) {
      return null;
    }

    if (!this.isRuntimeAvailable(toolRuntime)) {
      return this.buildDegradedResult('Echo Hands indisponivel no tool runtime desta execucao.', {
        reason: 'echo-hands-unavailable',
        toolRuntimeAvailable: false,
      });
    }

    const args = this.resolveArgs(request, run);
    if (!args.action) {
      return this.buildDegradedResult('Echo Hands nao executado: argumentos de acao ausentes.', {
        reason: 'missing-echo-hands-action',
        toolRuntimeAvailable: true,
      });
    }

    try {
      const result = await toolRuntime!.executeTool('echo_hands', args);
      return {
        status: 'completed',
        summary: 'Echo Hands executado via tool runtime governado.',
        replyText: result,
        events: [
          {
            kind: 'tool',
            title: 'echo_hands',
            detail: result,
            status: 'done',
            metadata: {
              source: 'ToolRuntimeService',
              toolId: 'echo_hands',
              governedBy: 'ToolExposurePolicy',
            },
          },
        ],
        metadata: {
          echoHands: {
            source: 'AgentRunService',
            executed: true,
            toolRuntimeAvailable: true,
            governedBy: 'ToolExposurePolicy',
          },
        },
      };
    } catch (error: unknown) {
      const message = normalizeText(error instanceof Error ? error.message : String(error), 'Echo Hands falhou no tool runtime.');
      return this.buildDegradedResult(`Echo Hands nao executado: ${message}`, {
        reason: 'echo-hands-execution-failed',
        toolRuntimeAvailable: true,
        error: message,
      });
    }
  }

  private isRuntimeAvailable(toolRuntime: UniversalAgentToolRuntime | null): boolean {
    if (!toolRuntime) {
      return false;
    }
    if (toolRuntime.isAvailable && !toolRuntime.isAvailable()) {
      return false;
    }
    if (toolRuntime.hasTool && !toolRuntime.hasTool('echo_hands')) {
      return false;
    }
    return true;
  }

  private resolveArgs(
    request: UniversalAgentRequest,
    run: UniversalAgentRun,
  ): Record<string, unknown> {
    const metadata = request.metadata || {};
    const toolArgs = recordOrNull(metadata.toolArgs);
    const toolArguments = recordOrNull(metadata.toolArguments);
    const args = recordOrNull(metadata.echoHandsArgs)
      || recordOrNull(toolArgs?.echo_hands)
      || recordOrNull(toolArguments?.echo_hands)
      || {};

    return {
      ...args,
      trusted: true,
      requestId: normalizeText(args.requestId, request.requestId || run.requestId),
      metadata: {
        ...(recordOrNull(args.metadata) || {}),
        traceId: run.traceId,
        runId: run.id,
        sessionId: run.sessionId,
        governedBy: 'ToolExposurePolicy',
      },
    };
  }

  private buildDegradedResult(
    message: string,
    metadata: Record<string, unknown>,
  ): UniversalAgentExecutorResult {
    return {
      status: 'completed',
      summary: message,
      replyText: message,
      events: [
        {
          kind: 'tool',
          title: 'echo_hands',
          detail: message,
          status: 'failed',
          metadata: {
            source: 'AgentRunService',
            toolId: 'echo_hands',
            governedBy: 'ToolExposurePolicy',
            ...metadata,
          },
        },
      ],
      metadata: {
        echoHands: {
          source: 'AgentRunService',
          executed: false,
          governedBy: 'ToolExposurePolicy',
          ...metadata,
        },
      },
    };
  }
}
