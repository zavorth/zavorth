export interface DrainConfig {
  timeoutMs: number;
  maxWaitMs: number;
  propagateToChannels: boolean;
}

export interface DrainState {
  isDraining: boolean;
  startedAt?: string;
  activeRequests: number;
  completedRequests: number;
  targetGateways: string[];
}

export interface DrainEvent {
  type: 'drain_started' | 'request_completed' | 'drain_complete' | 'drain_timeout';
  timestamp: string;
  data?: unknown;
}

const DEFAULT_CONFIG: DrainConfig = {
  timeoutMs: 30000,
  maxWaitMs: 60000,
  propagateToChannels: true,
};

export class DrainCoordinator {
  private config: DrainConfig = { ...DEFAULT_CONFIG };
  private state: DrainState = {
    isDraining: false,
    activeRequests: 0,
    completedRequests: 0,
    targetGateways: [],
  };
  private events: DrainEvent[] = [];
  private drainTimer: ReturnType<typeof setTimeout> | null = null;
  private drainResolvers: Array<() => void> = [];

  configure(config: Partial<DrainConfig>): void {
    this.config = { ...this.config, ...config };
  }

  startDrain(gatewayIds?: string[]): void {
    if (this.state.isDraining) return;

    this.state = {
      isDraining: true,
      startedAt: new Date().toISOString(),
      activeRequests: this.state.activeRequests,
      completedRequests: 0,
      targetGateways: gatewayIds ?? [],
    };

    this.events.push({
      type: 'drain_started',
      timestamp: this.state.startedAt || new Date().toISOString(),
      data: { targetGateways: this.state.targetGateways },
    });

    this.drainTimer = setTimeout(() => {
      this.emitTimeout();
    }, this.config.timeoutMs);
  }

  stopDrain(): void {
    if (!this.state.isDraining) return;

    this.clearDrainTimer();
    this.state.isDraining = false;
    this.resolveDrain();
  }

  isDraining(): boolean {
    return this.state.isDraining;
  }

  getState(): DrainState {
    return { ...this.state };
  }

  recordRequest(): void {
    this.state.activeRequests++;
  }

  completeRequest(): void {
    if (this.state.activeRequests > 0) {
      this.state.activeRequests--;
    }
    this.state.completedRequests++;

    this.events.push({
      type: 'request_completed',
      timestamp: new Date().toISOString(),
      data: {
        activeRequests: this.state.activeRequests,
        completedRequests: this.state.completedRequests,
      },
    });

    if (this.state.isDraining && this.state.activeRequests === 0) {
      this.completeDrain();
    }
  }

  getEvents(): DrainEvent[] {
    return [...this.events];
  }

  getStats(): { active: number; completed: number; isDraining: boolean } {
    return {
      active: this.state.activeRequests,
      completed: this.state.completedRequests,
      isDraining: this.state.isDraining,
    };
  }

  waitForDrain(): Promise<void> {
    if (!this.state.isDraining) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  private completeDrain(): void {
    this.clearDrainTimer();
    this.state.isDraining = false;

    this.events.push({
      type: 'drain_complete',
      timestamp: new Date().toISOString(),
      data: {
        completedRequests: this.state.completedRequests,
      },
    });

    this.resolveDrain();
  }

  private emitTimeout(): void {
    this.state.isDraining = false;

    this.events.push({
      type: 'drain_timeout',
      timestamp: new Date().toISOString(),
      data: {
        activeRequests: this.state.activeRequests,
        completedRequests: this.state.completedRequests,
      },
    });

    this.resolveDrain();
  }

  private resolveDrain(): void {
    const resolvers = this.drainResolvers;
    this.drainResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }

  private clearDrainTimer(): void {
    if (this.drainTimer !== null) {
      clearTimeout(this.drainTimer);
      this.drainTimer = null;
    }
  }
}
