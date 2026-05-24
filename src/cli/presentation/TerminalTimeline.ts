import { TerminalTheme } from './TerminalTheme.js';

export type TerminalTimelineStatus = 'pending' | 'running' | 'success' | 'warning' | 'error' | 'info';

export type TerminalTimelineItem = {
  title: string;
  detail?: string | null;
  status?: TerminalTimelineStatus;
};

export class TerminalTimeline {
  static render(items: TerminalTimelineItem[]): string {
    return items
      .map((item, index) => {
        const status = item.status || 'info';
        const marker = this.marker(status, index === items.length - 1);
        const title = this.paint(status, item.title);
        const detail = item.detail ? `\n  ${TerminalTheme.colors.dim(item.detail)}` : '';
        return `${marker} ${title}${detail}`;
      })
      .join('\n');
  }

  static print(items: TerminalTimelineItem[]): void {
    process.stdout.write(`${this.render(items)}\n`);
  }

  private static marker(status: TerminalTimelineStatus, isLast: boolean): string {
    const prefix = isLast ? '`-' : '|-';
    switch (status) {
      case 'success':
        return TerminalTheme.colors.success(`${prefix} ${TerminalTheme.symbols.check}`);
      case 'warning':
        return TerminalTheme.colors.warning(`${prefix} ${TerminalTheme.symbols.warning}`);
      case 'error':
        return TerminalTheme.colors.error(`${prefix} ${TerminalTheme.symbols.cross}`);
      case 'running':
        return TerminalTheme.colors.primary(`${prefix} ...`);
      case 'pending':
        return TerminalTheme.colors.dim(`${prefix} ...`);
      case 'info':
      default:
        return TerminalTheme.colors.secondary(`${prefix} ${TerminalTheme.symbols.info}`);
    }
  }

  private static paint(status: TerminalTimelineStatus, text: string): string {
    switch (status) {
      case 'success':
        return TerminalTheme.colors.success(text);
      case 'warning':
        return TerminalTheme.colors.warning(text);
      case 'error':
        return TerminalTheme.colors.error(text);
      case 'running':
        return TerminalTheme.colors.primary(text);
      case 'pending':
        return TerminalTheme.colors.dim(text);
      case 'info':
      default:
        return text;
    }
  }
}
