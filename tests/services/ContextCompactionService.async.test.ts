import { ContextCompactionService, ContextCompactionMessage } from '../../src/services/ContextCompactionService';
import type { ILlmProvider, LlmResponse } from '../../src/providers/ILlmProvider';

describe('ContextCompactionService async semantic compaction', () => {
  it('summarizes bulky old tool results using the provider', async () => {
    const service = new ContextCompactionService();

    const mockProvider: ILlmProvider = {
      name: 'mock',
      chat: jest.fn().mockResolvedValue({
        content: 'File was successfully updated with correct imports.',
        toolCalls: [],
        finishReason: 'stop'
      } as LlmResponse)
    };

    const messages: ContextCompactionMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'updating file...', toolCalls: [{ id: 'call_1', name: 'write_file', arguments: {} }] },
      {
        role: 'tool',
        toolName: 'write_file',
        toolCallId: 'call_1',
        content: 'SUCCESS: file written successfully with 500 lines of details that are very long and bulky. '.repeat(20)
      },
      { role: 'user', content: 'thanks' }
    ];

    // bulky tool result is at index 2 (older than 1 recent turn)
    const result = await service.compactSemanticAsync(messages, mockProvider, 1);

    expect(result.clearedToolOutputs).toBe(1);
    expect(mockProvider.chat).toHaveBeenCalled();
    expect(result.messages[2].content).toContain('[Old tool result summarized (write_file) - File was successfully updated with correct imports.]');
  });

  it('falls back cleanly to static clearance when provider fails', async () => {
    const service = new ContextCompactionService();

    const mockProvider: ILlmProvider = {
      name: 'mock',
      chat: jest.fn().mockRejectedValue(new Error('API Error'))
    };

    const messages: ContextCompactionMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'updating file...', toolCalls: [{ id: 'call_1', name: 'write_file', arguments: {} }] },
      {
        role: 'tool',
        toolName: 'write_file',
        toolCallId: 'call_1',
        content: 'SUCCESS: file written successfully with 500 lines of details that are very long and bulky. '.repeat(20)
      },
      { role: 'user', content: 'thanks' }
    ];

    const result = await service.compactSemanticAsync(messages, mockProvider, 1);

    expect(result.clearedToolOutputs).toBe(1);
    expect(result.messages[2].content).toContain('[Old tool result cleared (write_file) - status=ok; context preserved by receipt.]');
  });
});
