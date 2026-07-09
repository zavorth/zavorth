import { getEncoding } from 'js-tiktoken';

/**
 * TokenCounter - preventive context budget guard.
 * Measures the semantic weight of conversations and Agentic RAG history
 * before sending them to paid APIs.
 */
export class TokenCounter {
  public static countTokens(text: string): number {
    try {
      const encoding = getEncoding('cl100k_base');
      const tokens = encoding.encode(text);
      return tokens.length;
    } catch (error: any) { const err = error; const e = error;
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Evaluates context window health.
   * Models up to 128k tokens, but emits warnings much earlier.
   */
  public static isApproachingLimit(text: string, warningThreshold = 64_000): boolean {
    const tokens = this.countTokens(text);
    return tokens >= warningThreshold;
  }
}
