import type { CompatLayer } from './types.js';

export const GoogleCompat: CompatLayer = {
  providerId: 'google',

  transformRequest(request: Record<string, unknown>, model: string): Record<string, unknown> {
    const out: Record<string, unknown> = { model };

    const messages = request.messages as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(messages)) {
      out.contents = messages.map((msg) => {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const parts: Array<Record<string, unknown>> = [];
        if (typeof msg.content === 'string' && msg.content) {
          parts.push({ text: msg.content });
        }
        return { role, parts };
      });
    } else {
      out.contents = [];
    }

    if (request.system && typeof request.system === 'string') {
      out.system_instruction = {
        parts: [{ text: request.system }],
      };
    }

    if (request.tools !== undefined) {
      out.tools = [{ function_declarations: request.tools }];
    }

    if (request.temperature !== undefined) {
      out.generationConfig = {
        ...(out.generationConfig as Record<string, unknown> || {}),
        temperature: request.temperature,
      };
    }
    if (request.max_tokens !== undefined) {
      out.generationConfig = {
        ...(out.generationConfig as Record<string, unknown> || {}),
        maxOutputTokens: request.max_tokens,
      };
    }

    return out;
  },

  transformResponse(response: Record<string, unknown>): {
    content: string | null;
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    finishReason: string;
    thinking?: string;
  } {
    const candidates = response.candidates as Array<Record<string, unknown>> | undefined;
    const candidate = candidates?.[0];
    if (!candidate) {
      return { content: null, toolCalls: [], finishReason: 'error' };
    }

    const content = candidate.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;

    let textContent = '';
    let thinking = '';
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

    for (const part of parts || []) {
      if (part.text) {
        textContent += String(part.text);
      }
      if (part.thought) {
        thinking += String(part.text || '');
      }
      if (part.functionCall) {
        const fc = part.functionCall as Record<string, unknown>;
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: String(fc.name || ''),
          arguments: (fc.args as Record<string, unknown>) || {},
        });
      }
    }

    const finishReason = mapFinishReason(candidate.finishReason as string | undefined);

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
      return { thinkingConfig: { includeThoughts: false } };
    }
    const budget = level.budgetTokens ?? resolveBudget(normalized);
    return {
      thinkingConfig: {
        includeThoughts: true,
        thinkingBudget: budget,
      },
    };
  },

  buildReasoningPayload(effort: string): Record<string, unknown> {
    const normalized = normalizeLevel(effort);
    if (normalized === 'none') {
      return { thinkingConfig: { includeThoughts: false } };
    }
    const budget = resolveBudget(normalized);
    return {
      thinkingConfig: {
        includeThoughts: true,
        thinkingBudget: budget,
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
    case 'low': return 1_024;
    case 'medium': return 4_096;
    case 'high': return 8_192;
    case 'xhigh': return 16_384;
    default: return 4_096;
  }
}

function mapFinishReason(reason: string | undefined): string {
  switch (reason) {
    case 'STOP': return 'stop';
    case 'MAX_TOKENS': return 'length';
    case 'SAFETY': return 'content_filter';
    case 'RECITATION': return 'content_filter';
    case 'OTHER': return 'error';
    default: return reason || 'stop';
  }
}
