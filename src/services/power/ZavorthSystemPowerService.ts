export type PowerSourceKind = 'AC_POWER' | 'BATTERY' | 'UNKNOWN';

export interface SystemPowerStatus {
  readonly powerSource: PowerSourceKind;
  readonly batteryPercent?: number;
  readonly isCharging?: boolean;
  readonly isLowBattery: boolean;
}

export interface PowerWakeLock {
  readonly lockId: string;
  readonly tag: string;
  readonly acquiredAt: number;
  readonly maxDurationMs: number;
}

export interface PowerThrottlePolicy {
  readonly maxConcurrentSubagents: number;
  readonly throttleReason?: string;
  readonly isThrottled: boolean;
  readonly recommendedDelayMs: number;
}

export class ZavorthSystemPowerService {
  private readonly activeLocks = new Map<string, PowerWakeLock>();
  private lockCounter = 0;
  private mockedStatus: SystemPowerStatus | null = null;

  public setMockStatus(status: SystemPowerStatus | null): void {
    this.mockedStatus = status;
  }

  public getPowerStatus(): SystemPowerStatus {
    if (this.mockedStatus) {
      return this.mockedStatus;
    }

    return {
      powerSource: 'AC_POWER',
      batteryPercent: 100,
      isCharging: true,
      isLowBattery: false,
    };
  }

  public acquireWakeLock(tag: string, maxDurationMs = 300000): PowerWakeLock {
    const lockId = `wakelock-${Date.now()}-${this.lockCounter++}`;
    const lock: PowerWakeLock = {
      lockId,
      tag,
      acquiredAt: Date.now(),
      maxDurationMs,
    };

    this.activeLocks.set(lockId, lock);
    return lock;
  }

  public releaseWakeLock(lockId: string): boolean {
    return this.activeLocks.delete(lockId);
  }

  public getActiveLocks(): readonly PowerWakeLock[] {
    const now = Date.now();
    for (const [id, lock] of this.activeLocks.entries()) {
      if (now - lock.acquiredAt > lock.maxDurationMs) {
        this.activeLocks.delete(id);
      }
    }
    return Array.from(this.activeLocks.values());
  }

  public evaluateThrottlePolicy(): PowerThrottlePolicy {
    const status = this.getPowerStatus();

    if (status.powerSource === 'BATTERY' && status.batteryPercent !== undefined && status.batteryPercent < 20) {
      return {
        maxConcurrentSubagents: 1,
        throttleReason: `Battery level is critically low (${status.batteryPercent}%). Throttling subagents to prevent shutdown.`,
        isThrottled: true,
        recommendedDelayMs: 250,
      };
    }

    if (status.powerSource === 'BATTERY') {
      return {
        maxConcurrentSubagents: 3,
        throttleReason: 'Running on battery power. Limiting max parallel workers.',
        isThrottled: true,
        recommendedDelayMs: 50,
      };
    }

    return {
      maxConcurrentSubagents: 8,
      isThrottled: false,
      recommendedDelayMs: 0,
    };
  }
}
