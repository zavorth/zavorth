export class Terminal {
  private element: HTMLElement | null = null;
  public options: Record<string, unknown> = {};

  public constructor(options: Record<string, unknown> = {}) {
    this.options = options;
  }

  public open(element: HTMLElement): void {
    this.element = element;
    if (element) {
      element.innerHTML = '<div class="zvd-terminal-viewport" style="padding: 8px; font-family: monospace; font-size: 12px; color: #c9d1d9; background: #0d1117; height: 100%;">Zavorth Terminal Shell Ready</div>';
    }
  }

  public loadAddon(_addon: unknown): void {}

  public write(data: string): void {
    if (this.element) {
      const line = document.createElement('div');
      line.textContent = data;
      this.element.appendChild(line);
    }
  }

  public onData(_handler: (data: string) => void): { dispose: () => void } {
    return { dispose: () => {} };
  }

  public onKey(_handler: (e: { key: string }) => void): { dispose: () => void } {
    return { dispose: () => {} };
  }

  public focus(): void {}

  public blur(): void {}

  public clear(): void {
    if (this.element) {
      this.element.innerHTML = '';
    }
  }

  public dispose(): void {
    if (this.element) {
      this.element.innerHTML = '';
      this.element = null;
    }
  }
}

export class FitAddon {
  public fit(): void {}
}

export class Unicode11Addon {}

export default {
  Terminal,
  FitAddon,
  Unicode11Addon,
};
