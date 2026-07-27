import type { LlmRuntimeService } from '@zavorth/services/llm/LlmRuntimeService.js';
import { logger } from '../../../../logger.js';

export type IntentType =
  | 'remote_mode'
  | 'runtime_maintenance'
  | 'zavorth_bridge_prompt'
  | 'zavorth_bridge_control'
  | 'unknown';

export type ClassifiedIntent =
  | { type: 'remote_mode'; action: 'activate' | 'restore' | 'status' }
  | { type: 'runtime_maintenance'; action: 'changes' | 'reload' | 'autorepair'; force?: boolean; dryRun?: boolean; improve?: boolean }
  | { type: 'zavorth_bridge_prompt'; model: string; prompt: string }
  | { type: 'zavorth_bridge_control'; action: string; model?: string }
  | { type: 'unknown' };

const INTENT_CLASSIFICATION_PROMPT = `You are an intent classifier for a Telegram bot called Zavorth.

Classify the user's message by meaning, not by keywords, examples, or language-specific phrases.

Supported intents:
1. remote_mode
   - action: "activate" | "restore" | "status"

2. runtime_maintenance
   - action: "changes" | "reload" | "autorepair"
   - force: boolean, optional
   - dryRun: boolean, optional
   - improve: boolean, optional

3. zavorth_bridge_prompt
   - model: string
   - prompt: string

4. zavorth_bridge_control
   - action: "open" | "status" | "restart" | "set-model"
   - model: string, optional

5. unknown

Return only one JSON object with the intent type and the matching fields.`;

export class TelegramIntentClassifier {
  constructor(private readonly llmRuntime: LlmRuntimeService | null) {}

  async classify(userMessage: string): Promise<ClassifiedIntent> {
    if (!this.llmRuntime) {
      return { type: 'unknown' };
    }

    try {
      const response = await this.llmRuntime.chat([
        { role: 'system', content: INTENT_CLASSIFICATION_PROMPT },
        { role: 'user', content: userMessage },
      ]);

      const parsed = this.parseJsonResponse(response.content || '');
      return parsed && this.isValidIntent(parsed) ? parsed : { type: 'unknown' };
    } catch (error: unknown) {
      logger.warn('[TelegramIntentClassifier] classification failed', error);
      return { type: 'unknown' };
    }
  }

  private parseJsonResponse(text: string): ClassifiedIntent | null {
    try {
      const jsonText = extractJsonObjectText(text);
      return jsonText ? JSON.parse(jsonText) : null;
    } catch (error: unknown) {
      logger.warn('[TelegramIntentClassifier] JSON parse failed', error);
      return null;
    }
  }

  private isValidIntent(intent: unknown): intent is ClassifiedIntent {
    if (!intent || typeof (intent as ClassifiedIntent).type !== 'string') {
      return false;
    }

    const validTypes = ['remote_mode', 'runtime_maintenance', 'zavorth_bridge_prompt', 'zavorth_bridge_control', 'unknown'];
    if (!validTypes.includes((intent as ClassifiedIntent).type)) {
      return false;
    }

    const typed = intent as ClassifiedIntent;
    switch (typed.type) {
      case 'remote_mode':
        return ['activate', 'restore', 'status'].includes(typed.action);
      case 'runtime_maintenance':
        return ['changes', 'reload', 'autorepair'].includes(typed.action);
      case 'zavorth_bridge_prompt':
        return typeof typed.model === 'string' && typeof typed.prompt === 'string';
      case 'zavorth_bridge_control':
        return typeof typed.action === 'string';
      case 'unknown':
        return true;
      default:
        return false;
    }
  }
}

function extractJsonObjectText(text: string): string | null {
  const source = String(text || '');
  const start = source.indexOf('{');
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index] || '';
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}
