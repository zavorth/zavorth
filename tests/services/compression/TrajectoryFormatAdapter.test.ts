import { TrajectoryFormatAdapter } from '../../../src/services/compression/TrajectoryFormatAdapter.js';
import type { ChatMessage } from '../../../src/providers/ILlmProvider.js';

describe('TrajectoryFormatAdapter', () => {
  let adapter: TrajectoryFormatAdapter;

  beforeEach(() => {
    adapter = new TrajectoryFormatAdapter();
  });

  it('groups assistant tool calls and corresponding tool messages into a single atomic turn', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are an agent.' },
      { role: 'user', content: 'check files' },
      {
        role: 'assistant',
        content: 'I will list and read files.',
        toolCalls: [
          { id: 'call-1', name: 'terminal', arguments: { cmd: 'dir' } },
          { id: 'call-2', name: 'read_file', arguments: { path: 'test.txt' } },
        ],
      },
      { role: 'tool', toolCallId: 'call-1', toolName: 'terminal', content: 'file1.txt\nfile2.txt' },
      { role: 'tool', toolCallId: 'call-2', toolName: 'read_file', content: 'hello world' },
      { role: 'assistant', content: 'All done.' },
    ];

    const turns = adapter.toTrajectoryTurns(messages);

    // Expected: 4 turns (system, user, atomic assistant with 2 tool calls, plain assistant)
    expect(turns).toHaveLength(4);
    expect(turns[0].role).toBe('system');
    expect(turns[1].role).toBe('user');
    expect(turns[2].role).toBe('assistant');
    expect(turns[2].toolCalls).toHaveLength(2);
    expect(turns[2].toolCalls?.[0].toolName).toBe('terminal');
    expect(turns[2].toolCalls?.[0].outputPayload).toBe('file1.txt\nfile2.txt');
    expect(turns[2].toolCalls?.[1].toolName).toBe('read_file');
    expect(turns[2].toolCalls?.[1].outputPayload).toBe('hello world');
    expect(turns[3].role).toBe('assistant');
    expect(turns[3].content).toBe('All done.');
  });

  it('reconstructs ChatMessage array with atomic assistant and tool messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'run tool' },
      {
        role: 'assistant',
        content: 'Executing command',
        toolCalls: [
          { id: 'c-unique-1', name: 'terminal', arguments: { cmd: 'pwd' } },
        ],
      },
      { role: 'tool', toolCallId: 'c-unique-1', toolName: 'terminal', content: '/app' },
    ];

    const turns = adapter.toTrajectoryTurns(messages);
    const roundtrip = adapter.toChatMessages(turns);

    expect(roundtrip).toHaveLength(3);
    expect(roundtrip[0].role).toBe('user');
    expect(roundtrip[1].role).toBe('assistant');
    expect(roundtrip[1].toolCalls).toHaveLength(1);
    expect(roundtrip[1].toolCalls?.[0].id).toBe('c-unique-1');
    expect(roundtrip[1].toolCalls?.[0].name).toBe('terminal');
    expect(roundtrip[2].role).toBe('tool');
    expect(roundtrip[2].toolCallId).toBe('c-unique-1');
    expect(roundtrip[2].content).toBe('/app');
  });

  it('emits compressed digest turns as clean assistant messages', () => {
    const turns = [
      { id: 'turn-0', role: 'user' as const, content: 'hi', estimatedTokens: 1 },
      {
        id: 'compressed-middle-digest',
        role: 'assistant' as const,
        content: '### [Zavorth Trajectory Semantic Compression Digest]\n* Summarized 5 turns.',
        estimatedTokens: 20,
      },
      { id: 'turn-6', role: 'assistant' as const, content: 'Continuing here.', estimatedTokens: 4 },
    ];

    const messages = adapter.toChatMessages(turns);

    expect(messages).toHaveLength(3);
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toContain('### [Zavorth Trajectory Semantic Compression Digest]');
    expect(messages[1].toolCalls).toBeUndefined();
  });

  it('preserves inlineData across roundtrip conversions', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'Check screenshot',
        inlineData: [{ mimeType: 'image/png', data: 'screenshotBase64' }],
      },
      {
        role: 'assistant',
        content: 'I see the image.',
      },
    ];

    const turns = adapter.toTrajectoryTurns(messages);
    expect(turns[0].inlineData).toBeDefined();
    expect(turns[0].inlineData?.[0].data).toBe('screenshotBase64');

    const roundtrip = adapter.toChatMessages(turns);
    expect(roundtrip[0].inlineData).toBeDefined();
    expect(roundtrip[0].inlineData?.[0].mimeType).toBe('image/png');
    expect(roundtrip[0].inlineData?.[0].data).toBe('screenshotBase64');
  });
});
