import * as diff from 'diff';
import { TerminalTheme } from './TerminalTheme.js';

export interface DiffOptions {
  fileName?: string;
  contextLines?: number;
}

export class TerminalDiff {
  static render(oldStr: string, newStr: string, options: DiffOptions = {}): string {
    const { fileName = 'file', contextLines = 3 } = options;
    const patch = diff.createTwoFilesPatch(
      fileName,
      fileName,
      oldStr,
      newStr,
      'Old',
      'New',
      { context: contextLines }
    );

    const lines = patch.split('\n');
    const coloredLines = lines.map(line => {
      if (line.startsWith('+++') || line.startsWith('---')) {
        return TerminalTheme.colors.muted(line);
      }
      if (line.startsWith('@@')) {
        return TerminalTheme.colors.secondary(line);
      }
      if (line.startsWith('+')) {
        return TerminalTheme.colors.success(line);
      }
      if (line.startsWith('-')) {
        return TerminalTheme.colors.error(line);
      }
      return TerminalTheme.colors.dim(line);
    });

    return coloredLines.join('\n');
  }

  static print(oldStr: string, newStr: string, options: DiffOptions = {}): void {
    process.stdout.write(this.render(oldStr, newStr, options) + '\n');
  }
}
