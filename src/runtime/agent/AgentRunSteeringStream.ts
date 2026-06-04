import type { UniversalAgentSteeringEntry } from './UniversalAgentRuntimeTypes.js';

export type AgentRunSteeringStreamAction =
  | 'accepted'
  | 'applied'
  | 'cancelled'
  | 'superseded';

export type AgentRunSteeringStreamFrame = {
  sequence: number;
  runId: string;
  steeringId: string;
  ackId: string;
  action: AgentRunSteeringStreamAction;
  status: UniversalAgentSteeringEntry['status'];
  text: string;
  source: string;
  createdAt: string;
  entry: UniversalAgentSteeringEntry;
};

type Waiter = {
  afterSequence: number;
  resolve: (frames: AgentRunSteeringStreamFrame[]) => void;
  timer: ReturnType<typeof setTimeout>;
};

const MAX_FRAMES_PER_RUN = 200;

function cloneEntry(entry: UniversalAgentSteeringEntry): UniversalAgentSteeringEntry {
  return {
    ...entry,
    metadata: {
      ...(entry.metadata || {}),
    },
  };
}

export class AgentRunSteeringStream {
  private readonly framesByRun = new Map<string, AgentRunSteeringStreamFrame[]>();
  private readonly sequenceByRun = new Map<string, number>();
  private readonly waitersByRun = new Map<string, Waiter[]>();

  public publish(
    runId: string,
    entry: UniversalAgentSteeringEntry,
    action: AgentRunSteeringStreamAction,
  ): AgentRunSteeringStreamFrame {
    const sequence = (this.sequenceByRun.get(runId) || 0) + 1;
    this.sequenceByRun.set(runId, sequence);
    const frame: AgentRunSteeringStreamFrame = {
      sequence,
      runId,
      steeringId: entry.id,
      ackId: entry.ackId,
      action,
      status: entry.status,
      text: entry.text,
      source: entry.source,
      createdAt: entry.updatedAt || entry.createdAt,
      entry: cloneEntry(entry),
    };
    const frames = [...(this.framesByRun.get(runId) || []), frame].slice(-MAX_FRAMES_PER_RUN);
    this.framesByRun.set(runId, frames);
    this.resolveWaiters(runId);
    return frame;
  }

  public snapshot(runId: string): { sequence: number; frames: AgentRunSteeringStreamFrame[] } {
    return {
      sequence: this.sequenceByRun.get(runId) || 0,
      frames: [...(this.framesByRun.get(runId) || [])],
    };
  }

  public waitForNewerThan(
    runId: string,
    afterSequence: number,
    timeoutMs = 0,
  ): Promise<AgentRunSteeringStreamFrame[]> {
    const current = this.framesAfter(runId, afterSequence);
    if (current.length > 0 || timeoutMs <= 0) {
      return Promise.resolve(current);
    }
    return new Promise((resolve) => {
      const waiter: Waiter = {
        afterSequence,
        resolve,
        timer: setTimeout(() => {
          this.removeWaiter(runId, waiter);
          resolve(this.framesAfter(runId, afterSequence));
        }, timeoutMs),
      };
      this.waitersByRun.set(runId, [...(this.waitersByRun.get(runId) || []), waiter]);
    });
  }

  private framesAfter(runId: string, afterSequence: number): AgentRunSteeringStreamFrame[] {
    return (this.framesByRun.get(runId) || []).filter((frame) => frame.sequence > afterSequence);
  }

  private resolveWaiters(runId: string): void {
    const waiters = this.waitersByRun.get(runId) || [];
    if (waiters.length === 0) return;
    const remaining: Waiter[] = [];
    for (const waiter of waiters) {
      const frames = this.framesAfter(runId, waiter.afterSequence);
      if (frames.length > 0) {
        clearTimeout(waiter.timer);
        waiter.resolve(frames);
      } else {
        remaining.push(waiter);
      }
    }
    if (remaining.length > 0) {
      this.waitersByRun.set(runId, remaining);
    } else {
      this.waitersByRun.delete(runId);
    }
  }

  private removeWaiter(runId: string, waiter: Waiter): void {
    const waiters = this.waitersByRun.get(runId) || [];
    const remaining = waiters.filter((candidate) => candidate !== waiter);
    if (remaining.length > 0) {
      this.waitersByRun.set(runId, remaining);
    } else {
      this.waitersByRun.delete(runId);
    }
  }
}
