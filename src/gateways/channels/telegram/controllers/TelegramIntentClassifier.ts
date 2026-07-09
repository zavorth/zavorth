import type { LlmRuntimeService } from '@zavorth/services/llm/LlmRuntimeService.js';
import { logger } from '../../../../logger';

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

Given the user's message, classify it into one of these intents and extract parameters.

Intents:
1. remote_mode - User wants to activate, deactivate, or check status of remote mode
   - action: "activate" | "restore" | "status"

2. runtime_maintenance - User wants to see changes, reload, or autorepair
   - action: "changes" | "reload" | "autorepair"
   - force: boolean (optional, default false)
   - dryRun: boolean (optional, default false)
   - improve: boolean (optional, default false)

3. zavorth_bridge_prompt - User wants to send a prompt to ZavorthBridge
   - model: string (the model name)
   - prompt: string (the prompt text)

4. zavorth_bridge_control - User wants to control ZavorthBridge
   - action: "open" | "status" | "restart" | "set-model"
   - model: string (optional, for set-model)

5. unknown - User intent doesn't match any of the above

Respond with ONLY a JSON object, no other text:
{
  "type": "<intent_type>",
  ...intent-specific fields
}

Examples:
User: "ativa o modo remoto" → {"type": "remote_mode", "action": "activate"}
User: "show me the recent changes" → {"type": "runtime_maintenance", "action": "changes"}
User: "se autorepare" → {"type": "runtime_maintenance", "action": "autorepair"}
User: "open zavorthbridge" → {"type": "zavorth_bridge_control", "action": "open"}
User: "hello" → {"type": "unknown"}`;

export class TelegramIntentClassifier {
  constructor(private readonly llmRuntime: LlmRuntimeService | null) {}

  /**
   * Classify user intent using LLM. Falls back to null if LLM is unavailable.
   */
  async classify(userMessage: string): Promise<ClassifiedIntent> {
    if (!this.llmRuntime) {
      return { type: 'unknown' };
    }

    try {
      const response = await this.llmRuntime.chat([
        { role: 'system', content: INTENT_CLASSIFICATION_PROMPT },
        { role: 'user', content: userMessage },
      ]);

      const content = response.content || '';
      const parsed = this.parseJsonResponse(content);
      
      if (parsed && this.isValidIntent(parsed)) {
        return parsed;
      }

      return { type: 'unknown' };
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Telegram  Classifier] parsing failed', error);
    return { type: 'unknown' };
  }
  }

  private parseJsonResponse(text: string): ClassifiedIntent | null {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]);
    } catch (error: any) { const err = error; const e = error; logger.warn('[Telegram  Classifier] JSON parse failed', error); return null; }
  }

  private isValidIntent(intent: unknown): intent is ClassifiedIntent {
    if (!intent || typeof (intent as ClassifiedIntent).type !== 'string') return false;

    const validTypes = ['remote_mode', 'runtime_maintenance', 'zavorth_bridge_prompt', 'zavorth_bridge_control', 'unknown'];
    if (!validTypes.includes((intent as ClassifiedIntent).type)) return false;

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
