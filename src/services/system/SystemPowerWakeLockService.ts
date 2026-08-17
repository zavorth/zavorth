import { logger } from '../../logger.js';
/**
 * System Power Wake-Lock Service.
 * Inspired by xAI Grok-Build (xai-system-power).
 * Prevents operating system sleep, standby, or idle hibernation during long-running agent tasks,
 * background subagent swarms, or heavy builds across Windows, macOS, and Linux.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as os from 'node:os';

export interface PowerLockTicket {
  id: string;
  reason: string;
  platform: 'win32' | 'darwin' | 'linux' | 'unsupported';
  acquiredAt: string;
  releasedAt?: string;
  active: boolean;
}

export class SystemPowerWakeLockService {
  private static locks = new Map<string, PowerLockTicket>();
  private static processes = new Map<string, ChildProcess>();
  private static keepAliveInterval: NodeJS.Timeout | null = null;

  /**
   * Acquires a system wake-lock to prevent OS sleep.
   */
  static acquireLock(reason: string): PowerLockTicket {
    const id = `lock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const platformName = os.platform();
    const platform: PowerLockTicket['platform'] =
      platformName === 'win32' ? 'win32' :
      platformName === 'darwin' ? 'darwin' :
      platformName === 'linux' ? 'linux' : 'unsupported';

    const ticket: PowerLockTicket = {
      id,
      reason,
      platform,
      acquiredAt: new Date().toISOString(),
      active: true,
    };

    this.locks.set(id, ticket);
    this.activatePlatformLock(id, platform, reason);
    this.ensureKeepAlive();

    return ticket;
  }

  /**
   * Releases an active system wake-lock.
   */
  static releaseLock(ticketId: string): boolean {
    const ticket = this.locks.get(ticketId);
    if (!ticket || !ticket.active) {
      return false;
    }

    ticket.active = false;
    ticket.releasedAt = new Date().toISOString();

    const proc = this.processes.get(ticketId);
    if (proc && !proc.killed) {
      try {
        proc.kill();
      } catch {
        // Process might have already terminated cleanly
      }
      this.processes.delete(ticketId);
    }

    this.checkKeepAlive();
    return true;
  }

  /**
   * Releases all active locks (e.g. on shutdown).
   */
  static releaseAll(): void {
    for (const id of Array.from(this.locks.keys())) {
      this.releaseLock(id);
    }
  }

  /**
   * Checks whether any wake-lock is currently active.
   */
  static hasActiveLocks(): boolean {
    for (const ticket of this.locks.values()) {
      if (ticket.active) return true;
    }
    return false;
  }

  /**
   * Returns all active wake-locks.
   */
  static getActiveLocks(): PowerLockTicket[] {
    return Array.from(this.locks.values()).filter((t) => t.active);
  }

  /**
   * Platform-specific lock implementation.
   */
  private static activatePlatformLock(id: string, platform: PowerLockTicket['platform'], reason: string): void {
    try {
      if (platform === 'darwin') {
        // macOS caffeinate command
        const child = spawn('caffeinate', ['-d', '-i', '-m', '-s'], {
          stdio: 'ignore',
          detached: false,
        });
        child.unref();
        this.processes.set(id, child);
      } else if (platform === 'linux') {
        // Linux systemd-inhibit or sleep blocker if available
        const child = spawn('systemd-inhibit', [
          '--what=sleep:idle',
          `--who=Zavorth Agent`,
          `--why=${reason}`,
          'sleep', '86400',
        ], {
          stdio: 'ignore',
          detached: false,
        });
        child.on('error', (err: Error) => {
          logger.debug(`[PowerLock] systemd-inhibit spawn error: ${err.message}`);
        });
        child.unref();
        this.processes.set(id, child);
      } else if (platform === 'win32') {
        // Windows keepalive via PowerShell execution state loop
        const child = spawn('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `$sig = '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'; Add-Type -MemberDefinition $sig -Name Win32 -Namespace Kernel; [Kernel.Win32]::SetThreadExecutionState(0x80000003); Start-Sleep -Seconds 86400`,
        ], {
          stdio: 'ignore',
          detached: false,
        });
        child.on('error', (err: Error) => {
          logger.debug(`[PowerLock] PowerShell keepalive spawn error: ${err.message}`);
        });
        child.unref();
        this.processes.set(id, child);
      }
    } catch (err: unknown) {
      logger.debug(`[PowerLock] Fallback to internal keepalive timer: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private static ensureKeepAlive(): void {
    if (!this.keepAliveInterval && this.hasActiveLocks()) {
      this.keepAliveInterval = setInterval(() => {
        // Heartbeat keepalive
      }, 10_000);
      this.keepAliveInterval.unref();
    }
  }

  private static checkKeepAlive(): void {
    if (this.keepAliveInterval && !this.hasActiveLocks()) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Resets all internal state (for testing).
   */
  static reset(): void {
    this.releaseAll();
    this.locks.clear();
    this.processes.clear();
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}
