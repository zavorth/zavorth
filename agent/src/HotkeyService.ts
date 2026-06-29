import { EventEmitter } from 'events';
import { t } from './i18n.js';

/**
 * HotkeyService — Captures local terminal hotkey activations.
 *
 * Replaced global key interception (which utilized precompiled executables
 * flagged by antivirus) with a secure, standard input key listener.
 */
export class HotkeyService extends EventEmitter {
  private enabled = false;
  private hotkey: string;
  private stdinHandler: ((data: Buffer) => void) | null = null;

  constructor(options?: { hotkey?: string }) {
    super();
    this.hotkey = options?.hotkey || 'B';
  }

  /**
   * Enables the local keypress listener.
   */
  public async enable(): Promise<void> {
    if (this.stdinHandler) return;
    this.enabled = true;

    try {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        this.stdinHandler = (data: Buffer) => {
          if (!this.enabled) return;
          const key = data.toString();

          // Ctrl+C to allow exit
          if (key === '\u0003') {
            process.emit('SIGINT');
            return;
          }

          // Check if key matches the hotkey (case insensitive)
          if (key.toUpperCase() === this.hotkey.toUpperCase()) {
            console.log(`[Hotkey] ⌨️  Hotkey (${this.hotkey}) pressed in terminal!`);
            this.emit('activated', 'hotkey');
          }
        };

        process.stdin.on('data', this.stdinHandler);
        console.log(t('hotkey_enabled', { hotkey: this.hotkey }) + ' (Terminal-only for security)');
      } else {
        console.log('[Hotkey] Non-TTY terminal. Stdin hotkey listener skipped.');
      }
    } catch (error: any) {
      console.error(`[Hotkey] Start failed: ${error.message}`);
      this.enabled = false;
    }
  }

  /**
   * Disables the listener.
   */
  public disable(): void {
    this.enabled = false;
    if (this.stdinHandler) {
      try {
        process.stdin.off('data', this.stdinHandler);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
          process.stdin.pause();
        }
      } catch { /* ignore */ }
      this.stdinHandler = null;
    }
    console.log(t('hotkey_disabled', { hotkey: this.hotkey }));
  }

  /**
   * Service status.
   */
  public get isEnabled(): boolean {
    return this.enabled && this.stdinHandler !== null;
  }
}

