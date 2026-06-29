/**
 * BrowserCdpSupervisor — WebSocket persistente para controle de browser.
 *
 * Mantém conexão CDP (Chrome DevTools Protocol) ativa com o browser,
 * rastreia árvore de frames, captura erros de console, e intercepta
 * diálogos JS (alert, confirm, prompt) via bridge injetado.
 *
 * Uso:
 *   const supervisor = new BrowserCdpSupervisor({ browserWSEndpoint: 'ws://...' });
 *   await supervisor.connect();
 *   await supervisor.navigate('https://example.com');
 *   const result = await supervisor.evaluate('document.title');
 *   await supervisor.disconnect();
 */

import { EventEmitter } from 'events';

export interface BrowserCdpSupervisorOptions {
  browserWSEndpoint: string;
  defaultTimeoutMs?: number;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
}

export interface FrameInfo {
  id: string;
  parentId?: string;
  url: string;
  name?: string;
}

export interface DialogInfo {
  type: string;
  message: string;
  url: string;
  defaultPrompt?: string;
  timestamp: number;
}

export interface ConsoleEntry {
  type: string;
  text: string;
  url?: string;
  line?: number;
  timestamp: number;
}

export type DialogPolicy = 'must_respond' | 'auto_dismiss' | 'auto_accept';

export class BrowserCdpSupervisor extends EventEmitter {
  private readonly wsEndpoint: string;
  private readonly timeoutMs: number;
  private readonly reconnectMs: number;
  private readonly maxReconnects: number;

  private ws: import('ws').WebSocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private pendingCommands = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private frames = new Map<string, FrameInfo>();
  private consoleLog: ConsoleEntry[] = [];
  private dialogPolicy: DialogPolicy = 'auto_dismiss';
  private dialogQueue: DialogInfo[] = [];
  private messageId = 0;

  constructor(options: BrowserCdpSupervisorOptions) {
    super();
    this.wsEndpoint = options.browserWSEndpoint;
    this.timeoutMs = options.defaultTimeoutMs ?? 30_000;
    this.reconnectMs = options.reconnectIntervalMs ?? 5_000;
    this.maxReconnects = options.maxReconnectAttempts ?? 10;
  }

  /**
   * Conecta ao browser via WebSocket CDP.
   */
  async connect(): Promise<void> {
    const WebSocket = (await import('ws')).default;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsEndpoint);

