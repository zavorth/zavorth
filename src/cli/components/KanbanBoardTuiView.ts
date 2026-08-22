import {
  type KanbanBoardState,
  type KanbanColumnId,
} from '../../services/kanban/ZavorthKanbanBoardService.js';

export interface KanbanTuiViewOptions {
  readonly activeColumnIndex: number;
  readonly selectedTaskIndex: number;
  readonly terminalWidth?: number;
}

export class KanbanBoardTuiRenderer {
  private readonly columnsOrder: readonly KanbanColumnId[] = [
    'TODO',
    'READY',
    'RUNNING',
    'REVIEW',
    'AUTO_REPAIR',
    'DONE',
  ];

  public render(board: KanbanBoardState, options: KanbanTuiViewOptions): string {
    const { activeColumnIndex, selectedTaskIndex, terminalWidth = 100 } = options;
    const lines: string[] = [];

    lines.push(
      `┌─ \x1b[1mZavorth Swarm Matrix (Kanban)\x1b[0m ─ \x1b[36m${board.totalTasks} Tasks\x1b[0m │ \x1b[32m${board.activeSubagentsCount} Subagents Active\x1b[0m │ \x1b[33m${board.totalTokensConsumed} Tokens\x1b[0m`
    );
    lines.push('├' + '─'.repeat(Math.max(60, terminalWidth - 2)));

    const colWidth = Math.max(16, Math.floor((terminalWidth - 8) / this.columnsOrder.length));
    const headerRow = this.columnsOrder
      .map((col, idx) => {
        const isCurrent = idx === activeColumnIndex;
        const count = board.columns[col]?.length || 0;
        const colTitle = `${col} (${count})`;
        const padded = colTitle.padEnd(colWidth - 2, ' ');
        if (isCurrent) {
          return `\x1b[30;46;1m ${padded} \x1b[0m`;
        }
        if (col === 'AUTO_REPAIR') {
          return `\x1b[31;1m ${padded} \x1b[0m`;
        }
        return `\x1b[1m ${padded} \x1b[0m`;
      })
      .join('│');

    lines.push(`│${headerRow}│`);
    lines.push('├' + '─'.repeat(Math.max(60, terminalWidth - 2)));

    const maxColTasks = Math.max(
      1,
      ...this.columnsOrder.map((col) => board.columns[col]?.length || 0)
    );

    for (let row = 0; row < maxColTasks; row++) {
      const rowCells = this.columnsOrder.map((col, colIdx) => {
        const tasks = board.columns[col] || [];
        const task = tasks[row];

        if (!task) {
          return ' '.repeat(colWidth);
        }

        const isSelected = colIdx === activeColumnIndex && row === selectedTaskIndex;
        const priorityIcon =
          task.priority === 'URGENT'
            ? '🔥'
            : task.priority === 'HIGH'
            ? '⚡'
            : task.priority === 'MEDIUM'
            ? '●'
            : '○';

        const titleTruncated = task.title.length > colWidth - 5
          ? task.title.substring(0, colWidth - 6) + '…'
          : task.title.padEnd(colWidth - 5, ' ');

        const cardText = `${priorityIcon} ${titleTruncated}`;
        if (isSelected) {
          return `\x1b[30;47m▶${cardText}\x1b[0m`;
        }
        if (task.column === 'AUTO_REPAIR') {
          return `\x1b[31m ${cardText}\x1b[0m`;
        }
        if (task.assigneeSubagentId) {
          return `\x1b[32m ${cardText}\x1b[0m`;
        }
        return ` ${cardText}`;
      });

      lines.push(`│${rowCells.join('│')}│`);
    }

    lines.push('├' + '─'.repeat(Math.max(60, terminalWidth - 2)));
    lines.push(
      `│ \x1b[90m[←/→] Switch Column | [↑/↓] Select Task | [Space] Assign Subagent | [r] Auto-Repair | [Enter] Task Details\x1b[0m`
    );
    lines.push('└' + '─'.repeat(Math.max(60, terminalWidth - 2)));

    return lines.join('\n');
  }
}
