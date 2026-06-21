import { describe, it, expect, vi } from 'vitest';
import { McpToolWrapper } from '../../src/tools/McpToolWrapper';

describe('McpToolWrapper', () => {
  it('calls the original remote MCP tool name instead of rewriting underscores', async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"ok":true}' }],
      isError: false,
    });
    const wrapper = new McpToolWrapper(
      { callTool } as any,
      'search_memory',
      'search_memory',
      'Search local memory',
      { type: 'object', properties: {}, required: [] },
    );

    await wrapper.execute({ query: 'mnemos' });

    expect(callTool).toHaveBeenCalledWith({
      name: 'search_memory',
      arguments: { query: 'mnemos' },
    });
  });

  it('keeps a safe registry name while invoking a hyphenated remote name', async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    });
    const wrapper = new McpToolWrapper(
      { callTool } as any,
      'browser_navigate',
      'browser-navigate',
      'Navigate browser',
      { type: 'object', properties: {}, required: [] },
    );

    await wrapper.execute({ url: 'https://example.com' });

    expect(wrapper.name).toBe('browser_navigate');
    expect(callTool).toHaveBeenCalledWith({
      name: 'browser-navigate',
      arguments: { url: 'https://example.com' },
    });
  });

  it('preserves MCP plugin provenance in the tool definition for quarantine checks', () => {
    const wrapper = new McpToolWrapper(
      { callTool: vi.fn() } as any,
      'browser_navigate',
      'browser-navigate',
      'Navigate browser',
      { type: 'object', properties: {}, required: [] },
      { pluginId: 'mcp:browser', source: 'mcp' },
    );

    expect(wrapper.getDefinition()).toEqual(expect.objectContaining({
      name: 'browser_navigate',
      metadata: {
        pluginId: 'mcp:browser',
        source: 'mcp',
      },
    }));
  });
});
