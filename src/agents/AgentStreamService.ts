import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export type StreamEvent = {
  type: 'start' | 'chunk' | 'end' | 'error';
  agentId: string;
  stepId: string | null;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type StreamOptions = {
  agentId: string;
  stepId?: string;
  prompt: string;
  timeoutMs?: number;
  onChunk?: (chunk: string) => void;
  onEnd?: (fullOutput: string) => void;
  onError?: (error: Error) => void;
};

export type AgentStreamAdapter = {
  stream(agentId: string, prompt: string, options?: { timeoutMs?: number }): AsyncGenerator<string>;
};

export class AgentStreamService extends EventEmitter {
  private readonly adapter: AgentStreamAdapter | null;
  private readonly log: typeof logger;
  private activeStreams: Map<string, AbortController> = new Map();

  constructor(runtime: { adapter?: AgentStreamAdapter; logger?: typeof logger } = {}) {
    super();
    this.adapter = runtime.adapter || null;
    this.log = runtime.logger || logger;
  }

  public async *streamAgent(options: StreamOptions): AsyncGenerator<StreamEvent> {
    const streamId = `${options.agentId}-${options.stepId || 'default'}-${Date.now()}`;
    const controller = new AbortController();
    this.activeStreams.set(streamId, controller);

    yield {
      type: 'start',
      agentId: options.agentId,
      stepId: options.stepId || null,
      content: '',
      timestamp: new Date().toISOString(),
    };

    try {
      if (!this.adapter) {
        throw new Error('No stream adapter configured');
      }

      let fullOutput = '';
      const generator = this.adapter.stream(options.agentId, options.prompt, {
        timeoutMs: options.timeoutMs,
      });

      for await (const chunk of generator) {
        if (controller.signal.aborted) break;

        fullOutput += chunk;
        const event: StreamEvent = {
          type: 'chunk',
          agentId: options.agentId,
          stepId: options.stepId || null,
          content: chunk,
          timestamp: new Date().toISOString(),
        };

        yield event;
        this.emit('chunk', event);
        options.onChunk?.(chunk);
      }

      const endEvent: StreamEvent = {
        type: 'end',
        agentId: options.agentId,
        stepId: options.stepId || null,
        content: fullOutput,
        timestamp: new Date().toISOString(),
      };

      yield endEvent;
      this.emit('end', endEvent);
      options.onEnd?.(fullOutput);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMsg = error instanceof Error ? err.message : String(error);
      const errorEvent: StreamEvent = {
        type: 'error',
        agentId: options.agentId,
        stepId: options.stepId || null,
        content: errorMsg,
        timestamp: new Date().toISOString(),
      };

      yield errorEvent;
      this.emit('error', errorEvent);
      options.onError?.(error instanceof Error ? error : new Error(errorMsg));
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  public abortStream(streamId: string): void {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(streamId);
    }
  }

  public abortAll(): void {
    for (const [id, controller] of this.activeStreams) {
      controller.abort();
    }
    this.activeStreams.clear();
  }

  public getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  public formatStreamEvent(event: StreamEvent): string {
    switch (event.type) {
      case 'start':
        return `[START] ${event.agentId}${event.stepId ? `/${event.stepId}` : ''}`;
      case 'chunk':
        return event.content;
      case 'end':
        return `\n[DONE] ${event.agentId}${event.stepId ? `/${event.stepId}` : ''} (${event.content.length} chars)`;
      case 'error':
        return `\n[ERROR] ${event.agentId}${event.stepId ? `/${event.stepId}` : ''}: ${event.content}`;
      default:
        return '';
    }
  }
}
