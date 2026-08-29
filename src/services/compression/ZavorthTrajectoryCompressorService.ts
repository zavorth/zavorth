export type TrajectoryTurnRole = 'system' | 'user' | 'assistant' | 'tool';

export interface TrajectoryToolCallRecord {
  readonly toolName: string;
  readonly inputPayload: string;
  readonly outputPayload: string;
  readonly exitCode?: number;
  readonly durationMs?: number;
  readonly toolCallId?: string;
}

export interface TrajectoryTurn {
  readonly id: string;
  readonly role: TrajectoryTurnRole;
  readonly content: string;
  readonly toolCalls?: readonly TrajectoryToolCallRecord[];
  readonly estimatedTokens: number;
  readonly isProtectedAnchor?: boolean;
}

export interface TrajectoryCompressionConfig {
  readonly targetTokenBudget: number;
  readonly protectedHeadTurnsCount?: number;
  readonly protectedTailTurnsCount?: number;
  readonly maxSummaryTokensPerTurn?: number;
}

export interface CompressionResult {
  readonly originalTotalTokens: number;
  readonly compressedTotalTokens: number;
  readonly tokenSavingsPercentage: number;
  readonly compressedTurnsCount: number;
  readonly turns: readonly TrajectoryTurn[];
  readonly summaryDigest: string;
}

export type TrajectoryCompressionResult = CompressionResult;

export class ZavorthTrajectoryCompressorService {
  public compressTrajectory(
    turns: readonly TrajectoryTurn[],
    config: TrajectoryCompressionConfig
  ): CompressionResult {
    const headCount = Math.max(1, config.protectedHeadTurnsCount ?? 2);
    const tailCount = Math.max(1, config.protectedTailTurnsCount ?? 3);
    const budget = Math.max(500, config.targetTokenBudget);

    const originalTotalTokens = turns.reduce((acc, t) => acc + t.estimatedTokens, 0);

    if (originalTotalTokens <= budget || turns.length <= headCount + tailCount) {
      return {
        originalTotalTokens,
        compressedTotalTokens: originalTotalTokens,
        tokenSavingsPercentage: 0,
        compressedTurnsCount: 0,
        turns: [...turns],
        summaryDigest: 'No compression needed (trajectory is within token budget).',
      };
    }

    const headTurns = turns.slice(0, headCount);
    const tailTurns = turns.slice(turns.length - tailCount);
    const middleTurns = turns.slice(headCount, turns.length - tailCount);

    const summaryItems: string[] = [];
    const filesTouched = new Set<string>();
    const executedTools = new Set<string>();


    for (const turn of middleTurns) {
      if (turn.toolCalls && turn.toolCalls.length > 0) {
        for (const tc of turn.toolCalls) {
          executedTools.add(tc.toolName);
          let targetFile: string | null = null;
          try {
            const parsed = JSON.parse(tc.inputPayload);
            if (typeof parsed === 'object' && parsed !== null) {
              const obj = parsed as Record<string, unknown>;
              const candidate = obj.path ?? obj.AbsolutePath ?? obj.TargetFile ?? obj.filePath ?? obj.targetPath;
              if (typeof candidate === 'string' && candidate.trim().length > 0) {
                targetFile = candidate.trim();
              }
            }
          } catch {
            const tokens = tc.inputPayload.split(' ');
            for (const rawToken of tokens) {
              const token = rawToken.replace(/['",]/g, '').trim();
              if (token.length > 3 && (token.endsWith('.ts') || token.endsWith('.js') || token.endsWith('.py') || token.endsWith('.json') || token.endsWith('.md'))) {
                targetFile = token;
                break;
              }
            }
          }
          if (targetFile) {
            filesTouched.add(targetFile);
          }
          summaryItems.push(`Executed tool \`${tc.toolName}\` (exit: ${tc.exitCode ?? 0})`);
        }
      }

      if (turn.content && turn.content.trim().length > 0) {
        const firstLine = turn.content.trim().split('\n')[0];
        if (firstLine && firstLine.length > 0) {
          const truncated = firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine;
          summaryItems.push(`Turn [${turn.role}]: ${truncated}`);
        }
      }
    }

    const distinctSummaries = Array.from(new Set(summaryItems)).slice(0, 20);
    const filesList = Array.from(filesTouched).join(', ') || 'N/A';
    const toolsList = Array.from(executedTools).join(', ') || 'N/A';

    const digestMarkdown = [
      '### [Zavorth Trajectory Semantic Compression Digest]',
      `* **Intermediate Turns Summarized**: ${middleTurns.length}`,
      `* **Tools Executed**: ${toolsList}`,
      `* **Key Files Referenced**: ${filesList}`,
      '* **Key Step Log**:',
      ...distinctSummaries.map((s) => `  - ${s}`),
    ].join('\n');

    const digestTokens = Math.ceil(digestMarkdown.length / 4);

    const compressedDigestTurn: TrajectoryTurn = {
      id: 'compressed-middle-digest',
      role: 'assistant',
      content: digestMarkdown,
      estimatedTokens: digestTokens,
      isProtectedAnchor: true,
    };

    const finalTurns = [...headTurns, compressedDigestTurn, ...tailTurns];
    const compressedTotalTokens = finalTurns.reduce((acc, t) => acc + t.estimatedTokens, 0);
    const savings = Math.max(0, originalTotalTokens - compressedTotalTokens);
    const savingsPercentage = originalTotalTokens > 0 ? Math.round((savings / originalTotalTokens) * 100) : 0;

    return {
      originalTotalTokens,
      compressedTotalTokens,
      tokenSavingsPercentage: savingsPercentage,
      compressedTurnsCount: middleTurns.length,
      turns: finalTurns,
      summaryDigest: digestMarkdown,
    };
  }

  public estimateTurnTokens(content: string, toolCalls?: readonly TrajectoryToolCallRecord[]): number {
    let charCount = content.length;
    if (toolCalls) {
      for (const tc of toolCalls) {
        charCount += tc.toolName.length + tc.inputPayload.length + tc.outputPayload.length;
      }
    }
    return Math.max(1, Math.ceil(charCount / 4));
  }
}
