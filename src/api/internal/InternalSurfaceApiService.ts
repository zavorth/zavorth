import type { IMessageContext } from '../../contracts/IMessageBroker.js';
import {
  createBoundaryCorrelation,
  createBoundaryError,
  type ZavorthBoundaryError,
  type CommandRequest,
  type CommandResult,
} from '../../contracts/InternalBoundaryContract.js';
import type { SharedSurfaceCommandService } from '../../services/SharedSurfaceCommandService.js';
import type { ParsedCommand } from '../../channels/commands/ChannelCommandParser.js';export type InternalSurfaceApiDeps = {
  commandService: Pick<SharedSurfaceCommandService, 'maybeHandle'>;
};

export type InternalSurfaceCommandInput = {
  context: IMessageContext;
  parsedCommand?: ParsedCommand | null;
  request?: Partial<CommandRequest> | null;
};

export class InternalSurfaceApiService {
  private readonly commandService: Pick<SharedSurfaceCommandService, 'maybeHandle'>;

  constructor(deps: InternalSurfaceApiDeps) {
    this.commandService = deps.commandService;
  }

  public async maybeHandle(ctx: IMessageContext, parsedCommand?: ParsedCommand | null): Promise<boolean> {
    const result = await this.execute(
      {
        context: ctx,
        parsedCommand,
      },
      false,
    );
    return result.handled;
  }

  public async handleCommand(input: InternalSurfaceCommandInput): Promise<CommandResult> {
    return this.execute(input, true);
  }

  private async execute(input: InternalSurfaceCommandInput, swallowErrors: boolean): Promise<CommandResult> {
    const request = this.buildRequest(input.context, input.parsedCommand, input.request);
    const correlation = createBoundaryCorrelation({
      ...request.correlation,
      sessionId: request.correlation?.sessionId || request.threadId || input.context.threadId || null,
    });
    const replies: string[] = [];
    const wrappedContext: IMessageContext = {
      ...input.context,
      reply: async (text: string, options?: Record<string, unknown>) => {
        replies.push(String(text || ''));
        await input.context.reply(text, options);
      },
    };

    try {
      const handled = input.parsedCommand
        ? await this.commandService.maybeHandle(wrappedContext, input.parsedCommand)
        : await this.commandService.maybeHandle(wrappedContext);
      return {
        ok: true,
        handled,
        status: handled ? 'ok' : 'not_handled',
        summary: handled ? `Shared surface command handled on ${request.surface}.`
          : `No shared surface handler matched "${request.commandText}".`,
        messages: replies,
        correlation,
        error: null,
        metadata: {
          surface: request.surface,
          requestedBy: request.requestedBy,
          commandType: input.parsedCommand?.command_type || null,
          dryRun: Boolean(request.dryRun),
          approved: Boolean(request.approved),
        },
      };
    } catch (error: unknown) {if (!swallowErrors) {
        throw error;
      }
      const mappedError = this.mapError(error);
      return {
        ok: false,
        handled: false,
        status:
          mappedError.code === 'approval_required' || mappedError.code === 'policy_blocked'
            ? 'blocked'
            : 'error',
        summary: mappedError.message,
        messages: replies,
        correlation,
        error: mappedError,
        metadata: {
          surface: request.surface,
          requestedBy: request.requestedBy,
          commandType: input.parsedCommand?.command_type || null,
        },
      };
    }
  }

  private buildRequest(
    context: IMessageContext,
    parsedCommand?: ParsedCommand | null,
    override: Partial<CommandRequest> | null = null,
  ): CommandRequest {
    return {
      commandText: String(override?.commandText || context.rawText || '').trim(),
      surface: String(override?.surface || context.platform || 'unknown').trim() || 'unknown',
      requestedBy: String(override?.requestedBy || context.userId || 'anonymous').trim() || 'anonymous',
      chatId: override?.chatId ?? context.chatId ?? null,
      threadId: override?.threadId ?? context.threadId ?? null,
      profile: override?.profile ?? null,
      dryRun: Boolean(override?.dryRun),
      approved: Boolean(override?.approved),
      metadata: {
        ...(override?.metadata || {}),
        transport: context.transport || null,
        messageId: context.messageId || null,
        parsedCommandType: parsedCommand?.command_type || null,
        parsedCommandArgs: parsedCommand?.command_args || null,
      },
      correlation: override?.correlation || null,
    };
  }

  private mapError(error: unknown): ZavorthBoundaryError {
    const message =
      error instanceof Error
        ? String(error.message || 'Execution failed').trim()
        : String(error || 'Execution failed').trim();
    const folded = message.toLowerCase();
    const hasAny = (tokens: string[]) => tokens.some((token) => folded.includes(token));
    if (hasAny(['approval', 'approve', 'permission required'])) {
      return createBoundaryError('approval_required', message, [], false);
    }
    if (hasAny(['policy', 'forbidden', 'blocked', 'denied'])) {
      return createBoundaryError('policy_blocked', message, [], false);
    }
    if (hasAny(['unavailable', 'missing', 'not found', 'disabled', 'capability'])) {
      return createBoundaryError('capability_unavailable', message, [], true);
    }
    if (hasAny(['runtime', 'bootstrap', 'health', 'unhealthy', 'readiness'])) {
      return createBoundaryError('runtime_unhealthy', message, [], true);
    }
    if (hasAny(['invalid', 'malformed', 'required field', 'argument'])) {
      return createBoundaryError('validation_error', message, [], false);
    }
    return createBoundaryError('execution_failed', message, [], true);
  }
}
