import { ToolResultPruningService } from '../../../src/services/compression/ToolResultPruningService.js';
import type { ChatMessage } from '../../../src/providers/ILlmProvider.js';

describe('ToolResultPruningService', () => {
  let service: ToolResultPruningService;

  beforeEach(() => {
    service = new ToolResultPruningService();
  });

  it('keeps the most recent tools untouched based on keepRecent', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'run tests' },
      {
        role: 'assistant',
        content: 'running',
        toolCalls: [
          { id: 'c1', name: 'terminal', arguments: { command: 'npm test' } },
        ],
      },
      { role: 'tool', toolCallId: 'c1', toolName: 'terminal', content: 'output 1\n'.repeat(50) },
      {
        role: 'assistant',
        content: 'reading',
        toolCalls: [
          { id: 'c2', name: 'read_file', arguments: { path: 'src/index.ts' } },
        ],
      },
      { role: 'tool', toolCallId: 'c2', toolName: 'read_file', content: 'const a = 1;\n'.repeat(50) },
      {
        role: 'assistant',
        content: 'reading 2',
        toolCalls: [
          { id: 'c3', name: 'read_file', arguments: { path: 'src/app.ts' } },
        ],
      },
      { role: 'tool', toolCallId: 'c3', toolName: 'read_file', content: 'const b = 2;\n'.repeat(50) },
    ];

    // keepRecent: 2 means c2 and c3 are protected, c1 is pruned
    const result = service.pruneOlderToolResults(messages, { keepRecent: 2 });

    expect(result.toolsPrunedCount).toBe(1);
    expect(result.messages[2].content).toContain('[compacted tool] [terminal] ran "npm test"');
    expect(result.messages[4].content).toBe('const a = 1;\n'.repeat(50));
    expect(result.messages[6].content).toBe('const b = 2;\n'.repeat(50));
  });

  it('deduplicates multiple reads of the same file path', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'inspect file' },
      {
        role: 'assistant',
        content: 'first read',
        toolCalls: [
          { id: 'c1', name: 'read_file', arguments: { path: 'src/config.ts' } },
        ],
      },
      { role: 'tool', toolCallId: 'c1', toolName: 'read_file', content: 'initial config content\n'.repeat(40) },
      {
        role: 'assistant',
        content: 'second read of same file',
        toolCalls: [
          { id: 'c2', name: 'read_file', arguments: { path: 'src/config.ts' } },
        ],
      },
      { role: 'tool', toolCallId: 'c2', toolName: 'read_file', content: 'updated config content\n'.repeat(40) },
    ];

    // Even with keepRecent: 2, c1 should be pruned as superseded by c2
    const result = service.pruneOlderToolResults(messages, { keepRecent: 2, enableFileDeduplication: true });

    expect(result.deduplicatedReadsCount).toBe(1);
    expect(result.messages[2].content).toBe('[read_file] src/config.ts (superseded by newer read in subsequent turn)');
    expect(result.messages[4].content).toBe('updated config content\n'.repeat(40));
  });

  it('produces structured 1-line summaries for commands and searches', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'actions',
        toolCalls: [
          { id: 'c1', name: 'run_command', arguments: { command: 'git status' } },
          { id: 'c2', name: 'grep_search', arguments: { query: 'export class' } },
          { id: 'c3', name: 'replace_file_content', arguments: { TargetFile: 'src/main.ts' } },
        ],
      },
      { role: 'tool', toolCallId: 'c1', toolName: 'run_command', content: 'line 1\nline 2\nline 3' },
      { role: 'tool', toolCallId: 'c2', toolName: 'grep_search', content: 'file1.ts:10\nfile2.ts:20' },
      { role: 'tool', toolCallId: 'c3', toolName: 'replace_file_content', content: 'File updated successfully' },
      // extra recent tool so the above 3 get pruned
      {
        role: 'assistant',
        content: 'done',
        toolCalls: [{ id: 'c4', name: 'read_file', arguments: { path: 'test.ts' } }],
      },
      { role: 'tool', toolCallId: 'c4', toolName: 'read_file', content: 'keep this' },
    ];

    const result = service.pruneOlderToolResults(messages, { keepRecent: 1 });

    expect(result.messages[1].content).toContain('[terminal] ran "git status"');
    expect(result.messages[2].content).toContain('[search] query "export class"');
    expect(result.messages[3].content).toContain('[write] updated src/main.ts');
  });

  it('preserves tool-pair integrity and role/id contracts', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'calling',
        toolCalls: [{ id: 'call-xyz-123', name: 'read_file', arguments: { path: 'a.txt' } }],
      },
      { role: 'tool', toolCallId: 'call-xyz-123', toolName: 'read_file', content: 'large content '.repeat(100) },
      {
        role: 'assistant',
        content: 'next turn',
        toolCalls: [{ id: 'call-xyz-456', name: 'other_tool', arguments: {} }],
      },
      { role: 'tool', toolCallId: 'call-xyz-456', toolName: 'other_tool', content: 'recent content' },
    ];

    const result = service.pruneOlderToolResults(messages, { keepRecent: 1 });

    expect(result.messages[1].role).toBe('tool');
    expect(result.messages[1].toolCallId).toBe('call-xyz-123');
    expect(result.messages[1].toolName).toBe('read_file');
    expect(result.messages[3].role).toBe('tool');
    expect(result.messages[3].toolCallId).toBe('call-xyz-456');
    expect(result.messages[3].toolName).toBe('other_tool');
  });

  it('never mutates input array in place', () => {
    const originalContent = 'large text '.repeat(50);
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'calling',
        toolCalls: [{ id: 'c1', name: 'read_file', arguments: { path: 'x.ts' } }],
      },
      { role: 'tool', toolCallId: 'c1', toolName: 'read_file', content: originalContent },
      {
        role: 'assistant',
        content: 'calling',
        toolCalls: [{ id: 'c2', name: 'read_file', arguments: { path: 'y.ts' } }],
      },
      { role: 'tool', toolCallId: 'c2', toolName: 'read_file', content: 'recent' },
    ];

    const result = service.pruneOlderToolResults(messages, { keepRecent: 1 });

    // Original array and object must be untouched
    expect(messages[1].content).toBe(originalContent);
    expect(result.messages[1].content).not.toBe(originalContent);
  });
});
