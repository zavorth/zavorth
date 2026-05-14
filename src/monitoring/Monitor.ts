import os from 'os';
import { LogRepository } from '../storage/LogRepository.js';

export class Monitor {
  private logRepo: LogRepository;
  private intervalId: NodeJS.Timeout | null = null;
  private static readonly HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1 Hora

  constructor(logRepo: LogRepository) {
    this.logRepo = logRepo;
  }

  public startHeartbeat(): void {
    if (this.intervalId) return;
    this.logRepo.log('info', 'Monitor', 'Heartbeat e Watchdog ativados.');
    
    this.intervalId = setInterval(() => {
      this.logRepo.log('info', 'Heartbeat', 'Serviço operacional. Monitorando filas...', this.getHealthStats());
    }, Monitor.HEARTBEAT_INTERVAL_MS);
  }

  public stopHeartbeat(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public getHealthStats(): Record<string, any> {
    const memory = process.memoryUsage();
    return {
      uptime_seconds: Math.floor(process.uptime()),
      ram_mb_rss: Math.round(memory.rss / 1024 / 1024),
      ram_mb_heap: Math.round(memory.heapUsed / 1024 / 1024),
      cpu_arch: os.arch(),
      platform: os.platform(),
      timestamp: new Date().toISOString()
    };
  }
}