      this.ws.on('open', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.enableDomains();
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(String(data));
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
        this.rejectAllPending('WebSocket fechado');
        this.attemptReconnect();
      });

      this.ws.on('error', (err) => {
        if (!this.connected) {
          reject(err);
        }
        this.emit('error', err);
      });
    });
  }

  /**
   * Desconecta do browser.
   */
  async disconnect(): Promise<void> {
    this.rejectAllPending('Desconectado manualmente');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pendingCommands) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pendingCommands.delete(id);
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnects) {
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectMs * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(async () => {
      try {
        await this.connect();
        this.emit('reconnected');
      } catch {
        this.attemptReconnect();
      }
    }, delay);
  }

  private async enableDomains(): Promise<void> {
    await this.send('Runtime.enable', {});
    await this.send('Page.enable', {});
    await this.send('Network.enable', {});
    await this.send('DOM.enable', {});
  }

  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      // Resposta a comando
      if (msg.id !== undefined && this.pendingCommands.has(String(msg.id))) {
        const pending = this.pendingCommands.get(String(msg.id))!;
        clearTimeout(pending.timer);
        this.pendingCommands.delete(String(msg.id));

        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
        return;
      }

      // Evento
      if (msg.method) {
        this.handleEvent(msg.method, msg.params);
      }
    } catch {
      // ignora mensagens inválidas
    }
  }

  private handleEvent(method: string, params: Record<string, unknown>): void {
    switch (method) {
      case 'Runtime.consoleAPICalled':
        this.consoleLog.push({
          type: String(params.type),
          text: String(params.args?.[0]?.value ?? ''),
          url: String(params.source),
          line: Number(params.lineNumber),
          timestamp: Date.now(),
        });
        this.emit('console', this.consoleLog[this.consoleLog.length - 1]);
        break;

      case 'Page.frameNavigated':
        if (params.frame) {
          const frame = params.frame as Record<string, unknown>;
          this.frames.set(String(frame.id), {
            id: String(frame.id),
            parentId: frame.parentId ? String(frame.parentId) : undefined,
            url: String(frame.url),
            name: frame.name ? String(frame.name) : undefined,
          });
        }
        break;

      case 'Page.javascriptDialogOpening':
        this.handleDialog(params);
        break;

      case 'Runtime.exceptionThrown':
        this.emit('exception', params);
        break;
    }
  }

  private async handleDialog(params: Record<string, unknown>): Promise<void> {
    const dialog: DialogInfo = {
      type: String(params.type),
      message: String(params.message),
      url: String(params.url),
      defaultPrompt: params.defaultPrompt ? String(params.defaultPrompt) : undefined,
      timestamp: Date.now(),
    };

    this.dialogQueue.push(dialog);
    this.emit('dialog', dialog);

    const sessionId = params.sessionId ? String(params.sessionId) : undefined;

    switch (this.dialogPolicy) {
      case 'auto_accept':
        await this.handleDialogResponse(dialog, true, dialog.defaultPrompt);
        break;
      case 'auto_dismiss':
        await this.handleDialogResponse(dialog, false);
        break;
      case 'must_respond':
        // Espera resposta externa via respondToDialog()
        break;
    }
  }

  /**
   * Responde a um diálogo pendente.
   */
  async respondToDialog(
    dialog: DialogInfo,
    accept: boolean,
    promptResponse?: string,
  ): Promise<void> {
    await this.handleDialogResponse(dialog, accept, promptResponse);
  }

  private async handleDialogResponse(
    dialog: DialogInfo,
    accept: boolean,
    promptResponse?: string,
  ): Promise<void> {
    await this.send('Page.handleJavaScriptDialog', {
      accept,
      promptText: accept && dialog.type === 'prompt' ? promptResponse : undefined,
    });
  }

  /**
   * Envia comando CDP e aguarda resposta.
   */
  async send(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || !this.connected) {
      throw new Error('Não conectado ao browser');
    }

    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(String(id));
        reject(new Error(`Timeout aguardando resposta de ${method}`));
      }, this.timeoutMs);

      this.pendingCommands.set(String(id), { resolve, reject, timer });

      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  /**
   * Navega para uma URL.
   */
  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
  }

  /**
   * Avalia JavaScript na página.
   */
  async evaluate(expression: string): Promise<unknown> {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    }) as Record<string, unknown>;

    const remoteObj = result?.result as Record<string, unknown> | undefined;
    return remoteObj?.value;
  }

  /**
   * Captura screenshot da página.
   */
  async screenshot(options: { format?: string; quality?: number } = {}): Promise<string> {
    const result = await this.send('Page.captureScreenshot', {
      format: options.format ?? 'png',
      quality: options.quality,
    }) as Record<string, unknown>;

    return String(result?.data ?? '');
  }

  /**
   * Retorna frames ativos.
   */
  getFrames(): FrameInfo[] {
    return Array.from(this.frames.values());
  }

  /**
   * Retorna log de console.
   */
  getConsoleLog(limit: number = 100): ConsoleEntry[] {
    return this.consoleLog.slice(-limit);
  }

  /**
   * Define política de tratamento de diálogos.
   */
  setDialogPolicy(policy: DialogPolicy): void {
    this.dialogPolicy = policy;
  }

  /**
   * Retorna diálogos pendentes.
   */
  getPendingDialogs(): DialogInfo[] {
    return [...this.dialogQueue];
  }

  /**
   * Limpa fila de diálogos processados.
   */
  clearDialogQueue(): void {
    this.dialogQueue = [];
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
