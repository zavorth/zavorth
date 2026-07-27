import type { ChatMessage, ToolDefinition } from '../ILlmProvider.js';

export function extractSystemPrompt(messages: ChatMessage[]): string {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => String(message.content || '').trim())
    .filter(Boolean)
    .join('\n');
}

export function toAnthropicMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      if (message.role === 'assistant') {
        return { role: 'assistant', content: message.content || '' };
      }
      if (message.role === 'tool') {
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: message.toolCallId || 'unknown',
            content: message.content || '',
          }],
        };
      }
      return { role: 'user', content: message.content || '' };
    });
}

export function toAnthropicTool(tool: ToolDefinition): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  };
}

export function parseAnthropicResponse(response: Record<string, unknown>): import('../ILlmProvider.js').LlmResponse {
  const contentBlocks = Array.isArray(response.content) ? response.content : [];
  const text = contentBlocks
    .map((block) => {
      const record = asRecord(block);
      return record?.type === 'text' ? String(record.text || '') : '';
    })
    .filter(Boolean)
    .join('\n');
  const toolCalls = contentBlocks.flatMap((block) => {
    const record = asRecord(block);
    if (record?.type !== 'tool_use') return [];
    return [{
      id: String(record.id || `tool_${Date.now()}`),
      name: String(record.name || 'unknown_tool'),
      arguments: asRecord(record.input) || {},
    }];
  });

  return {
    content: text || null,
    toolCalls,
    finishReason: String(response.stop_reason || 'stop'),
  };
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
