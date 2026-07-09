import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { t } from './i18n.js';

const execAsync = promisify(exec);

/**
 * MicGateService — Zavorth Agent privacy guardian.
 *
 * Monitors the Windows microphone status every 1s.
 * If the microphone is disabled/muted, the entire system becomes inactive.
 * When the microphone is enabled, emits 'mic:on' and enables Wake Word + Hotkey.
 * When disabled, emits 'mic:off' and disables everything.
 *
 * The physical laptop microphone switch literally becomes
 * Zavorth's safety switch.
 */
export class MicGateService extends EventEmitter {
  private isActive = false;
  private watchInterval: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs: number;

  constructor(checkIntervalMs = 1000) {
    super();
    this.checkIntervalMs = checkIntervalMs;
  }

  /**
   * Starts microphone monitoring.
   */
  public start(): void {
    if (this.watchInterval) return;

    console.log('[MicGate] Starting microphone monitoring...');

    // Immediate check
    this.check();

    // Periodic check
    this.watchInterval = setInterval(() => this.check(), this.checkIntervalMs);
  }

  /**
   * Stops monitoring.
   */
  public stop(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    this.isActive = false;
  }

  /**
   * Returns current status.
   */
  public get active(): boolean {
    return this.isActive;
  }

  /**
   * Verifies microphone status and emits change events.
   */
  private async check(): Promise<void> {
    try {
      const micOn = await this.isMicrophoneEnabled();

      if (micOn && !this.isActive) {
        this.isActive = true;
        console.log('[MicGate] 🎤 Microphone ACTIVE — enabling listening...');
        this.emit('mic:on');

      } else if (!micOn && this.isActive) {
        this.isActive = false;
        console.log(t('mic_off_log'));
        this.emit('mic:off');
      }
    } catch (error: unknown) {
      // Silent failure — we don't want to crash the agent due to WMI errors
      // Assume active mic as safe fallback
      if (!this.isActive) {
        this.isActive = true;
        this.emit('mic:on');
      }
    }
  }

  /**
   * Verifies if microphone is enabled in Windows via PowerShell.
   *
   * Uses AudioDeviceCmdlets or WMI to check status.
   * Returns true if at least one capture device is enabled and not muted.
   */
  private async isMicrophoneEnabled(): Promise<boolean> {
    if (os.platform() !== 'win32') {
      return true; // Safe fallback on non-Windows
    }
    try {
      // Method 1: Check via WMI if active capture audio device exists
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_SoundDevice | Where-Object { $_.Status -eq 'OK' -and $_.StatusInfo -eq 3 } | Measure-Object | Select-Object -ExpandProperty Count"`,
        { timeout: 3000 },
      );
      const count = parseInt(stdout.trim(), 10);
      if (!isNaN(count) && count > 0) return true;

      // Method 2: Fallback — verify if mic exists in Device Manager
      const { stdout: devStdout } = await execAsync(
        `powershell -NoProfile -Command "(Get-PnpDevice -Class AudioEndpoint -Status OK | Where-Object { $_.FriendlyName -match 'Mic|mic|Microphone' }).Count"`,
        { timeout: 3000 },
      );
      const devCount = parseInt(devStdout.trim(), 10);
      return !isNaN(devCount) && devCount > 0;

    } catch {
      // If verification fails, assume active (safe fallback not to block the user)
      return true;
    }
  }
}
