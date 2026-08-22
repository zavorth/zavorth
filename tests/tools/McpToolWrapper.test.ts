
import { McpToolWrapper } from '../../src/tools/McpToolWrapper';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('McpToolWrapper', () => {
  it('calls the original remote MCP tool name instead of rewriting underscores', async () => {
    const callTool = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"ok":true}' }],
      isError: false,
    });
    const wrapper = new McpToolWrapper(
      { callTool } as unknown as Client,
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
    const callTool = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    });
    const wrapper = new McpToolWrapper(
      { callTool } as unknown as Client,
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
      { callTool: jest.fn() } as unknown as Client,
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
