import {
  ZavorthDiffPagerService,
  type DiffFileSummary,
  type DiffHunk,
} from '../../services/diff/ZavorthDiffPagerService.js';
import { ZavorthEditorBridgeService, type SupportedEditor } from '../../services/editor/ZavorthEditorBridgeService.js';

export interface DiffPagerModalRenderOptions {
  readonly file: DiffFileSummary;
  readonly topIndex: number;
  readonly viewportHeight: number;
  readonly selectedHunkIndex: number;
  readonly preferredEditor?: SupportedEditor;
}

export class DiffPagerModalRenderer {
  private pagerService = new ZavorthDiffPagerService();
  private editorService = new ZavorthEditorBridgeService();

  public render(options: DiffPagerModalRenderOptions): string {
    const { file, topIndex, viewportHeight, selectedHunkIndex } = options;
    const lines: string[] = [];

    const riskColor =
      file.overallRisk === 'CRITICAL'
        ? '\x1b[41;97;1m CRITICAL RISK \x1b[0m'
        : file.overallRisk === 'MEDIUM'
        ? '\x1b[43;30;1m MEDIUM RISK \x1b[0m'
        : '\x1b[42;30;1m LOW RISK \x1b[0m';

    lines.push(`┌─ \x1b[1mDiff Inspector\x1b[0m: \x1b[36m${file.filePath}\x1b[0m (${riskColor}) \x1b[32m+${file.totalAdditions}\x1b[0m \x1b[31m-${file.totalDeletions}\x1b[0m`);
    lines.push('├' + '─'.repeat(78));

    const renderedHunkLines: string[] = [];

    for (let hIdx = 0; hIdx < file.hunks.length; hIdx++) {
      const hunk = file.hunks[hIdx];
      const isSelected = hIdx === selectedHunkIndex;
      const stageBadge = hunk.isStaged ? '\x1b[32m[✓ Staged]\x1b[0m' : '\x1b[31m[✗ Skipped]\x1b[0m';
      const foldBadge = hunk.isCollapsed ? '\x1b[33m[Folded]\x1b[0m' : '\x1b[90m[Expanded]\x1b[0m';
      const selector = isSelected ? '\x1b[36;1m▶\x1b[0m ' : '  ';

      renderedHunkLines.push(`${selector}\x1b[35m${hunk.header}\x1b[0m ${stageBadge} ${foldBadge}`);

      if (!hunk.isCollapsed) {
        for (const line of hunk.lines) {
          if (line.type === 'addition') {
            const lineNum = String(line.newLineNumber ?? '').padStart(4, ' ');
            renderedHunkLines.push(`   \x1b[90m${lineNum}\x1b[0m \x1b[32m+ ${line.content}\x1b[0m`);
          } else if (line.type === 'deletion') {
            const lineNum = String(line.oldLineNumber ?? '').padStart(4, ' ');
            renderedHunkLines.push(`   \x1b[90m${lineNum}\x1b[0m \x1b[31m- ${line.content}\x1b[0m`);
          } else {
            const lineNum = String(line.newLineNumber ?? line.oldLineNumber ?? '').padStart(4, ' ');
            renderedHunkLines.push(`   \x1b[90m${lineNum}\x1b[0m \x1b[90m  ${line.content}\x1b[0m`);
          }
        }
      }
    }

    const { visibleItems, total } = this.pagerService.computeVisibleSlice(
      renderedHunkLines,
      topIndex,
      viewportHeight
    );

    for (const vLine of visibleItems) {
      lines.push(`│ ${vLine}`);
    }

    const scrollPercentage = total > 0 ? Math.round(((topIndex + 1) / Math.max(1, total)) * 100) : 100;
    lines.push('├' + '─'.repeat(78));
    lines.push(
      `│ \x1b[90m[j/k] Scroll (${scrollPercentage}%) | [s] Stage Hunk | [f] Fold | [?] AI Explain | [o] Open in Editor | [a] Approve | [d] Deny\x1b[0m`
    );
    lines.push('└' + '─'.repeat(78));

    return lines.join('\n');
  }

  public getEditorShortcutCommand(filePath: string, hunk?: DiffHunk, editor: SupportedEditor = 'vscode'): string {
    const line = hunk ? hunk.newStart : 1;
    const launch = this.editorService.generateLaunchCommand(
      {
        absoluteFilePath: filePath,
        lineNumber: line,
      },
      editor
    );
    return `${launch.cliExecutable} ${launch.cliArgs.join(' ')}`;
  }
}
