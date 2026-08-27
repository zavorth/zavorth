export type WatchdogAlertChannel = 'terminal' | 'desktop' | 'satellite';

export interface WatchdogJobDefinition {
  readonly id: string;
  readonly name: string;
  readonly checkIntervalMs: number;
  readonly alertChannels?: readonly WatchdogAlertChannel[];
  readonly checkFn: () => Promise<{ healthy: boolean; details: string; metadata?: Record<string, unknown> }>;
}

export interface WatchdogEvaluationResult {
  readonly jobId: string;
  readonly jobName: string;
  readonly timestamp: number;
  readonly healthy: boolean;
  readonly details: string;
  readonly alertDispatched: boolean;
  readonly channelsNotified: readonly WatchdogAlertChannel[];
}

export class WatchdogSupervisionOrchestratorService {
  private readonly jobs = new Map<string, WatchdogJobDefinition>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly alertListeners: Array<(evaluation: WatchdogEvaluationResult) => void> = [];

  public registerJob(job: WatchdogJobDefinition): void {
    this.jobs.set(job.id, job);
  }

  public unregisterJob(jobId: string): void {
    this.stopJob(jobId);
    this.jobs.delete(jobId);
  }

  public startJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    this.stopJob(jobId);

    const interval = setInterval(async () => {
      await this.evaluateJob(jobId);
    }, job.checkIntervalMs);

    this.timers.set(jobId, interval);
    return true;
  }

  public stopJob(jobId: string): void {
    const timer = this.timers.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(jobId);
    }
  }

  public stopAll(): void {
    for (const [id] of this.timers) {
      this.stopJob(id);
    }
  }

  public onAlert(listener: (evaluation: WatchdogEvaluationResult) => void): void {
    this.alertListeners.push(listener);
  }

  public async evaluateJob(jobId: string): Promise<WatchdogEvaluationResult | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    try {
      const checkResult = await job.checkFn();
      const channels = job.alertChannels || ['terminal'];

      const evaluation: WatchdogEvaluationResult = {
        jobId: job.id,
        jobName: job.name,
        timestamp: Date.now(),
        healthy: checkResult.healthy,
        details: checkResult.details,
        alertDispatched: !checkResult.healthy,
        channelsNotified: !checkResult.healthy ? channels : [],
      };

      if (!checkResult.healthy) {
        for (const listener of this.alertListeners) {
          try {
            listener(evaluation);
          } catch {
            // Ignore alert listener exception
          }
        }
      }

      return evaluation;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const evaluation: WatchdogEvaluationResult = {
        jobId: job.id,
        jobName: job.name,
        timestamp: Date.now(),
        healthy: false,
        details: `Watchdog check threw an error: ${errorMsg}`,
        alertDispatched: true,
        channelsNotified: job.alertChannels || ['terminal'],
      };

      for (const listener of this.alertListeners) {
        try {
          listener(evaluation);
        } catch {
          // Ignore listener exception
        }
      }

      return evaluation;
    }
  }
}
