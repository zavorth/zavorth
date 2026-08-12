export interface ManagedTaskWorker {
  id: string;
  name: string;
  isAlive: () => Promise<boolean> ;
  restart: () => Promise<void> ;
}

export interface HealthReport {
  workerId: string;
  status: string;
}

export class ZavorthSelfHealingDaemonSupervisor {
  private workers: ManagedTaskWorker[] = [];
  private running = false;

  registerWorker(worker: ManagedTaskWorker): void {
    this.workers.push(worker);
  }

  async performHealthCheckSweep(): Promise<HealthReport[]> {
    const reports: HealthReport[] = [];
    for (const worker of this.workers) {
      const alive = await worker.isAlive();
      if (!alive) {
        await worker.restart();
        reports.push({ workerId: worker.id, status: 'restarted' });
      }
    }
    return reports;
  }

  stopSupervision(): void {
    this.running = false;
  }
}
