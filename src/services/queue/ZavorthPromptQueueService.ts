export type PromptPriority = 'CRITICAL_INTERRUPT' | 'STEER_GUIDANCE' | 'ENQUEUED_PROMPT' | 'LOW_PRIORITY';

export interface QueuedPromptItem {
  readonly id: string;
  readonly content: string;
  readonly priority: PromptPriority;
  readonly timestamp: number;
  readonly senderId: string;
  readonly metadata?: Record<string, string>;
}

export interface CombinedPromptContext {
  readonly primaryPrompt: string;
  readonly steeringDirectives: readonly string[];
  readonly hasCriticalInterrupt: boolean;
  readonly totalQueuedItemsProcessed: number;
}

export class ZavorthPromptQueueService {
  private queue: QueuedPromptItem[] = [];
  private itemCounter = 0;

  private readonly priorityWeight: Record<PromptPriority, number> = {
    CRITICAL_INTERRUPT: 1,
    STEER_GUIDANCE: 2,
    ENQUEUED_PROMPT: 3,
    LOW_PRIORITY: 4,
  };

  public enqueuePrompt(params: {
    content: string;
    priority?: PromptPriority;
    senderId?: string;
    metadata?: Record<string, string>;
  }): QueuedPromptItem {
    const item: QueuedPromptItem = {
      id: `prompt-${Date.now()}-${this.itemCounter++}`,
      content: params.content.trim(),
      priority: params.priority || 'ENQUEUED_PROMPT',
      timestamp: Date.now(),
      senderId: params.senderId || 'operator',
      metadata: params.metadata,
    };

    this.queue.push(item);
    this.sortQueue();
    return item;
  }

  public dequeueNext(): QueuedPromptItem | null {
    if (this.queue.length === 0) {
      return null;
    }
    return this.queue.shift() ?? null;
  }

  public peekNext(): QueuedPromptItem | null {
    return this.queue[0] ?? null;
  }

  public combineQueuedSteering(): CombinedPromptContext {
    if (this.queue.length === 0) {
      return {
        primaryPrompt: '',
        steeringDirectives: [],
        hasCriticalInterrupt: false,
        totalQueuedItemsProcessed: 0,
      };
    }

    const steering: string[] = [];
    let hasCritical = false;
    const processedCount = this.queue.length;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      if (item.priority === 'CRITICAL_INTERRUPT') {
        hasCritical = true;
        steering.push(`[URGENT OPERATOR INTERRUPT]: ${item.content}`);
      } else if (item.priority === 'STEER_GUIDANCE') {
        steering.push(`[OPERATOR STEERING]: ${item.content}`);
      } else {
        steering.push(item.content);
      }
    }

    const primaryPrompt = steering.join('\n\n');

    return {
      primaryPrompt,
      steeringDirectives: steering,
      hasCriticalInterrupt: hasCritical,
      totalQueuedItemsProcessed: processedCount,
    };
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue.length = 0;
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      const weightDiff = this.priorityWeight[a.priority] - this.priorityWeight[b.priority];
      if (weightDiff !== 0) return weightDiff;
      return a.timestamp - b.timestamp;
    });
  }
}
