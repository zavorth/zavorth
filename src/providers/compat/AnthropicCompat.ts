import type { CompatLayer } from './types.js';

export const AnthropicCompat: CompatLayer = {
  providerId: 'anthropic',

  transformRequest(request: Record<string, unknown>, model: string): Record<string, unknown> {
    const out: Record<string, unknown> = { model };
    const messages = request.messages as Array<Record<string, unknown>> | undefined;

    if (request.system && typeof request.system === 'string') {
      out.system = request.system;
    }

    if (Array.isArray(messages)) {
      out.messages = messages.map((msg) => {
        const role = msg.role === 'assistant' ? 'assistant' : 'user';
        const content = msg.content;
        if (typeof content === 'string') {
          return { role, content };
        }
        if (Array.isArray(content)) {
          return { role, content };
        }
        return { role, content: String(content || '') };
      });
    } else {
      out.messages = [];
    }

    if (request.temperature !== undefined) {
      out.temperature = request.temperature;
    }
    if (request.max_tokens !== undefined) {
      out.max_tokens = request.max_tokens;
    }
    if (request.tools !== undefined) {
      out.tools = request.tools;
    }

    return out;
  },

  transformResponse(response: Record<string, unknown>): {
    content: string | null;
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    finishReason: string;
    thinking?: string;
  } {
    const contentBlocks = response.content as Array<Record<string, unknown>> | undefined;
    if (!contentBlocks || contentBlocks.length === 0) {
      return { content: null, toolCalls: [], finishReason: 'stop' };
    }

    let textContent = '';
    let thinking = '';
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

    for (const block of contentBlocks) {
      const type = block.type as string;
      if (type === 'text') {
        textContent += String(block.text || '');
      } else if (type === 'thinking') {
        thinking += String(block.thinking || '');
      } else if (type === 'tool_use') {
        let parsedInput: Record<string, unknown> = {};
        if (block.input && typeof block.input === 'object') {
          parsedInput = block.input as Record<string, unknown>;
        }
        toolCalls.push({
          id: String(block.id || ''),
          name: String(block.name || ''),
          arguments: parsedInput,
        });
      }
    }

    const stopReason = String(response.stop_reason || 'end_turn');
    const finishReason = mapStopReason(stopReason);

    return {
      content: textContent || null,
      toolCalls,
      finishReason,
      thinking: thinking || undefined,
    };
  },

  buildThinkingPayload(level: { level: string; budgetTokens?: number; enabled?: boolean }): Record<string, unknown> {
    const normalized = normalizeLevel(level.level);
    if (normalized === 'none' || level.enabled === false) {
      return { thinking: { type: 'disabled' } };
    }
    const budget = level.budgetTokens ?? resolveBudget(normalized);
    return {
      thinking: {
        type: 'enabled',
        budget_tokens: budget,
      },
    };
  },

  buildReasoningPayload(effort: string): Record<string, unknown> {
    const normalized = normalizeLevel(effort);
    if (normalized === 'none') {
      return { thinking: { type: 'disabled' } };
    }
    const budget = resolveBudget(normalized);
    return {
      thinking: {
        type: 'enabled',
        budget_tokens: budget,
      },
    };
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

function resolveBudget(level: string): number {
  switch (level) {
    case 'low': return 2_000;
    case 'medium': return 4_000;
    case 'high': return 10_000;
    case 'xhigh': return 16_000;
    default: return 4_000;
  }
}

function mapStopReason(reason: string): string {
  switch (reason) {
    case 'end_turn': return 'stop';
    case 'max_tokens': return 'length';
    case 'stop_sequence': return 'stop';
    case 'tool_use': return 'tool_calls';
    default: return reason;
  }
}
