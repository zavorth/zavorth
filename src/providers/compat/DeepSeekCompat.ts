import type { CompatLayer } from './types.js';

export const DeepSeekCompat: CompatLayer = {
  providerId: 'deepseek',

  transformRequest(request: Record<string, unknown>, model: string): Record<string, unknown> {
    const out: Record<string, unknown> = { ...request, model };
    const extraBody = (out.extra_body as Record<string, unknown>) || {};

    if (request.thinking !== undefined) {
      extraBody.thinking = request.thinking;
      delete out.thinking;
    }

    if (Object.keys(extraBody).length > 0) {
      out.extra_body = extraBody;
    }

    return out;
  },

  transformResponse(response: Record<string, unknown>): {
    content: string | null;
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    finishReason: string;
    thinking?: string;
  } {
    const choices = response.choices as Array<Record<string, unknown>> | undefined;
    const choice = choices?.[0];
    if (!choice) {
      return { content: null, toolCalls: [], finishReason: 'error' };
    }

    const message = choice.message as Record<string, unknown> | undefined;
    const content = typeof message?.content === 'string' ? message.content : null;

    const reasoningContent = typeof message?.reasoning_content === 'string'
      ? message.reasoning_content
      : undefined;

    const rawToolCalls = message?.tool_calls as Array<Record<string, unknown>> | undefined;
    const toolCalls = (rawToolCalls || []).map((tc) => {
      const fn = tc.function as Record<string, unknown> | undefined;
      let parsedArgs: Record<string, unknown> = {};
      if (typeof fn?.arguments === 'string') {
        try {
          parsedArgs = JSON.parse(fn.arguments) as Record<string, unknown>;
        } catch {
          parsedArgs = {};
        }
      }
      return {
        id: String(tc.id || ''),
        name: String(fn?.name || ''),
        arguments: parsedArgs,
      };
    });

    const finishReason = String(choice.finish_reason || 'stop');

    return {
      content,
      toolCalls,
      finishReason,
      thinking: reasoningContent || undefined,
    };
  },

  buildThinkingPayload(level: { level: string; budgetTokens?: number; enabled?: boolean }): Record<string, unknown> {
    const normalized = normalizeLevel(level.level);
    if (normalized === 'none' || level.enabled === false) {
      return { thinking: { type: 'disabled' } };
    }
    return { thinking: { type: 'enabled' } };
  },

  buildReasoningPayload(effort: string): Record<string, unknown> {
    const normalized = normalizeLevel(effort);
    if (normalized === 'none') {
      return {};
    }
    return { reasoning_effort: normalized };
  },
};

function normalizeLevel(level: string): string {
  const raw = level.trim().toLowerCase();
  if (raw === 'none' || raw === 'off') return 'none';
  if (raw === 'low') return 'low';
  if (raw === 'medium' || raw === 'standard') return 'medium';
  if (raw === 'high') return 'high';
  if (raw === 'xhigh' || raw === 'max' || raw === 'ultra') return 'xhigh';
  return 'medium';
}
