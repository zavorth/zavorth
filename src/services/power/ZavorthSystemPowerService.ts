import { execSync } from 'child_process';

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

    return this.detectRealPowerStatus();
  }

  private detectRealPowerStatus(): SystemPowerStatus {
    const platform = process.platform;

    try {
      if (platform === 'win32') {
        return this.detectWindowsPower();
      }
      if (platform === 'darwin') {
        return this.detectMacosPower();
      }
      if (platform === 'linux') {
        return this.detectLinuxPower();
      }
    } catch {
      // Fall through to unknown
    }

    return { powerSource: 'UNKNOWN', isLowBattery: false };
  }

  private detectWindowsPower(): SystemPowerStatus {
    const output = execSync('WMIC Path Win32_Battery Get BatteryStatus,EstimatedChargeRemaining /Format:List', {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });

    if (!output.includes('BatteryStatus')) {
      return { powerSource: 'AC_POWER', isLowBattery: false };
    }

    const statusMatch = output.match(/BatteryStatus=(\d+)/);
    const chargeMatch = output.match(/EstimatedChargeRemaining=(\d+)/);

    const batteryStatus = statusMatch ? parseInt(statusMatch[1], 10) : 1;
    const charge = chargeMatch ? parseInt(chargeMatch[1], 10) : 100;

    const isCharging = batteryStatus === 2;
    const powerSource: PowerSourceKind = isCharging ? 'AC_POWER' : 'BATTERY';

    return {
      powerSource,
      batteryPercent: charge,
      isCharging,
      isLowBattery: charge < 20,
    };
  }

  private detectMacosPower(): SystemPowerStatus {
    const output = execSync('pmset -g batt', { encoding: 'utf8', timeout: 5000, windowsHide: true });

    const isCharging = output.includes('AC Power') || output.includes('charging');
    const chargeMatch = output.match(/(\d+)%/);
    const charge = chargeMatch ? parseInt(chargeMatch[1], 10) : 100;

    return {
      powerSource: isCharging ? 'AC_POWER' : 'BATTERY',
      batteryPercent: charge,
      isCharging,
      isLowBattery: charge < 20,
    };
  }

  private detectLinuxPower(): SystemPowerStatus {
    const capacityPath = '/sys/class/power_supply/BAT0/capacity';
    const statusPath = '/sys/class/power_supply/BAT0/status';

    try {
      const capacity = parseInt(execSync(`cat ${capacityPath}`, { encoding: 'utf8', timeout: 2000, windowsHide: true }).trim(), 10);
      const status = execSync(`cat ${statusPath}`, { encoding: 'utf8', timeout: 2000, windowsHide: true }).trim();

      const isCharging = status === 'Charging';
      return {
        powerSource: isCharging ? 'AC_POWER' : 'BATTERY',
        batteryPercent: capacity,
        isCharging,
        isLowBattery: capacity < 20,
      };
    } catch {
      return { powerSource: 'AC_POWER', isLowBattery: false };
    }
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
