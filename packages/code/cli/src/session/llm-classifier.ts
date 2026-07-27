import { Log } from "../util"
import { Effect } from "effect"

const log = Log.create({ service: "llm-classifier" })

const CLASSIFICATION_TIMEOUT = 10_000 // 10 seconds

/**
 * Simple LLM-based text classification using fetch API directly.
 * Avoids complex Effect context dependencies for simple classification tasks.
 */
async function callLlmForClassification(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // Get config from environment or use defaults
  const apiKey = process.env.OPENAI_API_KEY || process.env.ZAVORTH_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  const model = process.env.ZAVORTH_CLASSIFICATION_MODEL || "gpt-4o-mini"

  if (!apiKey) {
    throw new Error("No API key configured for LLM classification")
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 50,
      temperature: 0
    }),
    signal: AbortSignal.timeout(CLASSIFICATION_TIMEOUT)
  })

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || ""
}

/**
 * LLM-based text classification for content analysis.
 * Replaces brittle regex patterns with intelligent, language-agnostic classification.
 */
export namespace LlmClassifier {
  /**
   * Detect if text contains errors (replaces ERROR_PATTERN regex)
   */
  export async function hasErrors(text: string): Promise<boolean> {
    try {
      const systemPrompt = `You are an error detector. Analyze the text and determine if it contains error messages, exceptions, failures, or other signs of problems.

Rules:
- Return ONLY "true" if errors are found
- Return ONLY "false" if no errors are found
- Consider context: "error" in a log is different from "error handling" in documentation
- Language-agnostic: detect errors in ANY language (English, Portuguese, Spanish, etc.)
- Be precise: don't flag normal output that happens to contain error-related words`

      const result = await callLlmForClassification(
        systemPrompt,
        `Text to analyze:\n\n${text.substring(0, 2000)}`
      )

      const response = result.toLowerCase()
      log.info(`LLM error classification`, { input: text.substring(0, 100), result: response })
      return response === "true"
    } catch (error) {
      log.warn(`LLM classification failed, falling back to regex match`, { error })
      return true // If LLM fails, trust the regex match
    }
  }

  /**
   * Detect if a "Next step" is filler (replaces NEXT_FILLER_PATTERNS regex)
   */
  export async function isFiller(text: string): Promise<boolean> {
    try {
      const systemPrompt = `You are a content quality detector. Analyze if a "Next step" description is concrete and actionable, or just filler/placeholder text.

Rules:
- Return "true" if the text is vague, generic, or non-actionable filler
- Return "false" if the text contains specific, concrete actions
- Examples of filler: "continue", "keep going", "finish up", "next steps", "continuar"
- Examples of concrete: "Edit src/app.ts:42 to fix the bug", "Run npm test", "Refactor the auth module"
- Language-agnostic: detect filler in ANY language`

      const result = await callLlmForClassification(
        systemPrompt,
        `Next step to evaluate:\n\n${text}`
      )

      const response = result.toLowerCase()
      log.info(`LLM filler classification`, { input: text.substring(0, 100), result: response })
      return response === "true"
    } catch (error) {
      log.warn(`LLM classification failed, falling back to false`, { error })
      return false
    }
  }

  /**
   * Detect if texts show repetitive loop (replaces normalizeForLoopDetection + detectTextLoop)
   */
  export async function isRepetitiveLoop(texts: string[]): Promise<boolean> {
    if (texts.length < 3) return false

    // Quick check: if all texts are identical after normalization, it's a loop
    const normalized = texts.map(t =>
      t.trim().toLowerCase()
        .replace(/\s+/g, " ")
        .slice(0, 200)
    )
    const unique = new Set(normalized)
    if (unique.size === 1) return true

    try {
      const systemPrompt = `You are a repetition detector. Analyze if the provided texts show the model is stuck in a repetitive loop.

Rules:
- Return "true" if the texts are substantially similar or repetitive
- Return "false" if the texts show meaningful progress or variation
- Consider semantic similarity, not just exact matches ? "I'll try X" followed by "Let me try X" is repetitive ? "I'll try X" followed by "Now I'll try Y" is NOT repetitive
- Language-agnostic: detect repetition in ANY language`

      const result = await callLlmForClassification(
        systemPrompt,
        `Recent outputs to analyze:\n\n${texts.join("\n---\n")}`
      )

      const response = result.toLowerCase()
      log.info(`LLM loop classification`, { input: texts.length + " texts", result: response })
      return response === "true"
    } catch (error) {
      log.warn(`LLM classification failed, falling back to false`, { error })
      return false
    }
  }
}
