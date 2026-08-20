import * as crypto from 'node:crypto';

export type StagnationPatternType = 'edit_repeat' | 'command_retry' | 'action_streak' | 'doom_loop';

export interface StagnationTrigger {
  readonly patternType: StagnationPatternType;
  readonly severity: 'warning' | 'critical';
  readonly reason: string;
  readonly occurrences: number;
  readonly reflectionGuidance: string;
}

export interface EditActionRecord {
  readonly filePath: string;
  readonly contentSnippet: string;
  readonly timestamp: number;
}

export interface CommandActionRecord {
  readonly command: string;
  readonly exitCode: number;
  readonly timestamp: number;
}

export class StagnationAndLoopBreakerService {
  private readonly recentEdits: EditActionRecord[] = [];
  private readonly recentCommands: CommandActionRecord[] = [];
  private readonly recentToolCalls: string[] = [];

  private readonly maxEditHistory = 10;
  private readonly maxCommandHistory = 10;
  private readonly maxToolHistory = 15;

  public static computeShingles(text: string, n = 3): Set<string> {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const shingles = new Set<string>();
    if (normalized.length < n) {
      shingles.add(normalized);
      return shingles;
    }
    for (let i = 0; i <= normalized.length - n; i++) {
      shingles.add(normalized.slice(i, i + n));
    }
    return shingles;
  }

  public static computeShingleSimilarity(textA: string, textB: string): number {
    const setA = StagnationAndLoopBreakerService.computeShingles(textA);
    const setB = StagnationAndLoopBreakerService.computeShingles(textB);

    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersectionCount = 0;
    for (const item of setA) {
      if (setB.has(item)) {
        intersectionCount++;
      }
    }

    const unionSize = setA.size + setB.size - intersectionCount;
    return unionSize === 0 ? 1.0 : intersectionCount / unionSize;
  }

  public recordEdit(filePath: string, contentSnippet: string): StagnationTrigger | null {
    const record: EditActionRecord = {
      filePath,
      contentSnippet: contentSnippet.slice(0, 1000),
      timestamp: Date.now(),
    };

    const previousEditsSameFile = this.recentEdits.filter((e) => e.filePath === filePath);
    this.recentEdits.push(record);
    if (this.recentEdits.length > this.maxEditHistory) {
      this.recentEdits.shift();
    }

    if (previousEditsSameFile.length >= 2) {
      const last = previousEditsSameFile[previousEditsSameFile.length - 1];
      const similarity = StagnationAndLoopBreakerService.computeShingleSimilarity(
        last.contentSnippet,
        record.contentSnippet
      );

      if (similarity >= 0.6) {
        return {
          patternType: 'edit_repeat',
          severity: 'critical',
          occurrences: previousEditsSameFile.length + 1,
          reason: `Repeated near-identical edits (${Math.round(similarity * 100)}% similarity) detected on '${filePath}' without noticeable progress.`,
          reflectionGuidance: `You have attempted similar edits on '${filePath}' multiple times. STOP trying minor variations. Read the surrounding file context afresh or switch strategy.`,
        };
      }
    }

    return null;
  }

  public recordCommand(command: string, exitCode: number): StagnationTrigger | null {
    const normalizedCmd = command.trim();
    const record: CommandActionRecord = {
      command: normalizedCmd,
      exitCode,
      timestamp: Date.now(),
    };

    this.recentCommands.push(record);
    if (this.recentCommands.length > this.maxCommandHistory) {
      this.recentCommands.shift();
    }

    if (exitCode !== 0) {
      const consecutiveFailures = this.countConsecutiveSimilarCommandFailures(normalizedCmd);
      if (consecutiveFailures >= 3) {
        return {
          patternType: 'command_retry',
          severity: 'critical',
          occurrences: consecutiveFailures,
          reason: `Command '${normalizedCmd.slice(0, 60)}...' failed ${consecutiveFailures} times consecutively with exit code ${exitCode}.`,
          reflectionGuidance: `The command '${normalizedCmd.slice(0, 40)}' has failed ${consecutiveFailures} consecutive times. DO NOT rerun the same command without fixing the underlying root cause first.`,
        };
      }
    }

    return null;
  }

  public recordToolCall(toolName: string, argsSummary = ''): StagnationTrigger | null {
    const key = `${toolName}:${crypto.createHash('sha256').update(argsSummary).digest('hex').slice(0, 8)}`;
    this.recentToolCalls.push(key);
    if (this.recentToolCalls.length > this.maxToolHistory) {
      this.recentToolCalls.shift();
    }

    if (this.recentToolCalls.length >= 5) {
      const lastFive = this.recentToolCalls.slice(-5);
      const allIdentical = lastFive.every((k) => k === lastFive[0]);
      if (allIdentical) {
        return {
          patternType: 'doom_loop',
          severity: 'critical',
          occurrences: 5,
          reason: `Identical tool call '${toolName}' executed 5 consecutive times without parameter divergence.`,
          reflectionGuidance: `You are in a repetitive tool loop calling '${toolName}' with identical arguments. Pause, analyze the previous tool output, and choose a different tool or finalize.`,
        };
      }
    }

    return null;
  }

  public reset(): void {
    this.recentEdits.length = 0;
    this.recentCommands.length = 0;
    this.recentToolCalls.length = 0;
  }

  private countConsecutiveSimilarCommandFailures(currentCommand: string): number {
    let count = 0;
    for (let i = this.recentCommands.length - 1; i >= 0; i--) {
      const cmd = this.recentCommands[i];
      if (cmd.exitCode === 0) {
        break;
      }
      const similarity = StagnationAndLoopBreakerService.computeShingleSimilarity(
        cmd.command,
        currentCommand
      );
      const sameBase = this.isSameBaseCommand(cmd.command, currentCommand);
      if (similarity >= 0.6 || sameBase) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private isSameBaseCommand(cmdA: string, cmdB: string): boolean {
    const baseA = cmdA.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
    const baseB = cmdB.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
    return baseA === baseB && baseA.length > 0;
  }
}
