import type { KanbanBoardState } from '../kanban/ZavorthKanbanBoardService.js';
import type { DiagramRenderResult } from '../diagram/ZavorthDiagramRendererService.js';
import type { DiffFileSummary } from '../diff/ZavorthDiffPagerService.js';
import type { SystemPowerStatus, PowerThrottlePolicy } from '../power/ZavorthSystemPowerService.js';

export type SupportedSurfaceKind =
  | 'CLI_TERMINAL'
  | 'WEB_DASHBOARD'
  | 'DISCORD_GATEWAY'
  | 'TELEGRAM_GATEWAY'
  | 'SLACK_GATEWAY'
  | 'DESKTOP_APP';

export interface SurfaceProjectionResult<T = unknown> {
  readonly surface: SupportedSurfaceKind;
  readonly format: 'ANSI_TEXT' | 'MARKDOWN' | 'STRUCTURED_JSON';
  readonly contentText?: string;
  readonly contentPayload?: T;
  readonly timestamp: number;
}

export class ZavorthSurfaceMatrixAdapterService {
  public projectKanbanBoard(
    board: KanbanBoardState,
    surface: SupportedSurfaceKind
  ): SurfaceProjectionResult {
    const timestamp = Date.now();

    if (surface === 'WEB_DASHBOARD' || surface === 'DESKTOP_APP') {
      return {
        surface,
        format: 'STRUCTURED_JSON',
        contentPayload: {
          totalTasks: board.totalTasks,
          activeSubagentsCount: board.activeSubagentsCount,
          totalTokensConsumed: board.totalTokensConsumed,
          columns: board.columns,
        },
        timestamp,
      };
    }

    if (surface === 'DISCORD_GATEWAY' || surface === 'TELEGRAM_GATEWAY' || surface === 'SLACK_GATEWAY') {
      const lines: string[] = [
        `**Zavorth Swarm Kanban Matrix** (${board.totalTasks} tasks, ${board.activeSubagentsCount} active workers)`,
        '---',
      ];

      const colKeys = Object.keys(board.columns) as Array<keyof typeof board.columns>;
      for (const col of colKeys) {
        const tasks = board.columns[col] || [];
        if (tasks.length > 0) {
          const colBadge = col === 'AUTO_REPAIR' ? '🚨 AUTO_REPAIR' : `📌 ${col}`;
          lines.push(`**${colBadge}** (${tasks.length}):`);
          for (const t of tasks.slice(0, 5)) {
            const priorityIcon = t.priority === 'URGENT' ? '🔥' : t.priority === 'HIGH' ? '⚡' : '●';
            const agentTag = t.assigneeSubagentId ? ` _[@${t.assigneeSubagentId}]_` : '';
            lines.push(`  • ${priorityIcon} \`[${t.id}]\` ${t.title}${agentTag}`);
          }
          if (tasks.length > 5) {
            lines.push(`  _... and ${tasks.length - 5} more tasks._`);
          }
        }
      }

      return {
        surface,
        format: 'MARKDOWN',
        contentText: lines.join('\n'),
        timestamp,
      };
    }

    // Default: CLI Terminal
    const { KanbanBoardTuiRenderer } = require('../../cli/components/KanbanBoardTuiView.js');
    const renderer = new KanbanBoardTuiRenderer();
    const rendered = renderer.render(board, {
      activeColumnIndex: 1,
      selectedTaskIndex: 0,
      terminalWidth: 100,
    });

    return {
      surface: 'CLI_TERMINAL',
      format: 'ANSI_TEXT',
      contentText: rendered,
      timestamp,
    };
  }

  public projectDiagram(
    diagramResult: DiagramRenderResult,
    surface: SupportedSurfaceKind
  ): SurfaceProjectionResult {
    const timestamp = Date.now();

    if (surface === 'WEB_DASHBOARD' || surface === 'DESKTOP_APP') {
      return {
        surface,
        format: 'STRUCTURED_JSON',
        contentPayload: {
          totalWidth: diagramResult.totalWidth,
          totalHeight: diagramResult.totalHeight,
          boxes: diagramResult.boxes,
          textOutput: diagramResult.textOutput,
        },
        timestamp,
      };
    }

    if (surface === 'DISCORD_GATEWAY' || surface === 'TELEGRAM_GATEWAY' || surface === 'SLACK_GATEWAY') {
      return {
        surface,
        format: 'MARKDOWN',
        contentText: `\`\`\`text\n${diagramResult.textOutput}\n\`\`\``,
        timestamp,
      };
    }

    return {
      surface: 'CLI_TERMINAL',
      format: 'ANSI_TEXT',
      contentText: diagramResult.textOutput,
      timestamp,
    };
  }

  public projectDiff(
    file: DiffFileSummary,
    surface: SupportedSurfaceKind
  ): SurfaceProjectionResult {
    const timestamp = Date.now();

    if (surface === 'WEB_DASHBOARD' || surface === 'DESKTOP_APP') {
      return {
        surface,
        format: 'STRUCTURED_JSON',
        contentPayload: file,
        timestamp,
      };
    }

    if (surface === 'DISCORD_GATEWAY' || surface === 'TELEGRAM_GATEWAY' || surface === 'SLACK_GATEWAY') {
      const riskBadge =
        file.overallRisk === 'CRITICAL' ? '🔴 CRITICAL RISK' : file.overallRisk === 'MEDIUM' ? '🟡 MEDIUM RISK' : '🟢 LOW RISK';
      const lines: string[] = [
        `**Diff Inspector**: \`${file.filePath}\` (${riskBadge}) | \`+${file.totalAdditions}\` \`-${file.totalDeletions}\``,
        '```diff',
      ];

      for (const hunk of file.hunks.slice(0, 3)) {
        lines.push(hunk.header);
        for (const l of hunk.lines.slice(0, 15)) {
          const prefix = l.type === 'addition' ? '+' : l.type === 'deletion' ? '-' : ' ';
          lines.push(`${prefix} ${l.content}`);
        }
      }
      lines.push('```');

      return {
        surface,
        format: 'MARKDOWN',
        contentText: lines.join('\n'),
        timestamp,
      };
    }

    const { DiffPagerModalRenderer } = require('../../cli/components/DiffPagerModal.js');
    const renderer = new DiffPagerModalRenderer();
    const rendered = renderer.render({
      file,
      topIndex: 0,
      viewportHeight: 25,
      selectedHunkIndex: 0,
    });

    return {
      surface: 'CLI_TERMINAL',
      format: 'ANSI_TEXT',
      contentText: rendered,
      timestamp,
    };
  }

  public projectPowerAndTelemetry(
    status: SystemPowerStatus,
    throttle: PowerThrottlePolicy,
    surface: SupportedSurfaceKind
  ): SurfaceProjectionResult {
    const timestamp = Date.now();

    if (surface === 'WEB_DASHBOARD' || surface === 'DESKTOP_APP') {
      return {
        surface,
        format: 'STRUCTURED_JSON',
        contentPayload: { power: status, throttle },
        timestamp,
      };
    }

    const powerIcon = status.powerSource === 'AC_POWER' ? '🔌 AC Power' : `🔋 Battery (${status.batteryPercent ?? 100}%)`;
    const throttleBadge = throttle.isThrottled ? `⚠️ Throttled (Max workers: ${throttle.maxConcurrentSubagents})` : '⚡ Full Performance';

    const text = `**System Power**: ${powerIcon} | **Policy**: ${throttleBadge}`;

    return {
      surface,
      format: surface === 'CLI_TERMINAL' ? 'ANSI_TEXT' : 'MARKDOWN',
      contentText: text,
      timestamp,
    };
  }
}
