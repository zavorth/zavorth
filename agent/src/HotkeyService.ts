import { EventEmitter } from 'events';
import { t } from './i18n.js';
import { asErrorLike } from '../../src/utils/errorLike.js';
function asErrorLike(error: unknown): { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown } {
  if (error && typeof error === 'object') return error as { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown };
  if (typeof error === 'string' && error.trim()) return { message: error };
  if (typeof error === 'number' || typeof error === 'boolean') return { message: String(error) };
  return { message: 'Unexpected error' };
}

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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error(`[Hotkey] Start failed: ${err.message}`);
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

