export type HunkLineType = 'context' | 'addition' | 'deletion' | 'header';

export interface HunkLine {
  readonly type: HunkLineType;
  readonly content: string;
  readonly oldLineNumber?: number;
  readonly newLineNumber?: number;
}

export interface DiffHunk {
  readonly id: string;
  readonly header: string;
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly HunkLine[];
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'CRITICAL';
  readonly riskReasons: readonly string[];
  readonly isStaged: boolean;
  readonly isCollapsed: boolean;
}

export interface DiffFileSummary {
  readonly filePath: string;
  readonly oldPath?: string;
  readonly isNewFile: boolean;
  readonly isDeletedFile: boolean;
  readonly hunks: readonly DiffHunk[];
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly overallRisk: 'LOW' | 'MEDIUM' | 'CRITICAL';
}

export interface PagerViewportState {
  readonly topVisibleIndex: number;
  readonly visibleLineCount: number;
  readonly selectedHunkIndex: number;
  readonly selectedLineIndex: number;
  readonly searchQuery?: string;
  readonly matchedLineIndices: readonly number[];
}

export class ZavorthDiffPagerService {
  public parseUnifiedDiff(rawDiff: string): readonly DiffFileSummary[] {
    if (!rawDiff || rawDiff.trim().length === 0) {
      return [];
    }

    const lines = rawDiff.split(/\r?\n/);
    const files: DiffFileSummary[] = [];

    let currentFilePath = '';
    let currentOldPath: string | undefined;
    let isNewFile = false;
    let isDeletedFile = false;
    let currentHunks: DiffHunk[] = [];
    let currentHunkLines: HunkLine[] = [];
    let currentHunkHeader = '';
    let hunkOldStart = 0;
    let hunkOldLines = 0;
    let hunkNewStart = 0;
    let hunkNewLines = 0;
    let hunkCounter = 0;

    const flushHunk = () => {
      if (currentHunkHeader && currentHunkLines.length > 0) {
        const risk = this.calculateHunkRisk(currentFilePath, currentHunkLines);
        currentHunks.push({
          id: `hunk-${hunkCounter++}`,
          header: currentHunkHeader,
          oldStart: hunkOldStart,
          oldLines: hunkOldLines,
          newStart: hunkNewStart,
          newLines: hunkNewLines,
          lines: [...currentHunkLines],
          riskLevel: risk.level,
          riskReasons: risk.reasons,
          isStaged: true,
          isCollapsed: false,
        });
        currentHunkLines = [];
        currentHunkHeader = '';
      }
    };

    const flushFile = () => {
      flushHunk();
      if (currentFilePath || currentHunks.length > 0) {
        let totalAdditions = 0;
        let totalDeletions = 0;
        let highestRisk: 'LOW' | 'MEDIUM' | 'CRITICAL' = 'LOW';

        for (const hunk of currentHunks) {
          for (const line of hunk.lines) {
            if (line.type === 'addition') totalAdditions++;
            if (line.type === 'deletion') totalDeletions++;
          }
          if (hunk.riskLevel === 'CRITICAL') highestRisk = 'CRITICAL';
          else if (hunk.riskLevel === 'MEDIUM' && highestRisk !== 'CRITICAL') highestRisk = 'MEDIUM';
        }

        files.push({
          filePath: currentFilePath || 'unknown_file',
          oldPath: currentOldPath,
          isNewFile,
          isDeletedFile,
          hunks: [...currentHunks],
          totalAdditions,
          totalDeletions,
          overallRisk: highestRisk,
        });

        currentFilePath = '';
        currentOldPath = undefined;
        isNewFile = false;
        isDeletedFile = false;
        currentHunks = [];
        hunkCounter = 0;
      }
    };

    let oldLineCursor = 0;
    let newLineCursor = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('diff --git ')) {
        flushFile();
        const parts = line.split(' ');
        if (parts.length >= 4) {
          currentOldPath = parts[2].replace(/^a\//, '');
          currentFilePath = parts[3].replace(/^b\//, '');
        }
      } else if (line.startsWith('new file mode ')) {
        isNewFile = true;
      } else if (line.startsWith('deleted file mode ')) {
        isDeletedFile = true;
      } else if (line.startsWith('--- ')) {
        if (!currentOldPath) {
          currentOldPath = line.substring(4).replace(/^a\//, '');
        }
      } else if (line.startsWith('+++ ')) {
        currentFilePath = line.substring(4).replace(/^b\//, '');
      } else if (line.startsWith('@@ ')) {
        flushHunk();
        currentHunkHeader = line;
        const parsedCoordinates = this.parseHunkCoordinates(line);
        hunkOldStart = parsedCoordinates.oldStart;
        hunkOldLines = parsedCoordinates.oldLines;
        hunkNewStart = parsedCoordinates.newStart;
        hunkNewLines = parsedCoordinates.newLines;
        oldLineCursor = hunkOldStart;
        newLineCursor = hunkNewStart;
      } else if (currentHunkHeader) {
        if (line.startsWith('+')) {
          currentHunkLines.push({
            type: 'addition',
            content: line.substring(1),
            newLineNumber: newLineCursor++,
          });
        } else if (line.startsWith('-')) {
          currentHunkLines.push({
            type: 'deletion',
            content: line.substring(1),
            oldLineNumber: oldLineCursor++,
          });
        } else if (line.startsWith(' ') || line.length === 0) {
          currentHunkLines.push({
            type: 'context',
            content: line.startsWith(' ') ? line.substring(1) : line,
            oldLineNumber: oldLineCursor++,
            newLineNumber: newLineCursor++,
          });
        }
      }
    }

    flushFile();
    return files;
  }

  private parseHunkCoordinates(header: string): {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
  } {
    let oldStart = 1;
    let oldLines = 1;
    let newStart = 1;
    let newLines = 1;

    const firstAt = header.indexOf('@@');
    const secondAt = header.indexOf('@@', firstAt + 2);

    if (firstAt >= 0 && secondAt > firstAt) {
      const inner = header.substring(firstAt + 2, secondAt).trim();
      const tokens = inner.split(' ').filter(Boolean);

      for (const token of tokens) {
        if (token.startsWith('-')) {
          const parts = token.substring(1).split(',');
          oldStart = parseInt(parts[0], 10) || 1;
          oldLines = parts[1] ? parseInt(parts[1], 10) || 1 : 1;
        } else if (token.startsWith('+')) {
          const parts = token.substring(1).split(',');
          newStart = parseInt(parts[0], 10) || 1;
          newLines = parts[1] ? parseInt(parts[1], 10) || 1 : 1;
        }
      }
    }

    return { oldStart, oldLines, newStart, newLines };
  }

  public calculateHunkRisk(
    filePath: string,
    lines: readonly HunkLine[]
  ): { level: 'LOW' | 'MEDIUM' | 'CRITICAL'; reasons: string[] } {
    const reasons: string[] = [];
    let isCritical = false;
    let isMedium = false;

    const normalizedPath = filePath.toLowerCase();
    if (normalizedPath.includes('.env') || normalizedPath.includes('secret') || normalizedPath.includes('key')) {
      reasons.push('Security-sensitive configuration file modification');
      isCritical = true;
    }

    let deletionCount = 0;
    

    for (const line of lines) {
      if (line.type === 'deletion') {
        deletionCount++;
        const content = line.content.trim();
        if (content.startsWith('export ') || content.includes('function ') || content.includes('interface ')) {
          reasons.push('Possible public API contract signature removal');
          isMedium = true;
        }
      } else if (line.type === 'addition') {
        const content = line.content.trim();
        if (content.includes('password') || content.includes('api_key') || content.includes('token =')) {
          reasons.push('Potential hardcoded credential or secret added');
          isCritical = true;
        }
      }
    }

    if (deletionCount > 100) {
      reasons.push(`Massive code deletion block (${deletionCount} lines deleted)`);
      isMedium = true;
    }

    if (isCritical) {
      return { level: 'CRITICAL', reasons };
    }
    if (isMedium) {
      return { level: 'MEDIUM', reasons };
    }
    return { level: 'LOW', reasons: ['Safe localized modification'] };
  }

  public toggleHunkStaging(file: DiffFileSummary, hunkId: string): DiffFileSummary {
    const updatedHunks = file.hunks.map((hunk) => {
      if (hunk.id === hunkId) {
        return {
          ...hunk,
          isStaged: !hunk.isStaged,
        };
      }
      return hunk;
    });

    return {
      ...file,
      hunks: updatedHunks,
    };
  }

  public toggleHunkCollapse(file: DiffFileSummary, hunkId: string): DiffFileSummary {
    const updatedHunks = file.hunks.map((hunk) => {
      if (hunk.id === hunkId) {
        return {
          ...hunk,
          isCollapsed: !hunk.isCollapsed,
        };
      }
      return hunk;
    });

    return {
      ...file,
      hunks: updatedHunks,
    };
  }

  public generateExplainPrompt(filePath: string, hunk: DiffHunk): string {
    const diffSlice = hunk.lines
      .map((l) => {
        const prefix = l.type === 'addition' ? '+' : l.type === 'deletion' ? '-' : ' ';
        return `${prefix} ${l.content}`;
      })
      .join('\n');

    return `Please provide a concise 2-line explanation in plain language explaining the purpose and architectural consequence of this code change in "${filePath}":\n\n\`\`\`diff\n${hunk.header}\n${diffSlice}\n\`\`\``;
  }

  public computeVisibleSlice<T>(
    items: readonly T[],
    topIndex: number,
    visibleCount: number
  ): { visibleItems: readonly T[]; total: number; maxTopIndex: number } {
    const total = items.length;
    const maxTopIndex = Math.max(0, total - visibleCount);
    const clampedTop = Math.max(0, Math.min(topIndex, maxTopIndex));
    const visibleItems = items.slice(clampedTop, clampedTop + visibleCount);

    return {
      visibleItems,
      total,
      maxTopIndex,
    };
  }
}
