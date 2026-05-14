import { EventEmitter } from 'events';

/**
 * HotkeyService — Captura o atalho global Win+B (Mode 2).
 *
 * Usa node-global-key-listener para interceptar teclas em qualquer
 * janela do Windows. Quando Win+B é pressionado, emite 'activated'.
 *
 * Pode ser habilitado/desabilitado pelo MicGateService.
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
   * Habilita o listener de hotkey global.
   */
  public async enable(): Promise<void> {
    if (this.listener) return;
    this.enabled = true;

    try {
      // Import dinâmico para não crashar se o package não está instalado
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
          console.log(`[Hotkey] ⌨️  Win+${this.hotkey} pressionado!`);
          this.emit('activated', 'hotkey');
          // Reset meta state to prevent double-trigger
          this.metaDown = false;
        }
      });

      console.log(`[Hotkey] Atalho Win+${this.hotkey} habilitado.`);

    } catch (error: any) {
      console.error(`[Hotkey] Falha ao iniciar: ${error.message}`);
      console.log('[Hotkey] Dica: npm install node-global-key-listener');
      this.enabled = false;
    }
  }

  /**
   * Desabilita o listener (mic desligado = hotkey inativo).
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
    console.log(`[Hotkey] Atalho Win+${this.hotkey} desabilitado.`);
  }

  /**
   * Status do serviço.
   */
  public get isEnabled(): boolean {
    return this.enabled && this.listener !== null;
  }
}
