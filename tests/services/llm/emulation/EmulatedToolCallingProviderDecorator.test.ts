import { EmulatedToolCallingProviderDecorator } from '../../../../src/providers/EmulatedToolCallingProviderDecorator.js';
import type { ILlmProvider, LlmResponse } from '../../../../src/providers/ILlmProvider.js';
import { ModelToolCallingCapabilityTracker } from '../../../../src/services/llm/ModelToolCallingCapabilityTracker.js';

function baseResponse(overrides: Partial<LlmResponse> = {}): LlmResponse {
  return {
    content: 'plain answer',
    toolCalls: [],
    finishReason: 'stop',
    ...overrides,
  };
}

function innerProvider(handler: (messages: unknown, tools?: unknown) => Promise<LlmResponse>): ILlmProvider {
  return {
    name: 'test-provider',
    chat: (messages, tools) => handler(messages, tools),
  };
}

describe('EmulatedToolCallingProviderDecorator', () => {
  beforeEach(() => {
    ModelToolCallingCapabilityTracker.resetForTests();
    delete process.env.ZAVORTH_TOOL_CALLING_MODE;
    delete process.env.ZAVORTH_CAPABILITY_STATE_FILE;
    ModelToolCallingCapabilityTracker.getInstance({ stateFilePath: null });
  });

  it('passes through native tool_calls untouched (zero regression)', async () => {
    const nativeResponse = baseResponse({
      content: 'ok',
      toolCalls: [{ id: 'call-1', name: 'read_file', arguments: { path: 'a.txt' } }],
      finishReason: 'tool_calls',
    });
    const provider = innerProvider(async () => nativeResponse);
    const decorator = new EmulatedToolCallingProviderDecorator(provider);

    const result = await decorator.chat([{ role: 'user', content: 'hi' }], [{ name: 'read_file', description: 'r', parameters: { type: 'object', properties: {} } }]);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('read_file');
    expect(result.metadata?.emulatedToolCalling).toBeUndefined();
  });

  it('extracts emulated tool calls from content when native tool_calls are empty', async () => {
    const provider = innerProvider(async () => baseResponse({
      content: 'Checking now. {"tool": "read_file", "arguments": {"path": "a.txt"}}',
    }));
    const decorator = new EmulatedToolCallingProviderDecorator(provider);

    const result = await decorator.chat([{ role: 'user', content: 'read a.txt' }]);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('read_file');
    expect(result.toolCalls[0].arguments.path).toBe('a.txt');
    expect(result.metadata?.emulatedToolCalling).toBe(true);
    expect(result.finishReason).toBe('tool_calls');
    expect(result.content).not.toContain('"tool"');
  });

  it('does not touch responses without emulated invocations', async () => {
    const provider = innerProvider(async () => baseResponse({ content: 'Just a plain answer.' }));
    const decorator = new EmulatedToolCallingProviderDecorator(provider);

    const result = await decorator.chat([{ role: 'user', content: 'hello' }]);

    expect(result.toolCalls).toHaveLength(0);
    expect(result.content).toBe('Just a plain answer.');
    expect(result.metadata?.emulatedToolCalling).toBeUndefined();
  });

  it('injects the emulation prompt into the system message when enabled', async () => {
    let capturedMessages: unknown = null;
    const provider = innerProvider(async (messages) => {
      capturedMessages = messages;
      return baseResponse({ content: 'ok' });
    });
    const decorator = new EmulatedToolCallingProviderDecorator(provider, { injectEmulationPrompt: true });

    await decorator.chat(
      [{ role: 'system', content: 'You are Zavorth.' }, { role: 'user', content: 'read a' }],
      [{ name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: {} } }],
    );

    const system = (capturedMessages as Array<{ role: string; content: string }>)[0];
    expect(system.content).toContain('<tool_call>');
    expect(system.content).toContain('read_file');
  });

  it('does not inject any hint when the model is classified as native', async () => {
    const tracker = ModelToolCallingCapabilityTracker.getInstance({ stateFilePath: null });
    tracker.record({ providerName: 'test-provider', modelName: null, hadNativeToolCalls: true, hadEmulatedToolCalls: false });

    let capturedMessages: unknown = null;
    const provider = innerProvider(async (messages) => {
      capturedMessages = messages;
      return baseResponse({ content: 'ok' });
    });
    const decorator = new EmulatedToolCallingProviderDecorator(provider);

    await decorator.chat(
      [{ role: 'system', content: 'You are Zavorth.' }, { role: 'user', content: 'read a' }],
      [{ name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: {} } }],
    );

    const system = (capturedMessages as Array<{ role: string; content: string }>)[0];
    expect(system.content).toBe('You are Zavorth.');
  });

  it('injects a minimal hint on cold start (unknown track) so the model learns the format', async () => {
    let capturedMessages: unknown = null;
    const provider = innerProvider(async (messages) => {
      capturedMessages = messages;
      return baseResponse({ content: 'ok' });
    });
    const decorator = new EmulatedToolCallingProviderDecorator(provider);

    await decorator.chat(
      [{ role: 'system', content: 'You are Zavorth.' }, { role: 'user', content: 'read a' }],
      [{ name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: {} } }],
    );

    const system = (capturedMessages as Array<{ role: string; content: string }>)[0];
    expect(system.content).toContain('__zavorth_emulated_tools__');
    expect(system.content).toContain('{"tool": "tool_name", "arguments": {...}}');
    expect(system.content).toContain('read_file');
  });
});
