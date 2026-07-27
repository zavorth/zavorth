import OpenAI from 'openai';
import type { ToolCall } from './ILlmProvider.js';
import { logger } from '../logger.js';type OpenAiFunctionToolCall = Extract<OpenAI.ChatCompletionMessageToolCall, { type: 'function' }>;

function isFunctionToolCall(toolCall: OpenAI.ChatCompletionMessageToolCall): toolCall is OpenAiFunctionToolCall {
  return toolCall.type === 'function' && 'function' in toolCall;
}

function parseToolArguments(rawValue: string): Record<string, unknown> {
  const normalized = String(rawValue || '').trim();
  if (!normalized) {
    return {};
  }

  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return { value: parsed };
  } catch (error: unknown) {logger.warn('[openai  Calls] JSON parse failed', error);
    return { raw: normalized };
  }
}

export function extractFunctionToolCalls(
  toolCalls?: OpenAI.ChatCompletionMessageToolCall[] | null,
): ToolCall[] {
  return (toolCalls || [])
    .filter(isFunctionToolCall)
    .map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.function.name,
      arguments: parseToolArguments(toolCall.function.arguments),
    }));
}
