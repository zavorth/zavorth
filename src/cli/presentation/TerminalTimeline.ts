/**
 * Zavorth Terminal Timeline Renderer.
 * Renders structured timeline events for agent thinking, tool executions,
 * diff summaries, and execution status using Zavorth's visual theme.
 */

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

  /**
   * Formats a tool execution event line with duration and status marker.
   */
  static renderToolEvent(toolName: string, argsSummary?: string, durationMs?: number, status: TerminalTimelineStatus = 'success'): string {
    const timing = durationMs !== undefined ? ` ${TerminalTheme.colors.dim(`(${durationMs}ms)`)}` : '';
    const args = argsSummary ? ` ${TerminalTheme.colors.dim(argsSummary)}` : '';
    const marker = status === 'success' ? TerminalTheme.symbols.check : status === 'running' ? '...' : TerminalTheme.symbols.cross;
    const colorFn = status === 'success' ? TerminalTheme.colors.success : status === 'running' ? TerminalTheme.colors.primary : TerminalTheme.colors.error;

    return `${colorFn(`|- ${marker} Tool: ${toolName}`)}${args}${timing}`;
  }

  /**
   * Formats a thinking/reasoning event line with duration.
   */
  static renderThinkingEvent(thoughtSummary: string, durationMs?: number): string {
    const timing = durationMs !== undefined ? ` ${TerminalTheme.colors.dim(`(${durationMs}ms)`)}` : '';
    return `${TerminalTheme.colors.primary(`|- 💭 Thinking: `)}${TerminalTheme.colors.dim(thoughtSummary)}${timing}`;
  }

  /**
   * Formats a file diff summary event line.
   */
  static renderDiffSummary(filePath: string, additions: number, deletions: number): string {
    const adds = TerminalTheme.colors.success(`+${additions}`);
    const dels = TerminalTheme.colors.error(`-${deletions}`);
    return `${TerminalTheme.colors.primary(`|- 📝 File: `)}${filePath} (${adds} ${dels})`;
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
