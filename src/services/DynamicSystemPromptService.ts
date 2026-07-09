/**
 * DynamicSystemPromptService — Compresses system prompts based on detected intent.
 *
 * Instead of sending the full system prompt (~15K tokens) on every LLM request,
 * this service selects a tier-appropriate prompt based on the intent category.
 * Simple messages like "oi" get a minimal prompt, while complex requests get
 * the full context.
 */

export type PromptTier = 'minimal' | 'standard' | 'full';

export type DynamicSystemPromptOptions = {
  /** Base prompt sections for each tier. Overrides defaults if provided. */
  tierPrompts?: Partial<Record<PromptTier, string>>;
};

export type DynamicSystemPromptResult = {
  prompt: string;
  tier: PromptTier;
  tokenEstimate: number;
  intentCategory: string;
};

/** Approximate tokens per character (English text, ~4 chars per token). */
const CHARS_PER_TOKEN = 4;

/**
 * Maps each intent category to its recommended prompt tier.
 * - conversation: minimal (greetings, simple chat)
 * - information/file_operation/configuration/memory/desktop: standard (moderate context)
 * - execution/research/full_toolset: full (complete system prompt needed)
 */
const INTENT_TO_TIER: Record<string, PromptTier> = {
  conversation: 'minimal',
  information: 'standard',
  file_operation: 'standard',
  execution: 'full',
  configuration: 'standard',
  memory: 'standard',
  desktop: 'standard',
  research: 'full',
  full_toolset: 'full',
};

const DEFAULT_MINIMAL_PROMPT = `You are Zavorth, a helpful AI assistant. Be concise and direct. Answer the user's question without unnecessary elaboration.`;

const DEFAULT_STANDARD_PROMPT = `You are Zavorth, a helpful AI assistant with access to various tools. Follow these guidelines:

1. Be concise and direct in responses.
2. Use tools when the task requires file operations, searches, or external data.
3. Confirm destructive actions before executing them.
4. Maintain context across the conversation.
5. Prioritize accuracy over speed.`;

const DEFAULT_FULL_PROMPT = `You are Zavorth, a helpful AI assistant with comprehensive capabilities. Follow these guidelines:

1. Be concise and direct in responses.
2. Use tools when the task requires file operations, searches, or external data.
3. Confirm destructive actions before executing them.
4. Maintain context across the conversation.
5. Prioritize accuracy over speed.

## Tool Guidelines
- Always verify file paths before reading or writing.
- Use search tools before making assumptions about codebase state.
- Prefer incremental changes over large refactors.
- Run tests after significant changes.
- Log important decisions and their rationale.

## Security Guidelines
- Never expose API keys or secrets in responses.
- Validate user inputs before processing.
- Follow principle of least privilege for file access.
- Audit external tool calls for injection risks.

## Response Formatting
- Use markdown for structured content.
- Keep responses focused and actionable.
- Include file paths and line numbers when referencing code.
- Summarize complex operations before executing them.`;

export class DynamicSystemPromptService {
  private readonly tierPrompts: Record<PromptTier, string>;

  constructor(options?: DynamicSystemPromptOptions) {
    this.tierPrompts = {
      minimal: options?.tierPrompts?.minimal ?? DEFAULT_MINIMAL_PROMPT,
      standard: options?.tierPrompts?.standard ?? DEFAULT_STANDARD_PROMPT,
      full: options?.tierPrompts?.full ?? DEFAULT_FULL_PROMPT,
    };
  }

  /**
   * Resolve the prompt tier for a given intent category.
   * Returns 'standard' for unknown categories as a safe default.
   */
  resolveTier(intentCategory: string | null | undefined): PromptTier {
    if (!intentCategory) return 'standard';
    return INTENT_TO_TIER[intentCategory] ?? 'standard';
  }

  /**
   * Get the appropriate system prompt for the given intent category.
   *
   * @param intentCategory - Detected intent category from the classifier.
   * @param basePrompt - The full base system prompt (used as fallback for 'full' tier).
   * @returns DynamicSystemPromptResult with the selected prompt and metadata.
   */
  getPrompt(intentCategory: string | null | undefined, basePrompt: string): DynamicSystemPromptResult {
    const tier = this.resolveTier(intentCategory);

    let prompt: string;
    if (tier === 'full' && basePrompt) {
      prompt = basePrompt;
    } else {
      prompt = this.tierPrompts[tier];
    }

    return {
      prompt,
      tier,
      tokenEstimate: this.calculateTokens(prompt),
      intentCategory: intentCategory ?? 'unknown',
    };
  }

  /**
   * Rough token estimate based on character count.
   * Uses the heuristic of ~4 characters per token for English text.
   *
   * @param prompt - The prompt text to estimate.
   * @returns Approximate token count.
   */
  calculateTokens(prompt: string): number {
    if (!prompt) return 0;
    return Math.ceil(prompt.length / CHARS_PER_TOKEN);
  }
}
