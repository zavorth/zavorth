import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);

function createMockCtx(workspace: string) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  return {
    capabilities,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      getLogger() {
        return { debug() {}, info() {}, warn() {}, error() {} };
      },
      getWorkspacePath() {
        return workspace;
      },
      async requestPermission() {
        return false;
      },
      emit() {},
    },
  };
}

describe('linear/notion soft status', () => {
  const tempRoots: string[] = [];
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('linear.status reports missing key and create needs approval', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-linear-'));
    tempRoots.push(root);
    delete process.env.LINEAR_API_KEY;

    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = requireFromTest(path.resolve(__dirname, '../../plugins/linear/index.js'));
    const mock = createMockCtx(root);
    mod.register(mock.ctx);

    const status = await mock.capabilities.get('linear.status')!({ input: {} });
    expect(status.output.tokenPresent).toBe(false);
    expect(status.output.setup).toBeTruthy();

    const list = await mock.capabilities.get('linear.issues.list')!({ input: { limit: 5 } });
    expect(list.output.ok).toBe(false);
    expect(list.output.reason).toBe('no_token');

    const create = await mock.capabilities.get('linear.issue.create')!({
      input: { title: 'Test issue' },
    });
    expect(create.output.ok).toBe(false);
    expect(create.output.reason).toBe('needs_approval');
  });

  it('notion.status reports missing key and page.create needs approval', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-notion-'));
    tempRoots.push(root);
    delete process.env.NOTION_API_KEY;
    delete process.env.NOTION_TOKEN;

    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = requireFromTest(path.resolve(__dirname, '../../plugins/notion/index.js'));
    const mock = createMockCtx(root);
    mod.register(mock.ctx);

    const status = await mock.capabilities.get('notion.status')!({ input: {} });
    expect(status.output.tokenPresent).toBe(false);
    expect(status.output.setup).toBeTruthy();

    const search = await mock.capabilities.get('notion.search')!({ input: { query: 'docs' } });
    expect(search.output.ok).toBe(false);
    expect(search.output.reason).toBe('no_token');

    const create = await mock.capabilities.get('notion.page.create')!({
      input: { title: 'New page', content: 'Hello' },
    });
    expect(create.output.ok).toBe(false);
    expect(create.output.reason).toBe('needs_approval');
  });
});
