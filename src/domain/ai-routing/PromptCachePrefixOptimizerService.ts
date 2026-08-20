export interface PromptSectionsInput {
  readonly systemPrompt: string;
  readonly engineeringRules?: readonly string[];
  readonly toolDefinitionsJson?: string;
  readonly conversationHistory: readonly { role: string; content: string }[];
  readonly currentTurnPrompt: string;
}

export interface OptimizedPromptResult {
  readonly cachedPrefix: string;
  readonly dynamicSuffix: string;
  readonly fullCompiledPrompt: string;
  readonly cachedPrefixTokensEstimate: number;
  readonly dynamicSuffixTokensEstimate: number;
}

export class PromptCachePrefixOptimizerService {
  public buildOptimizedPrompt(input: PromptSectionsInput): OptimizedPromptResult {
    // 1. Invariant Static Prefix: System core identity & engineering invariants
    const prefixSegments: string[] = [
      input.systemPrompt.trim(),
    ];

    if (input.engineeringRules && input.engineeringRules.length > 0) {
      prefixSegments.push('--- [Engineering Invariants & Repository Guidelines] ---');
      for (const rule of input.engineeringRules) {
        prefixSegments.push(`- ${rule.trim()}`);
      }
    }

    if (input.toolDefinitionsJson) {
      prefixSegments.push('--- [Available Tool Schemas] ---');
      prefixSegments.push(input.toolDefinitionsJson.trim());
    }

    const cachedPrefix = prefixSegments.join('\n\n');

    // 2. Dynamic Variable Suffix: Historical turns and current turn
    const suffixSegments: string[] = [
      '--- [Active Conversation Trajectory] ---',
    ];

    for (const msg of input.conversationHistory) {
      suffixSegments.push(`[${msg.role.toUpperCase()}]: ${msg.content.trim()}`);
    }

    suffixSegments.push(`[USER]: ${input.currentTurnPrompt.trim()}`);

    const dynamicSuffix = suffixSegments.join('\n\n');
    const fullCompiledPrompt = `${cachedPrefix}\n\n${dynamicSuffix}`;

    return {
      cachedPrefix,
      dynamicSuffix,
      fullCompiledPrompt,
      cachedPrefixTokensEstimate: Math.max(1, Math.ceil(cachedPrefix.length / 4)),
      dynamicSuffixTokensEstimate: Math.max(1, Math.ceil(dynamicSuffix.length / 4)),
    };
  }

  public calculateCacheEfficiencyScore(previousPrefix: string, currentPrefix: string): number {
    if (!previousPrefix || !currentPrefix) return 0;

    let commonChars = 0;
    const minLen = Math.min(previousPrefix.length, currentPrefix.length);

    while (commonChars < minLen && previousPrefix[commonChars] === currentPrefix[commonChars]) {
      commonChars++;
    }

    return parseFloat((commonChars / Math.max(previousPrefix.length, currentPrefix.length)).toFixed(4));
  }
}
