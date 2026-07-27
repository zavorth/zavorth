import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGINS = path.resolve(__dirname, '../../plugins');

function createMockCtx(permission = true) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  return {
    capabilities,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      registerBrowserProvider() {},
      registerWebSearchProvider() {},
      getLogger() {
        return { debug() {}, info() {}, warn() {}, error() {} };
      },
      getWorkspacePath() {
        return process.cwd();
      },
      async requestPermission() {
        return permission;
      },
      emit() {},
    },
  };
}

describe('Browser and search capability pack', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('web-search search.status reports backends without secrets', async () => {
    process.env.EXA_API_KEY = 'exa-secret-must-not-leak';
    const mod = requireFromTest(path.join(PLUGINS, 'web-search/index.js'));
    const mock = createMockCtx();
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('search.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    expect(status.output.backends.exa.configured).toBe(true);
    expect(JSON.stringify(status.output)).not.toContain('exa-secret-must-not-leak');
  });

  it('browser-cdp soft-fails without CDP_URL', async () => {
    delete process.env.CDP_URL;
    delete process.env.BROWSER_CDP_URL;
    const mod = requireFromTest(path.join(PLUGINS, 'browser-cdp/index.js'));
    const mock = createMockCtx(false);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('browser.cdp.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    expect(status.output.configured === false || status.output.configured === undefined || !status.output.configured).toBe(true);
    const nav = await mock.capabilities.get('browser.cdp.navigate')!({
      input: { url: 'https://example.com' },
    });
    expect(nav.output.ok).toBe(false);
  });

  it('search-exa soft-fails without key', async () => {
    delete process.env.EXA_API_KEY;
    const mod = requireFromTest(path.join(PLUGINS, 'search-exa/index.js'));
    const mock = createMockCtx(false);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('search.exa.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    const query = await mock.capabilities.get('search.exa.query')!({
      input: { query: 'zavorth search adapter' },
    });
    expect(query.output.ok).toBe(false);
  });

  it('search-firecrawl rejects private scrape URLs', async () => {
    process.env.FIRECRAWL_API_KEY = 'fc-test';
    const mod = requireFromTest(path.join(PLUGINS, 'search-firecrawl/index.js'));
    const mock = createMockCtx(true);
    mod.register(mock.ctx);
    const scrape = await mock.capabilities.get('search.firecrawl.scrape')!({
      input: { url: 'http://127.0.0.1:3000/secret' },
    });
    expect(scrape.output.ok).toBe(false);
    expect(JSON.stringify(scrape.output)).not.toContain('fc-test-should-not-appear');
  });
});
