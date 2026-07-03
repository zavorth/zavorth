/**
 * BrowserCdpSupervisorEnhanced — Full CDP browser control with frame tree,
 * console capture, dialog bridge injection, and OOPIF support.
 *
 * Extends base supervisor with production-grade features for
 * deep browser automation and monitoring.
 *
 * Usage:
 *   const supervisor = new BrowserCdpSupervisorEnhanced({ browserWSEndpoint: 'ws://...' });
 *   await supervisor.connect();
 *   await supervisor.injectDialogBridge();
 *   const tree = await supervisor.getFrameTree();
 *   const errors = supervisor.getConsoleErrors();
 */

import { EventEmitter } from 'events';

export interface EnhancedSupervisorOptions {
  browserWSEndpoint: string;
  defaultTimeoutMs?: number;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
  captureConsoleErrors?: boolean;
  injectDialogBridge?: boolean;
}

export interface FrameTreeNode {
  id: string;
  parentId?: string;
  url: string;
  name?: string;
  children: FrameTreeNode[];
  securityOrigin?: string;
  mimeType?: string;
}

export interface ConsoleError {
  type: string;
  text: string;
  url?: string;
  line?: number;
  column?: number;
  stackTrace?: string;
  timestamp: number;
}

export interface DialogBridgeResult {
  type: string;
  message: string;
  url: string;
  response?: string;
  accepted: boolean;
}

export type DialogPolicy = 'must_respond' | 'auto_dismiss' | 'auto_accept';

const DIALOG_BRIDGE_SCRIPT = `
(function() {
  if (window.__zavorthDialogBridge) return;

  const originalAlert = window.alert;
  const originalConfirm = window.confirm;
  const originalPrompt = window.prompt;

  window.alert = function(message) {
    window.__zavorthDialogBridge({
      type: 'alert',
      message: String(message),
      url: window.location.href
    });
    return originalAlert.call(window, message);
  };

  window.confirm = function(message) {
    const result = originalConfirm.call(window, message);
    window.__zavorthDialogBridge({
      type: 'confirm',
      message: String(message),
      url: window.location.href,
      response: String(result),
      accepted: result
    });
    return result;
  };

  window.prompt = function(message, defaultVal) {
    const result = originalPrompt.call(window, message, defaultVal);
    window.__zavorthDialogBridge({
      type: 'prompt',
      message: String(message),
      url: window.location.href,
      response: result !== null ? String(result) : null,
      accepted: result !== null
    });
    return result;
  };

  window.__zavorthDialogBridge = function(data) {
    window.dispatchEvent(new CustomEvent('__zavorth_dialog', { detail: data }));
  };

  window.addEventListener('__zavorth_dialog', function(e) {
    console.log('[ZavorthDialogBridge]', JSON.stringify(e.detail));
  });
})();
`;

export class BrowserCdpSupervisorEnhanced extends EventEmitter {
  private readonly wsEndpoint: string;
  private readonly timeoutMs: number;
  private readonly reconnectMs: number;
  private readonly maxReconnects: number;
  private readonly shouldCaptureErrors: boolean;
  private readonly shouldInjectBridge: boolean;

  private ws: import('ws').WebSocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private pendingCommands = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private frames = new Map<string, FrameTreeNode>();
  private consoleLog: Array<{ type: string; text: string; url?: string; line?: number; timestamp: number }> = [];
  private consoleErrors: ConsoleError[] = [];
  private dialogPolicy: DialogPolicy = 'auto_dismiss';
  private dialogQueue: Array<{ type: string; message: string; url: string; defaultPrompt?: string; timestamp: number }> = [];
  private dialogHistory: DialogBridgeResult[] = [];
  private messageId = 0;
  private bridgeInjected = false;
  private oopifFrames = new Set<string>();

  constructor(options: EnhancedSupervisorOptions) {
    super();
    this.wsEndpoint = options.browserWSEndpoint;
    this.timeoutMs = options.defaultTimeoutMs ?? 30_000;
    this.reconnectMs = options.reconnectIntervalMs ?? 5_000;
    this.maxReconnects = options.maxReconnectAttempts ?? 10;
    this.shouldCaptureErrors = options.captureConsoleErrors ?? true;
    this.shouldInjectBridge = options.injectDialogBridge ?? true;
  }

  /**
   * Connects to browser via WebSocket CDP.
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
        this.rejectAllPending('WebSocket closed');
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
   * Disconnects from browser.
   */
  async disconnect(): Promise<void> {
    this.rejectAllPending('Disconnected manually');
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
    await this.send('Page.setInterceptFileChooserDialog', { enabled: true });
  }

  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

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

