export interface DiffHunkLine {
  readonly type: 'add' | 'delete' | 'context';
  readonly content: string;
  readonly oldLineNumber?: number;
  readonly newLineNumber?: number;
}

export interface DiffHunk {
  readonly header: string;
  readonly lines: readonly DiffHunkLine[];
}

export interface ParsedFileDiff {
  readonly oldPath: string;
  readonly newPath: string;
  readonly hunks: readonly DiffHunk[];
}

export class TerminalDiffViewerComponent {
  private static readonly COLOR_GREEN = '\x1b[32m';
  private static readonly COLOR_RED = '\x1b[31m';
  private static readonly COLOR_CYAN = '\x1b[36m';
  private static readonly COLOR_DIM = '\x1b[2m';
  private static readonly COLOR_BOLD = '\x1b[1m';
  private static readonly RESET = '\x1b[0m';

  public render(diffText: string, terminalWidth = 100, forceMode?: 'unified' | 'split'): string {
    const parsed = this.parseUnifiedDiff(diffText);
    if (parsed.length === 0) {
      return diffText.trim();
    }

    const mode = forceMode || (terminalWidth >= 120 ? 'split' : 'unified');

    if (mode === 'split') {
      return this.renderSplitDiff(parsed, terminalWidth);
    }

    return this.renderUnifiedDiff(parsed);
  }

