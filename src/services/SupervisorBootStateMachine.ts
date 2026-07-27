export type SupervisorBootPhase =
  | 'idle'
  | 'prepare'
  | 'launch'
  | 'probe'
  | 'recover'
  | 'ready'
  | 'timed_out'
  | 'failed';

export type SupervisorBootStateSnapshot = {
  phase: SupervisorBootPhase;
  attempts: number;
  startedAt: number;
  updatedAt: number;
  timedOut: boolean;
  summary: string;
};

export class SupervisorBootStateMachine {
  private snapshot: SupervisorBootStateSnapshot;

  constructor(private readonly now: () => number = () => Date.now()) {
    const current = this.now();
    this.snapshot = {
      phase: 'idle',
      attempts: 0,
      startedAt: current,
      updatedAt: current,
      timedOut: false,
      summary: 'Supervised boot not started yet.',
    };
  }

  public startPhase(phase: Exclude<SupervisorBootPhase, 'ready' | 'timed_out' | 'failed'>, summary: string): void {
    this.snapshot = {
      ...this.snapshot,
      phase,
      updatedAt: this.now(),
      summary,
    };
  }

  public recordProbeAttempt(summary: string): void {
    this.snapshot = {
      ...this.snapshot,
      phase: 'probe',
      attempts: this.snapshot.attempts + 1,
      updatedAt: this.now(),
      summary,
    };
  }

  public markRecovering(summary: string): void {
    this.snapshot = {
      ...this.snapshot,
      phase: 'recover',
      updatedAt: this.now(),
      summary,
    };
  }

  public markReady(summary: string): void {
    this.snapshot = {
      ...this.snapshot,
      phase: 'ready',
      updatedAt: this.now(),
      timedOut: false,
      summary,
    };
  }

  public markTimedOut(summary: string): void {
    this.snapshot = {
      ...this.snapshot,
      phase: 'timed_out',
      updatedAt: this.now(),
      timedOut: true,
      summary,
    };
  }

  public markFailed(summary: string): void {
    this.snapshot = {
      ...this.snapshot,
      phase: 'failed',
      updatedAt: this.now(),
      summary,
    };
  }

  public getSnapshot(): SupervisorBootStateSnapshot {
    return { ...this.snapshot };
  }
}