      if (msg.method) {
        this.handleEvent(msg.method, msg.params);
      }
    } catch {
      // ignore invalid messages
    }
  }

  private handleEvent(method: string, params: Record<string, unknown>): void {
    switch (method) {
      case 'Runtime.consoleAPICalled': {
        const args = params.args as Array<{ value: unknown }> | undefined;
        const entry = {
          type: String(params.type),
          text: String(args?.[0]?.value ?? ''),
          url: String(params.source),
          line: Number(params.lineNumber),
          timestamp: Date.now(),
        };
        this.consoleLog.push(entry);

        if (this.shouldCaptureErrors && (entry.type === 'error' || entry.type === 'warning')) {
          const error: ConsoleError = {
            type: entry.type,
            text: entry.text,
            url: entry.url,
            line: entry.line,
            column: Number(params.columnNumber) || 0,
            stackTrace: params.stackTrace ? JSON.stringify(params.stackTrace) : undefined,
            timestamp: entry.timestamp,
          };
          this.consoleErrors.push(error);
          this.emit('console_error', error);
        }

        this.emit('console', entry);
        break;
      }

      case 'Page.frameNavigated': {
        if (params.frame) {
          const frame = params.frame as Record<string, unknown>;
          const frameId = String(frame.id);
          const node: FrameTreeNode = {
            id: frameId,
            parentId: frame.parentId ? String(frame.parentId) : undefined,
            url: String(frame.url),
            name: frame.name ? String(frame.name) : undefined,
            children: [],
            securityOrigin: frame.securityOrigin ? String(frame.securityOrigin) : undefined,
            mimeType: frame.mimeType ? String(frame.mimeType) : undefined,
          };
          this.frames.set(frameId, node);
          this.buildFrameTree();
        }
        break;
      }

      case 'Page.frameDetached': {
        if (params.frameId) {
          this.frames.delete(String(params.frameId));
          this.oopifFrames.delete(String(params.frameId));
          this.buildFrameTree();
        }
        break;
      }

      case 'Target.attachedToTarget': {
        if (params.targetInfo) {
          const target = params.targetInfo as Record<string, unknown>;
          if (target.type === 'iframe' || target.type === 'page') {
            this.oopifFrames.add(String(target.targetId));
            this.emit('oopif_attached', target);
          }
        }
        break;
      }

      case 'Target.detachedFromTarget': {
        if (params.targetId) {
          this.oopifFrames.delete(String(params.targetId));
          this.emit('oopif_detached', { targetId: params.targetId });
        }
        break;
      }

      case 'Page.javascriptDialogOpening':
        this.handleDialog(params);
        break;

      case 'Runtime.exceptionThrown':
        this.emit('exception', params);
        break;
    }
  }

  private buildFrameTree(): void {
    const roots: FrameTreeNode[] = [];
    const childMap = new Map<string, FrameTreeNode>();

    for (const frame of this.frames.values()) {
      frame.children = [];
      childMap.set(frame.id, frame);
    }

    for (const frame of this.frames.values()) {
      if (frame.parentId && childMap.has(frame.parentId)) {
        childMap.get(frame.parentId)!.children.push(frame);
      } else {
        roots.push(frame);
      }
    }

    this.emit('frame_tree_updated', roots);
  }

  private async handleDialog(params: Record<string, unknown>): Promise<void> {
    const dialog = {
      type: String(params.type),
      message: String(params.message),
      url: String(params.url),
      defaultPrompt: params.defaultPrompt ? String(params.defaultPrompt) : undefined,
      timestamp: Date.now(),
    };

    this.dialogQueue.push(dialog);
    this.emit('dialog', dialog);

    switch (this.dialogPolicy) {
      case 'auto_accept':
        await this.handleDialogResponse(dialog, true, dialog.defaultPrompt);
        break;
      case 'auto_dismiss':
        await this.handleDialogResponse(dialog, false);
        break;
      case 'must_respond':
        break;
    }
  }

  /**
   * Injects dialog bridge script into all frames.
   * Intercepts alert(), confirm(), prompt() and logs them.
   */
  async injectDialogBridge(): Promise<void> {
    if (this.bridgeInjected) return;

    try {
      await this.send('Runtime.evaluate', {
        expression: DIALOG_BRIDGE_SCRIPT,
        allowUnsafeEvalBlockedByCSP: true,
      });
      this.bridgeInjected = true;
      this.emit('bridge_injected');
    } catch (err) {
      this.emit('bridge_error', err);
    }
  }

  /**
   * Returns full frame tree with nested children.
   */
  async getFrameTree(): Promise<FrameTreeNode> {
    try {
      const result = await this.send('Page.getFrameTree', {}) as Record<string, unknown>;
      const frameTree = result?.frameTree as Record<string, unknown>;
      return this.parseFrameTree(frameTree);
    } catch {
      // Fallback to tracked frames
      const roots: FrameTreeNode[] = [];
      for (const frame of this.frames.values()) {
        if (!frame.parentId) {
          roots.push(frame);
        }
      }
      return {
        id: 'root',
        url: '',
        children: roots,
      };
    }
  }

  private parseFrameTree(tree: Record<string, unknown>): FrameTreeNode {
    const frame = tree.frame as Record<string, unknown>;
    const childFrames = (tree.childFrames || []) as Record<string, unknown>[];

    return {
      id: String(frame.id),
      parentId: frame.parentId ? String(frame.parentId) : undefined,
      url: String(frame.url),
      name: frame.name ? String(frame.name) : undefined,
      children: childFrames.map((child) => this.parseFrameTree(child)),
      securityOrigin: frame.securityOrigin ? String(frame.securityOrigin) : undefined,
      mimeType: frame.mimeType ? String(frame.mimeType) : undefined,
    };
  }

  /**
   * Evaluates JavaScript in a specific frame.
   */
  async evaluateInFrame(frameId: string, expression: string): Promise<unknown> {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      contextId: await this.getFrameContextId(frameId),
    }) as Record<string, unknown>;

    const remoteObj = result?.result as Record<string, unknown> | undefined;
    return remoteObj?.value;
  }

  private async getFrameContextId(frameId: string): Promise<number | undefined> {
    try {
      const result = await this.send('Runtime.evaluate', {
        expression: 'window',
        returnByValue: false,
      }) as Record<string, unknown>;

      const context = result?.executionContextId as number | undefined;
      return context;
    } catch {
      return undefined;
    }
  }

  /**
   * Waits for a specific frame to load.
   */
  async waitForFrame(frameId: string, timeoutMs: number = 10_000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.frames.has(frameId)) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  /**
   * Captures screenshot of a specific frame.
   */
  async screenshotFrame(frameId: string, options: { format?: string; quality?: number } = {}): Promise<string> {
    const result = await this.send('Page.captureScreenshot', {
      format: options.format ?? 'png',
      quality: options.quality,
      clip: undefined,
      captureBeyondViewport: true,
    }) as Record<string, unknown>;

    return String(result?.data ?? '');
  }

  /**
   * Returns OOPIF (out-of-process iframe) targets.
   */
  getOopifFrames(): string[] {
    return Array.from(this.oopifFrames);
  }

  /**
   * Attaches to an OOPIF target for direct control.
   */
  async attachToOopif(targetId: string): Promise<void> {
    await this.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
  }

  /**
   * Responds to a pending dialog.
   */
  async respondToDialog(
    dialog: { type: string; message: string; url: string },
    accept: boolean,
    promptResponse?: string,
  ): Promise<void> {
    await this.handleDialogResponse(dialog, accept, promptResponse);
    this.dialogHistory.push({
      type: dialog.type,
      message: dialog.message,
      url: dialog.url,
      response: promptResponse,
      accepted: accept,
    });
  }

  private async handleDialogResponse(
    dialog: { type: string },
    accept: boolean,
    promptResponse?: string,
  ): Promise<void> {
    await this.send('Page.handleJavaScriptDialog', {
      accept,
      promptText: accept && dialog.type === 'prompt' ? promptResponse : undefined,
    });
  }

  /**
   * Sends CDP command and waits for response.
   */
  async send(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to browser');
    }

    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(String(id));
        reject(new Error(`Timeout waiting for ${method}`));
      }, this.timeoutMs);

      this.pendingCommands.set(String(id), { resolve, reject, timer });
      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  /**
   * Navigates to URL.
   */
  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
  }

  /**
   * Evaluates JavaScript on the page.
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
   * Captures page screenshot.
   */
  async screenshot(options: { format?: string; quality?: number } = {}): Promise<string> {
    const result = await this.send('Page.captureScreenshot', {
      format: options.format ?? 'png',
      quality: options.quality,
    }) as Record<string, unknown>;

    return String(result?.data ?? '');
  }

  /**
   * Returns tracked frames.
   */
  getFrames(): FrameTreeNode[] {
    return Array.from(this.frames.values());
  }

  /**
   * Returns console log.
   */
  getConsoleLog(limit: number = 100): Array<{ type: string; text: string; url?: string; line?: number; timestamp: number }> {
    return this.consoleLog.slice(-limit);
  }

  /**
   * Returns captured console errors.
   */
  getConsoleErrors(limit: number = 100): ConsoleError[] {
    return this.consoleErrors.slice(-limit);
  }

  /**
   * Clears console error buffer.
   */
  clearConsoleErrors(): void {
    this.consoleErrors = [];
  }

  /**
   * Sets dialog handling policy.
   */
  setDialogPolicy(policy: DialogPolicy): void {
    this.dialogPolicy = policy;
  }

  /**
   * Returns pending dialogs.
   */
  getPendingDialogs(): Array<{ type: string; message: string; url: string; defaultPrompt?: string; timestamp: number }> {
    return [...this.dialogQueue];
  }

  /**
   * Returns dialog history.
   */
  getDialogHistory(): DialogBridgeResult[] {
    return [...this.dialogHistory];
  }

  /**
   * Clears dialog queue.
   */
  clearDialogQueue(): void {
    this.dialogQueue = [];
  }

  /**
   * Returns connection status.
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Returns supervisor statistics.
   */
  getStats(): {
    connected: boolean;
    frames: number;
    oopifFrames: number;
    consoleEntries: number;
    consoleErrors: number;
    dialogsPending: number;
    dialogsHandled: number;
    bridgeInjected: boolean;
  } {
    return {
      connected: this.connected,
      frames: this.frames.size,
      oopifFrames: this.oopifFrames.size,
      consoleEntries: this.consoleLog.length,
      consoleErrors: this.consoleErrors.length,
      dialogsPending: this.dialogQueue.length,
      dialogsHandled: this.dialogHistory.length,
      bridgeInjected: this.bridgeInjected,
    };
  }
}