  public parseUnifiedDiff(rawDiff: string): readonly ParsedFileDiff[] {
    const fileDiffs: ParsedFileDiff[] = [];
    const lines = rawDiff.split(/\r?\n/);

    let currentOldPath = '';
    let currentNewPath = '';
    const currentHunks: DiffHunk[] = [];
    let currentHunkLines: DiffHunkLine[] = [];
    let currentHunkHeader = '';
    let oldLineCounter = 1;
    let newLineCounter = 1;

    for (const line of lines) {
      if (line.startsWith('--- ')) {
        currentOldPath = line.slice(4).replace(/^[ab]\//, '');
        continue;
      }
      if (line.startsWith('+++ ')) {
        currentNewPath = line.slice(4).replace(/^[ab]\//, '');
        continue;
      }
      if (line.startsWith('@@ ')) {
        if (currentHunkLines.length > 0) {
          currentHunks.push({ header: currentHunkHeader, lines: currentHunkLines });
          currentHunkLines = [];
        }
        currentHunkHeader = line;

        const match = line.match(/@@\s*-(\d+)(?:,\d+)?\s*\+(\d+)(?:,\d+)?\s*@@/);
        if (match) {
          oldLineCounter = parseInt(match[1], 10);
          newLineCounter = parseInt(match[2], 10);
        }
        continue;
      }

      if (!currentHunkHeader) {
        continue;
      }

      if (line.startsWith('+')) {
        currentHunkLines.push({
          type: 'add',
          content: line.slice(1),
          newLineNumber: newLineCounter++,
        });
      } else if (line.startsWith('-')) {
        currentHunkLines.push({
          type: 'delete',
          content: line.slice(1),
          oldLineNumber: oldLineCounter++,
        });
      } else if (line.startsWith(' ') || line === '') {
        currentHunkLines.push({
          type: 'context',
          content: line.startsWith(' ') ? line.slice(1) : line,
          oldLineNumber: oldLineCounter++,
          newLineNumber: newLineCounter++,
        });
      }
    }

    if (currentHunkLines.length > 0) {
      currentHunks.push({ header: currentHunkHeader, lines: currentHunkLines });
    }

    if (currentOldPath || currentNewPath || currentHunks.length > 0) {
      fileDiffs.push({
        oldPath: currentOldPath || 'unknown',
        newPath: currentNewPath || 'unknown',
        hunks: currentHunks,
      });
    }

    return fileDiffs;
  }

  public renderUnifiedDiff(diffs: readonly ParsedFileDiff[]): string {
    const out: string[] = [];

    for (const diff of diffs) {
      out.push(`${TerminalDiffViewerComponent.COLOR_BOLD}diff: ${diff.oldPath} -> ${diff.newPath}${TerminalDiffViewerComponent.RESET}`);

      for (const hunk of diff.hunks) {
        out.push(`${TerminalDiffViewerComponent.COLOR_CYAN}${hunk.header}${TerminalDiffViewerComponent.RESET}`);

        for (const line of hunk.lines) {
          if (line.type === 'add') {
            const num = String(line.newLineNumber || '').padStart(4);
            out.push(`${TerminalDiffViewerComponent.COLOR_DIM}${num} ${TerminalDiffViewerComponent.COLOR_GREEN}+ ${line.content}${TerminalDiffViewerComponent.RESET}`);
          } else if (line.type === 'delete') {
            const num = String(line.oldLineNumber || '').padStart(4);
            out.push(`${TerminalDiffViewerComponent.COLOR_DIM}${num} ${TerminalDiffViewerComponent.COLOR_RED}- ${line.content}${TerminalDiffViewerComponent.RESET}`);
          } else {
            const num = String(line.newLineNumber || '').padStart(4);
            out.push(`${TerminalDiffViewerComponent.COLOR_DIM}${num}   ${line.content}${TerminalDiffViewerComponent.RESET}`);
          }
        }
      }
    }

    return out.join('\n');
  }

  public renderSplitDiff(diffs: readonly ParsedFileDiff[], terminalWidth: number): string {
    const out: string[] = [];
    const colWidth = Math.max(30, Math.floor((terminalWidth - 7) / 2));

    for (const diff of diffs) {
      const headerTitle = `=== ${diff.oldPath} (left) │ ${diff.newPath} (right) ===`;
      out.push(`${TerminalDiffViewerComponent.COLOR_BOLD}${TerminalDiffViewerComponent.COLOR_CYAN}${headerTitle}${TerminalDiffViewerComponent.RESET}`);

      for (const hunk of diff.hunks) {
        out.push(`${TerminalDiffViewerComponent.COLOR_DIM}${hunk.header}${TerminalDiffViewerComponent.RESET}`);

        // Pair delete and add lines side-by-side
        let i = 0;
        while (i < hunk.lines.length) {
          const line = hunk.lines[i];

          if (line.type === 'delete') {
            const nextLine = hunk.lines[i + 1];
            if (nextLine && nextLine.type === 'add') {
              // Paired modification (left = delete, right = add)
              const left = this.formatCol(line.oldLineNumber, '-', line.content, colWidth, TerminalDiffViewerComponent.COLOR_RED);
              const right = this.formatCol(nextLine.newLineNumber, '+', nextLine.content, colWidth, TerminalDiffViewerComponent.COLOR_GREEN);
              out.push(`${left} │ ${right}`);
              i += 2;
              continue;
            }

            const left = this.formatCol(line.oldLineNumber, '-', line.content, colWidth, TerminalDiffViewerComponent.COLOR_RED);
            const right = ' '.repeat(colWidth);
            out.push(`${left} │ ${right}`);
            i++;
            continue;
          }

          if (line.type === 'add') {
            const left = ' '.repeat(colWidth);
            const right = this.formatCol(line.newLineNumber, '+', line.content, colWidth, TerminalDiffViewerComponent.COLOR_GREEN);
            out.push(`${left} │ ${right}`);
            i++;
            continue;
          }

          // Context line
          const left = this.formatCol(line.oldLineNumber, ' ', line.content, colWidth, '');
          const right = this.formatCol(line.newLineNumber, ' ', line.content, colWidth, '');
          out.push(`${left} │ ${right}`);
          i++;
        }
      }
    }

    return out.join('\n');
  }

  private formatCol(
    lineNum: number | undefined,
    marker: string,
    content: string,
    width: number,
    colorCode: string
  ): string {
    const numStr = String(lineNum || '').padStart(4);
    const prefix = `${numStr} ${marker} `;
    const maxContentLen = Math.max(0, width - prefix.length);
    const truncatedContent = content.length > maxContentLen ? `${content.slice(0, maxContentLen - 1)}…` : content;
    const padded = (prefix + truncatedContent).padEnd(width);

    return colorCode ? `${colorCode}${padded}${TerminalDiffViewerComponent.RESET}` : padded;
  }
}
