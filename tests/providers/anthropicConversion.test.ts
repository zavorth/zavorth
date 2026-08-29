import {
  extractSystemPrompt,
  toAnthropicMessages,
  toAnthropicTool,
} from '../../src/providers/utils/anthropicConversion.js';
import type { ChatMessage, ToolDefinition } from '../../src/providers/ILlmProvider.js';

describe('anthropicConversion', () => {
  it('extracts system prompt text from system messages', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are an agent.' },
      { role: 'user', content: 'hello' },
    ];

    expect(extractSystemPrompt(messages)).toBe('You are an agent.');
  });

  it('converts inlineData on user messages to Anthropic image content blocks', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'Check this image',
        inlineData: [{ mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }],
      },
    ];

    const anthropicMessages = toAnthropicMessages(messages);
    expect(anthropicMessages).toHaveLength(1);
    expect(anthropicMessages[0].role).toBe('user');
    expect(Array.isArray(anthropicMessages[0].content)).toBe(true);

    const content = anthropicMessages[0].content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      },
    });
    expect(content[1]).toEqual({
      type: 'text',
      text: 'Check this image',
    });
  });

  it('preserves system prompt inlineData by attaching it to the first user message', () => {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: '[context-image 1568x728]',
        inlineData: [{ mimeType: 'image/png', data: 'systemPngData' }],
      },
      {
        role: 'user',
        content: 'Execute task',
      },
    ];

    const anthropicMessages = toAnthropicMessages(messages);
    expect(anthropicMessages).toHaveLength(1);
    expect(anthropicMessages[0].role).toBe('user');

    const content = anthropicMessages[0].content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({ type: 'text', text: '[System Context Visual Attachment]' });
    expect(content[1]).toEqual({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: 'systemPngData',
      },
    });
    expect(content[2]).toEqual({ type: 'text', text: 'Execute task' });
  });

  it('keeps simple string content for standard user messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Plain text message' },
    ];

    const anthropicMessages = toAnthropicMessages(messages);
    expect(anthropicMessages[0]).toEqual({
      role: 'user',
      content: 'Plain text message',
    });
  });

  it('converts tool definitions to Anthropic tool schema', () => {
    const tool: ToolDefinition = {
      name: 'test_tool',
      description: 'A test tool',
      parameters: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
    };

    const anthropicTool = toAnthropicTool(tool);
    expect(anthropicTool).toEqual({
      name: 'test_tool',
      description: 'A test tool',
      input_schema: tool.parameters,
    });
  });
});
