export class TerminalTimeline {
  static render(items: Array<{ title: string; detail?: string | null; status?: string }>): string {
    return items.map((item) => item.detail ? `${item.title}\n${item.detail}` : item.title).join('\n');
  }

  static print(items: Array<{ title: string; detail?: string | null }>): void {
    process.stdout.write(`${this.render(items)}\n`);
  }

  static renderToolEvent(toolName: string, argsSummary?: string, durationMs?: number, status: string = 'success'): string {
    const timing = durationMs !== undefined ? ` (${durationMs}ms)` : '';
    const args = argsSummary ? ` ${argsSummary}` : '';
    return `|- ${status === 'success' ? '✓' : '...'} Tool: ${toolName}${args}${timing}`;
  }

  static renderThinkingEvent(thoughtSummary: string, durationMs?: number, expanded: boolean = true): string {
    if (!expanded) {
      const durSec = durationMs !== undefined ? `${(durationMs / 1000).toFixed(1)}s` : '1.5s';
      return `+ Thought: ${durSec}`;
    }
    const timing = durationMs !== undefined ? ` (${durationMs}ms)` : '';
    return `|- 💭 Thinking: ${thoughtSummary}${timing}`;
  }

  static renderDiffSummary(filePath: string, additions: number, deletions: number): string {
    return `|- 📝 File: ${filePath} (+${additions} -${deletions})`;
  }
}
