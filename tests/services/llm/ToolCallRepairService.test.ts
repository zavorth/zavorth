import { describe, it, expect } from '@jest/globals';
import { ToolCallRepairService } from '../../../src/services/llm/ToolCallRepairService.js';

describe('ToolCallRepairService (Open-Source Model Tool Call Auto-Repair)', () => {
  it('should auto-repair XML-style tool calls', () => {
    const raw = 'Let me inspect the code.\n<tool_call>{"name": "read_file", "arguments": {"path": "src/index.ts"}}</tool_call>';
    const result = ToolCallRepairService.repair(raw);

    expect(result.repaired).toBe(true);
    expect(result.toolCalls.length).toBe(1);
    expect(result.toolCalls[0].function.name).toBe('read_file');
    expect(JSON.parse(result.toolCalls[0].function.arguments)).toEqual({ path: 'src/index.ts' });
    expect(result.cleanedContent).toBe('Let me inspect the code.');
  });

  it('should auto-repair OpenCode function tags', () => {
    const raw = 'Searching files now.\n<function=search_web><parameter=query>Zavorth agent</parameter></function>';
    const result = ToolCallRepairService.repair(raw);

    expect(result.repaired).toBe(true);
    expect(result.toolCalls.length).toBe(1);
    expect(result.toolCalls[0].function.name).toBe('search_web');
    expect(JSON.parse(result.toolCalls[0].function.arguments)).toEqual({ query: 'Zavorth agent' });
    expect(result.cleanedContent).toBe('Searching files now.');
  });

  it('should auto-repair ReAct Action/Action Input patterns', () => {
    const raw = 'Thought: I need to run tests.\nAction: run_command\nAction Input: {"command": "npm test"}';
    const result = ToolCallRepairService.repair(raw);

    expect(result.repaired).toBe(true);
    expect(result.toolCalls.length).toBe(1);
    expect(result.toolCalls[0].function.name).toBe('run_command');
    expect(JSON.parse(result.toolCalls[0].function.arguments)).toEqual({ command: 'npm test' });
    expect(result.cleanedContent).toBe('Thought: I need to run tests.');
  });

  it('should return repaired=false for normal text without tool calls', () => {
    const raw = 'Hello! How can I assist you with your project today?';
    const result = ToolCallRepairService.repair(raw);

    expect(result.repaired).toBe(false);
    expect(result.toolCalls.length).toBe(0);
    expect(result.cleanedContent).toBe(raw);
  });
});
