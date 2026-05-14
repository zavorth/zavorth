import { extractFunctionToolCalls } from '../../src/providers/openaiToolCalls';

describe('extractFunctionToolCalls', () => {
  it('keeps only function tool calls and parses their arguments', () => {
    const result = extractFunctionToolCalls([
      {
        id: 'call-1',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: '{"path":"notes.md","overwrite":true}',
        },
      } as any,
      {
        id: 'call-2',
        type: 'custom',
        custom: {
          name: 'custom_tool',
          input: 'ignored',
        },
      } as any,
    ]);

    expect(result).toEqual([
      {
        id: 'call-1',
        name: 'write_file',
        arguments: {
          path: 'notes.md',
          overwrite: true,
        },
      },
    ]);
  });

  it('falls back gracefully when function arguments are not valid json', () => {
    const result = extractFunctionToolCalls([
      {
        id: 'call-3',
        type: 'function',
        function: {
          name: 'run_shell',
          arguments: 'not-json',
        },
      } as any,
    ]);

    expect(result).toEqual([
      {
        id: 'call-3',
        name: 'run_shell',
        arguments: {
          raw: 'not-json',
        },
      },
    ]);
  });
});
