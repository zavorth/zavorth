import { buildWebActionHarnessTools } from '../../../../src/echo/tools/web/WebActionHarnessTools';
import { ToolSchemaHelper } from '../../../../src/echo/types/ToolSchemaHelper';

// Mock the gateway so it doesn't try to load the full runtime
jest.mock('../../../../src/runtime/actions/ZavorthActionGateway', () => ({
  ZavorthActionGateway: class LocalGateway {
    apply = jest.fn().mockResolvedValue({ ok: true, summary: 'mock', lines: [], data: {} });
  },
}));

describe('buildWebActionHarnessTools', () => {
  it('returns exactly 8 tools', () => {
    const tools = buildWebActionHarnessTools();
    expect(tools).toHaveLength(8);
  });

  it('returns tools with provider-safe names', () => {
    const tools = buildWebActionHarnessTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'browser_click',
      'browser_extract',
      'browser_form_submit',
      'browser_open',
      'browser_screenshot',
      'browser_type',
      'web_fetch_url',
      'web_search',
    ]);
  });

  it('serializes only provider-compatible function names', () => {
    const definitions = ToolSchemaHelper.toToolDefinitions(buildWebActionHarnessTools());
    expect(definitions.map((definition) => definition.name)).toEqual([
      'web_search',
      'web_fetch_url',
      'browser_open',
      'browser_screenshot',
      'browser_extract',
      'browser_click',
      'browser_type',
      'browser_form_submit',
    ]);
    for (const definition of definitions) {
      expect(definition.name).toMatch(/^[a-zA-Z0-9_-]+$/);
    }
  });

  it('all tools have category WEB', () => {
    const tools = buildWebActionHarnessTools();
    for (const tool of tools) {
      expect(tool.category).toBe('WEB');
    }
  });

  it('web.search and web.fetch_url are safe, passive browser actions are moderate, interactive browser actions are dangerous', () => {
    const tools = buildWebActionHarnessTools();
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

    expect(byName.web_search.dangerLevel).toBe('safe');
    expect(byName.web_fetch_url.dangerLevel).toBe('safe');
    expect(byName.browser_open.dangerLevel).toBe('moderate');
    expect(byName.browser_screenshot.dangerLevel).toBe('moderate');
    expect(byName.browser_extract.dangerLevel).toBe('moderate');
    expect(byName.browser_click.dangerLevel).toBe('dangerous');
    expect(byName.browser_type.dangerLevel).toBe('dangerous');
    expect(byName.browser_form_submit.dangerLevel).toBe('dangerous');
  });

  it('web.search and web.fetch_url do not require permission', () => {
    const tools = buildWebActionHarnessTools();
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

    expect(byName.web_search.requiresPermission).toBe(false);
    expect(byName.web_fetch_url.requiresPermission).toBe(false);
  });

  it('browser.* actions require permission', () => {
    const tools = buildWebActionHarnessTools();
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

    expect(byName.browser_open.requiresPermission).toBe(true);
    expect(byName.browser_screenshot.requiresPermission).toBe(true);
    expect(byName.browser_extract.requiresPermission).toBe(true);
    expect(byName.browser_click.requiresPermission).toBe(true);
    expect(byName.browser_type.requiresPermission).toBe(true);
    expect(byName.browser_form_submit.requiresPermission).toBe(true);
  });

  it('each tool has a valid zod schema', () => {
    const tools = buildWebActionHarnessTools();
    for (const tool of tools) {
      expect(tool.schema).toBeDefined();
      expect(typeof tool.schema.safeParse).toBe('function');
    }
  });

  it('web.search schema validates query as required', () => {
    const tools = buildWebActionHarnessTools();
    const webSearch = tools.find((t) => t.name === 'web_search')!;
    expect(webSearch.schema.safeParse({ query: 'test' }).success).toBe(true);
    expect(webSearch.schema.safeParse({}).success).toBe(false);
  });

  it('web.fetch_url schema validates url as required', () => {
    const tools = buildWebActionHarnessTools();
    const fetchUrl = tools.find((t) => t.name === 'web_fetch_url')!;
    expect(fetchUrl.schema.safeParse({ url: 'https://example.com' }).success).toBe(true);
    expect(fetchUrl.schema.safeParse({}).success).toBe(false);
  });

  it('browser.open schema validates url as required', () => {
    const tools = buildWebActionHarnessTools();
    const open = tools.find((t) => t.name === 'browser_open')!;
    expect(open.schema.safeParse({ url: 'https://example.com' }).success).toBe(true);
    expect(open.schema.safeParse({}).success).toBe(false);
  });

  it('all tools have a non-empty description', () => {
    const tools = buildWebActionHarnessTools();
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });
});
