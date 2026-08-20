export interface FilteredOutputResult {
  readonly text: string;
  readonly originalLength: number;
  readonly filteredLength: number;
  readonly estimatedTokensSaved: number;
}

export interface OutputFilterOptions {
  readonly maxLines?: number;
  readonly condenseTests?: boolean;
  readonly condenseLockfiles?: boolean;
  readonly maxLineLength?: number;
}

export class TokenEfficientOutputFilterService {
  private static readonly ANSI_REGEX =
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

  private static readonly PROGRESS_LINE_REGEX =
    /(?:\[\s*\d+\s*\/\s*\d+\s*\]|\[[=>\-\s]+\]\s*\d+%|⸨[░▒▓█\s]+⸩|fetchMetadata:\s*sill|npm\s+(?:verb|sill|info)\s+)/i;

  public static stripAnsi(text: string): string {
    return text.replace(TokenEfficientOutputFilterService.ANSI_REGEX, '');
  }

  public filter(rawOutput: string, options: OutputFilterOptions = {}): FilteredOutputResult {
    const originalLength = rawOutput.length;
    let clean = TokenEfficientOutputFilterService.stripAnsi(rawOutput);

    // Normalize carriage returns from spinners
    clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    let lines = clean.split('\n');

    // 1. Remove build spinner and repetitive progress lines
    lines = lines.filter((line) => !TokenEfficientOutputFilterService.PROGRESS_LINE_REGEX.test(line));

    // 2. Condense test runner results if present
    if (options.condenseTests !== false && this.isTestRunnerOutput(clean)) {
      lines = this.condenseTestOutputLines(lines);
    }

    // 3. Condense lockfile or giant diff noise
    if (options.condenseLockfiles !== false) {
      lines = this.condenseLockfileDiffLines(lines);
    }

    // 4. Truncate extra long individual lines
    const maxLineLen = options.maxLineLength || 500;
    lines = lines.map((line) =>
      line.length > maxLineLen ? `${line.slice(0, maxLineLen)}... [line truncated]` : line
    );

    // 5. Cap total lines if maxLines is set
    const maxLines = options.maxLines || 400;
    if (lines.length > maxLines) {
      const headCount = Math.floor(maxLines * 0.4);
      const tailCount = Math.floor(maxLines * 0.6);
      const omitted = lines.length - headCount - tailCount;
      lines = [
        ...lines.slice(0, headCount),
        `\n[... ${omitted} output lines condensed for token efficiency ...]\n`,
        ...lines.slice(-tailCount),
      ];
    }

    const filteredText = lines.join('\n').trim();
    const filteredLength = filteredText.length;
    const estimatedTokensSaved = Math.max(0, Math.round((originalLength - filteredLength) / 4));

    return {
      text: filteredText,
      originalLength,
      filteredLength,
      estimatedTokensSaved,
    };
  }

  private isTestRunnerOutput(text: string): boolean {
    return (
      text.includes('PASS ') ||
      text.includes('FAIL ') ||
      text.includes('Test Suites:') ||
      text.includes('Tests:') ||
      text.includes('=== RUN ')
    );
  }

  private condenseTestOutputLines(lines: readonly string[]): string[] {
    const result: string[] = [];
    let skippingPassingTests = false;

    for (const line of lines) {
      const trimmed = line.trim();
      // Keep summary lines and failure details
      if (
        trimmed.startsWith('FAIL ') ||
        trimmed.includes('● ') ||
        trimmed.includes('Error:') ||
        trimmed.includes('Test Suites:') ||
        trimmed.includes('Tests:') ||
        trimmed.includes('Snapshots:') ||
        trimmed.includes('Time:') ||
        trimmed.includes('Ran all test suites')
      ) {
        skippingPassingTests = false;
        result.push(line);
      } else if (trimmed.startsWith('PASS ')) {
        if (!skippingPassingTests) {
          result.push('[... passing test suites omitted ...]');
          skippingPassingTests = true;
        }
      } else if (!skippingPassingTests) {
        result.push(line);
      }
    }

    return result;
  }

  private condenseLockfileDiffLines(lines: readonly string[]): string[] {
    const result: string[] = [];
    let insideLockfileDiff = false;
    let lockfileLineCount = 0;

    for (const line of lines) {
      if (
        line.includes('package-lock.json') ||
        line.includes('pnpm-lock.yaml') ||
        line.includes('bun.lock') ||
        line.includes('Cargo.lock')
      ) {
        insideLockfileDiff = true;
        lockfileLineCount = 0;
        result.push(line);
        continue;
      }

      if (insideLockfileDiff) {
        lockfileLineCount++;
        if (line.startsWith('diff --git') || line.startsWith('+++ ') || lockfileLineCount > 10) {
          result.push(`  [... ${lockfileLineCount} lockfile changes condensed ...]`);
          insideLockfileDiff = false;
        }
      } else {
        result.push(line);
      }
    }

    return result;
  }
}
