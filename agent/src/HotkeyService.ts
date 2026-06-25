import { EventEmitter } from 'events';
import { t } from './i18n.js';

/**
 * HotkeyService — Captures the global Win+B shortcut (Mode 2).
 *
 * Uses node-global-key-listener to intercept keys in any
 * Windows window. When Win+B is pressed, emits 'activated'.
 *
 * Can be enabled/disabled by MicGateService.
 */
export class HotkeyService extends EventEmitter {
  private enabled = false;
  private listener: any = null;
  private metaDown = false;
  private hotkey: string;

  constructor(options?: { hotkey?: string }) {
    super();
    this.hotkey = options?.hotkey || 'B';
  }

  /**
   * Enables the global hotkey listener.
   */
  public async enable(): Promise<void> {
    if (this.listener) return;
    this.enabled = true;

    try {
      // Dynamic import to prevent crash if package is not installed
      const { GlobalKeyboardListener } = await import('node-global-key-listener');
      this.listener = new GlobalKeyboardListener();

      this.listener.addListener((event: any, down: any) => {
        if (!this.enabled) return;

        // Track meta key (Windows key) state
        if (event.name === 'LEFT META' || event.name === 'RIGHT META') {
          this.metaDown = event.state === 'DOWN';
          return;
        }

        // Check for hotkey combo: Win + configured key
        if (
          event.name === this.hotkey.toUpperCase() &&
          event.state === 'DOWN' &&
          this.metaDown
        ) {
          console.log(`[Hotkey] ⌨️  Win+${this.hotkey} pressed!`);
          this.emit('activated', 'hotkey');
          // Reset meta state to prevent double-trigger
          this.metaDown = false;
        }
      });

      console.log(t('hotkey_enabled', { hotkey: this.hotkey }));

    } catch (error: any) {
      console.error(`[Hotkey] Start failed: ${error.message}`);
      console.log('[Hotkey] Hint: npm install node-global-key-listener');
      this.enabled = false;
    }
  }

  /**
   * Disables the listener (mic disabled = hotkey inactive).
   */
  public disable(): void {
    this.enabled = false;
    if (this.listener) {
      try {
        this.listener.kill();
      } catch { /* ignore */ }
      this.listener = null;
    }
    this.metaDown = false;
    console.log(t('hotkey_disabled', { hotkey: this.hotkey }));
  }

  /**
   * Service status.
   */
  public get isEnabled(): boolean {
    return this.enabled && this.listener !== null;
  }
}
